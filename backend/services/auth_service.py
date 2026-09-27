"""
services/auth_service.py
-------------------------
Signup, login, password reset via OTP, and authenticated password changes.

Password hashing uses werkzeug (already a Flask dependency — no extra install).
Password-reset OTPs are delivered through the configured SMTP service and are
never included in API responses.
"""

import secrets
import hashlib
import hmac
from datetime import datetime, timedelta
import logging
from werkzeug.security import generate_password_hash, check_password_hash
import jwt
import os

from models.user import (
    get_user_by_email, create_user, update_password,
    save_otp, invalidate_otps, consume_signup_otp,
    verify_reset_otp_and_issue_grant, complete_password_reset,
    OtpCooldownError,
)
from services.email_service import is_configured, send_email

SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-me")
TOKEN_EXPIRY_HOURS = 24


# ── Public signup role ───────────────────────────────────────────────────────
WAREHOUSE_STAFF = "WAREHOUSE_STAFF"


def _otp_digest(purpose, email, value):
    secret = os.getenv("SECRET_KEY", "").strip()
    if not secret or secret == "dev-secret-change-me":
        raise RuntimeError("A non-default SECRET_KEY is required for OTP storage")
    payload = f"{purpose}:{email}:{value}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _otp_security_configured():
    secret = os.getenv("SECRET_KEY", "").strip()
    return bool(secret and secret != "dev-secret-change-me")


def _new_otp():
    return f"{secrets.randbelow(1_000_000):06d}"


# ── Signup ───────────────────────────────────────────────────────────────────

def signup(name, email, password):
    name  = (name or "").strip()
    email = (email or "").strip().lower()

    if not name:
        return None, "Name is required"
    if not email or "@" not in email:
        return None, "Valid email is required"
    if not password or len(password) < 6:
        return None, "Password must be at least 6 characters"
    # Public registration must never grant elevated privileges.
    role = WAREHOUSE_STAFF

    existing_user = get_user_by_email(email)
    if existing_user:
        if existing_user.get("email_verified", 1):
            return None, "Email already registered"
        if not check_password_hash(existing_user["password_hash"], password):
            return None, "Email already registered"
        return _send_signup_otp(email)

    if not is_configured():
        return None, "Email delivery is not configured on this server"
    if not _otp_security_configured():
        return None, "Email security configuration is not configured on this server"

    hashed = generate_password_hash(password)
    create_user(name, email, hashed, role, email_verified=False)
    return _send_signup_otp(email)


def _send_signup_otp(email):
    if not is_configured():
        return None, "Email delivery is not configured on this server"
    if not _otp_security_configured():
        return None, "Email security configuration is not configured on this server"

    otp = _new_otp()
    try:
        saved = save_otp(email, _otp_digest("signup", email, otp), purpose="signup")
    except OtpCooldownError:
        raise
    if not saved:
        return None, "Unable to send verification email. Please try again later."
    try:
        send_email(
            email,
            "StockSense - Verify Your Email",
            f"Your StockSense verification OTP is:\n\n{otp}\n\nThis OTP expires in 10 minutes.\n\nIf you did not create this account, please ignore this email.",
        )
    except Exception:
        invalidate_otps(email, purpose="signup")
        logging.getLogger(__name__).warning("Signup verification email delivery failed")
        return None, "Unable to send verification email. Please try again later."

    return {"email": email, "message": "Verification code sent"}, None


# ── Login ────────────────────────────────────────────────────────────────────

def login(email, password):
    email = (email or "").strip().lower()
    if not email or not password:
        return None, "Email and password are required"

    user = get_user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], password):
        return None, "Invalid email or password"
    if not user.get("email_verified", 1):
        return None, "Please verify your email before signing in"

    token = _make_token(user["id"], user["email"], user["role"])
    return {
        "token": token,
        "user": {
            "id":    user["id"],
            "name":  user["name"],
            "email": user["email"],
            "role":  user["role"],
        }
    }, None


