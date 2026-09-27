"""
routes/auth_routes.py
----------------------
Public routes (no token needed):
  POST /api/auth/signup          → create account
    POST /api/auth/verify-signup-otp → verify signup email
  POST /api/auth/login           → get JWT token
  POST /api/auth/forgot-password → request OTP
  POST /api/auth/verify-otp      → check OTP validity
  POST /api/auth/reset-password  → set new password

Protected routes (token required, any authenticated role):
  GET  /api/auth/profile         → get logged-in user info
  POST /api/auth/change-password → update current password
"""

from flask import Blueprint, request, jsonify, g
from middleware.auth import login_required, roles_required, ALL_ROLES
from services.auth_service import (
    signup, login, verify_signup_otp, send_otp, verify_otp, reset_password,
    change_password,
)
from models.user import OtpCooldownError

auth_bp = Blueprint("auth", __name__)


# ── Signup (public) ───────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/signup", methods=["POST"])
def do_signup():
    data = request.get_json() or {}
    try:
        result, error = signup(
            name=data.get("name"),
            email=data.get("email"),
            password=data.get("password"),
        )
    except OtpCooldownError as cooldown:
        return jsonify({
            "success": False,
            "message": "Please wait before requesting another code",
        }), 429, {"Retry-After": str(cooldown.retry_after)}
    if error:
        status = 503 if error.startswith(("Email delivery", "Email security", "Unable to send")) else 400
        return jsonify({"success": False, "message": error}), status
    return jsonify({
        "success": True,
        "message": "Verification code sent",
        "data": result,
    }), 202


@auth_bp.route("/api/auth/verify-signup-otp", methods=["POST"])
def do_verify_signup_otp():
    data = request.get_json() or {}
    result, error = verify_signup_otp(
        email=data.get("email"),
        otp=data.get("otp"),
    )
    if error:
        return jsonify({"success": False, "message": error}), 400
    return jsonify({
        "success": True,
        "message": "Email verified successfully",
        "data": result,
    }), 200


# ── Login (public) ────────────────────────────────────────────────────────────

@auth_bp.route("/api/auth/login", methods=["POST"])
def do_login():
    data = request.get_json() or {}
    result, error = login(
        email    = data.get("email"),
        password = data.get("password"),
    )
    if error:
        status = 403 if error == "Please verify your email before signing in" else 401
        return jsonify({"success": False, "message": error}), status
    return jsonify({
        "success": True,
        "message": "Login successful",
        "data": result,
    }), 200


# ── Forgot Password (public) ──────────────────────────────────────────────────

@auth_bp.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    data = request.get_json() or {}
    try:
        result, error = send_otp(email=data.get("email"))
    except OtpCooldownError as cooldown:
        return jsonify({
            "success": False,
            "message": "Please wait before requesting another code",
        }), 429, {"Retry-After": str(cooldown.retry_after)}
    if error:
        if error == "Email is required":
            status = 400
        elif error.startswith(("Unable to send", "Email delivery", "Email security")):
            status = 503
        else:
            status = 200
            return jsonify({"success": True, "data": {"message": error}}), status
        return jsonify({"success": False, "message": error}), status
    return jsonify({"success": True, "data": result}), 200


# ── Verify OTP (public) ───────────────────────────────────────────────────────

@auth_bp.route("/api/auth/verify-otp", methods=["POST"])
def do_verify_otp():
    data = request.get_json() or {}
    result, error = verify_otp(
        email = data.get("email"),
        otp   = data.get("otp"),
    )
    if error:
        return jsonify({"success": False, "message": error}), 400
    return jsonify({"success": True, "data": result}), 200


# ── Reset Password (public) ───────────────────────────────────────────────────

@auth_bp.route("/api/auth/reset-password", methods=["POST"])
def do_reset_password():
    data = request.get_json() or {}
    result, error = reset_password(
        email        = data.get("email"),
        reset_token  = data.get("reset_token"),
        new_password = data.get("new_password"),
    )
    if error:
        return jsonify({"success": False, "message": error}), 400
    return jsonify({"success": True, "data": result}), 200


# ── Profile (protected — any authenticated role) ──────────────────────────────

@auth_bp.route("/api/auth/profile", methods=["GET"])
@auth_bp.route("/api/auth/me", methods=["GET"])
@login_required
@roles_required(*ALL_ROLES)
def profile():
    """Returns the currently logged-in user's profile."""
    return jsonify({"success": True, "data": g.current_user}), 200


@auth_bp.route("/api/auth/change-password", methods=["POST"])
@login_required
@roles_required(*ALL_ROLES)
def do_change_password():
    data = request.get_json() or {}
    result, error = change_password(
        email=g.current_user["email"],
        current_password=data.get("current_password"),
        new_password=data.get("new_password"),
    )
    if error:
        return jsonify({"success": False, "message": error}), 400
    return jsonify({"success": True, **result}), 200