def verify_signup_otp(email, otp):
    email = (email or "").strip().lower()
    otp = str(otp or "").strip()
    if not email or not otp:
        return None, "Email and verification code are required"
    if len(otp) != 6 or not otp.isdigit():
        return None, "Invalid or expired verification code"
    status = consume_signup_otp(email, _otp_digest("signup", email, otp))
    if status == "expired":
        return None, "OTP expired. Please request a new OTP."
    if status == "locked":
        return None, "Too many incorrect attempts. Please request a new OTP."
    if status != "verified":
        return None, "Invalid or expired verification code"
    return {"email": email, "verified": True}, None


# ── Forgot password (send OTP) ────────────────────────────────────────────────

def send_otp(email):
    email = (email or "").strip().lower()
    if not email:
        return None, "Email is required"
    if not is_configured():
        return None, "Email delivery is not configured on this server"

    user = get_user_by_email(email)
    if not user:
        return {"message": "If this email is registered, an OTP has been sent"}, None
    if not _otp_security_configured():
        return None, "Email security configuration is not configured on this server"

    otp = _new_otp()
    try:
        saved = save_otp(email, _otp_digest("password_reset", email, otp), purpose="password_reset")
    except OtpCooldownError:
        raise
    if not saved:
        return {"message": "If this email is registered, an OTP has been sent"}, None
    try:
        send_email(
            email,
            "StockSense - Password Reset OTP",
            f"Your StockSense password reset OTP is:\n\n{otp}\n\nThis OTP expires in 10 minutes.\n\nIf you did not request a password reset, you can ignore this email.",
        )
    except Exception:
        invalidate_otps(email, purpose="password_reset")
        logging.getLogger(__name__).warning("Password reset email delivery failed")
        return None, "Unable to send reset email. Please try again later."

    return {"message": "If this email is registered, a reset code has been sent."}, None


# ── Verify OTP ────────────────────────────────────────────────────────────────

def verify_otp(email, otp):
    email = (email or "").strip().lower()
    otp = str(otp or "").strip()
    if not email or len(otp) != 6 or not otp.isdigit():
        return None, "Invalid or expired OTP"
    reset_token = secrets.token_urlsafe(32)
    status = verify_reset_otp_and_issue_grant(
        email,
        _otp_digest("password_reset", email, otp),
        _otp_digest("password_reset_grant", email, reset_token),
    )
    if status == "expired":
        return None, "OTP expired. Please request a new OTP."
    if status == "locked":
        return None, "Too many incorrect attempts. Please request a new OTP."
    if status != "verified":
        return None, "Invalid or expired OTP"
    return {"valid": True, "email": email, "reset_token": reset_token}, None


# ── Reset password ────────────────────────────────────────────────────────────

def reset_password(email, reset_token, new_password):
    email = (email or "").strip().lower()
    if not new_password or len(new_password) < 6:
        return None, "Password must be at least 6 characters"
    if not email or not reset_token:
        return None, "Password reset authorization is missing or expired"

    user = complete_password_reset(
        _otp_digest("password_reset_grant", email, reset_token),
        generate_password_hash(new_password),
    )
    if not user:
        return None, "Password reset authorization is invalid or expired"
    token = _make_token(user["id"], user["email"], user["role"])
    return {
        "message": "Password reset successfully",
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
    }, None


def change_password(email, current_password, new_password):
    email = (email or "").strip().lower()
    if not current_password or not new_password:
        return None, "Current and new passwords are required"
    if len(new_password) < 8:
        return None, "New password must be at least 8 characters"

    user = get_user_by_email(email)
    if not user or not check_password_hash(user["password_hash"], current_password):
        return None, "Current password is incorrect"
    update_password(email, generate_password_hash(new_password))
    return {"message": "Password changed successfully"}, None


# ── Token helpers ─────────────────────────────────────────────────────────────

def _make_token(user_id, email, role):
    payload = {
        "user_id": user_id,
        "email":   email,
        "role":    role,
        "exp":     datetime.utcnow() + timedelta(hours=TOKEN_EXPIRY_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def decode_token(token):
    """Returns the payload dict or raises jwt.ExpiredSignatureError / jwt.InvalidTokenError."""
    return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
