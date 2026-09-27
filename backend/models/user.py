"""
models/user.py  —  MySQL version
"""

import hmac

from database import get_db


class OtpCooldownError(Exception):
    def __init__(self, retry_after):
        self.retry_after = max(int(retry_after), 1)
        super().__init__("OTP resend cooldown is active")


def get_user_by_email(email):
    db = get_db()
    with db.cursor() as cur:
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        return cur.fetchone()


def get_user_by_id(user_id):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            "SELECT id, name, email, role, created_at FROM users WHERE id=%s",
            (user_id,)
        )
        return cur.fetchone()


def get_users_for_warehouse():
    db = get_db()
    with db.cursor() as cur:
        cur.execute("""
            SELECT id, name, email, role,
                   email_verified AS is_active,
                   created_at
            FROM users
            ORDER BY role DESC, name ASC
        """)
        return cur.fetchall()


def create_user(name, email, password_hash, role="WAREHOUSE_STAFF", email_verified=True):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO users (name, email, password_hash, role, email_verified) VALUES (%s,%s,%s,%s,%s)",
            (name, email, password_hash, role, email_verified)
        )
        new_id = cur.lastrowid
    db.commit()
    return new_id


def update_password(email, new_hash):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            "UPDATE users SET password_hash=%s WHERE email=%s",
            (new_hash, email)
        )
    db.commit()


# ── OTP helpers ─────────────────────────────────────────────────────────────

def save_otp(email, otp_hash, purpose="password_reset"):
    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("SELECT id FROM users WHERE email=%s FOR UPDATE", (email,))
            if not cur.fetchone():
                db.rollback()
                return False

            cur.execute("""
                SELECT GREATEST(30 - TIMESTAMPDIFF(SECOND, created_at, NOW()), 0)
                    AS retry_after
                FROM otp_tokens
                WHERE email=%s AND purpose=%s
                ORDER BY created_at DESC
                LIMIT 1
                FOR UPDATE
            """, (email, purpose))
            recent = cur.fetchone()
            if recent and recent["retry_after"] > 0:
                db.rollback()
                raise OtpCooldownError(recent["retry_after"])

            purposes_to_invalidate = [purpose]
            if purpose == "password_reset":
                purposes_to_invalidate.append("password_reset_grant")
            placeholders = ",".join(["%s"] * len(purposes_to_invalidate))
            cur.execute(
                f"UPDATE otp_tokens SET used=1 WHERE email=%s AND purpose IN ({placeholders}) AND used=0",
                (email, *purposes_to_invalidate),
            )
            cur.execute("""
                INSERT INTO otp_tokens (email, otp, purpose, expires_at)
                VALUES (%s, %s, %s, DATE_ADD(NOW(), INTERVAL 10 MINUTE))
            """, (email, otp_hash, purpose))
        db.commit()
        return True
    except Exception:
        db.rollback()
        raise


def _check_latest_otp(cur, email, otp_hash, purpose):
    cur.execute("""
        SELECT id, otp, used, attempt_count, expires_at > NOW() AS is_active
        FROM otp_tokens
        WHERE email=%s AND purpose=%s
        ORDER BY created_at DESC
        LIMIT 1
        FOR UPDATE
    """, (email, purpose))
    row = cur.fetchone()
    if not row:
        return "invalid", None
    if row["used"]:
        return "invalid", None
    if not row["is_active"]:
        cur.execute("UPDATE otp_tokens SET used=1 WHERE id=%s", (row["id"],))
        return "expired", None
    if row["attempt_count"] >= 5:
        cur.execute("UPDATE otp_tokens SET used=1 WHERE id=%s", (row["id"],))
        return "locked", None
    if not hmac.compare_digest(row["otp"], otp_hash):
        attempts = row["attempt_count"] + 1
        cur.execute(
            "UPDATE otp_tokens SET attempt_count=%s, used=%s WHERE id=%s",
            (attempts, int(attempts >= 5), row["id"]),
        )
        return ("locked" if attempts >= 5 else "invalid"), None
    return "verified", row


def consume_signup_otp(email, otp_hash):
    db = get_db()
    try:
        with db.cursor() as cur:
            status, row = _check_latest_otp(cur, email, otp_hash, "signup")
            if status == "verified":
                cur.execute(
                    "UPDATE users SET email_verified=1 WHERE email=%s AND email_verified=0",
                    (email,),
                )
                if cur.rowcount != 1:
                    db.rollback()
                    return "invalid"
                cur.execute("UPDATE otp_tokens SET used=1 WHERE id=%s", (row["id"],))
        db.commit()
        return status
    except Exception:
        db.rollback()
        raise


def verify_reset_otp_and_issue_grant(email, otp_hash, grant_hash):
    db = get_db()
    try:
        with db.cursor() as cur:
            status, row = _check_latest_otp(cur, email, otp_hash, "password_reset")
            if status == "verified":
                cur.execute("UPDATE otp_tokens SET used=1 WHERE id=%s", (row["id"],))
                cur.execute("""
                    INSERT INTO otp_tokens (email, otp, purpose, expires_at)
                    VALUES (%s, %s, 'password_reset_grant', DATE_ADD(NOW(), INTERVAL 10 MINUTE))
                """, (email, grant_hash))
        db.commit()
        return status
    except Exception:
        db.rollback()
        raise


def complete_password_reset(grant_hash, password_hash):
    db = get_db()
    try:
        with db.cursor() as cur:
            cur.execute("""
                SELECT id, email FROM otp_tokens
                WHERE otp=%s AND purpose='password_reset_grant' AND used=0
                  AND expires_at > NOW()
                LIMIT 1
                FOR UPDATE
            """, (grant_hash,))
            grant = cur.fetchone()
            if not grant:
                db.rollback()
                return None

            cur.execute(
                "UPDATE users SET password_hash=%s WHERE email=%s",
                (password_hash, grant["email"]),
            )
            if cur.rowcount != 1:
                db.rollback()
                return None
            cur.execute("UPDATE otp_tokens SET used=1 WHERE id=%s AND used=0", (grant["id"],))
            if cur.rowcount != 1:
                db.rollback()
                return None
            cur.execute(
                "UPDATE otp_tokens SET used=1 WHERE email=%s AND purpose='password_reset' AND used=0",
                (grant["email"],),
            )
            cur.execute(
                "SELECT id, name, email, role FROM users WHERE email=%s",
                (grant["email"],),
            )
            user = cur.fetchone()
        db.commit()
        return user
    except Exception:
        db.rollback()
        raise


def invalidate_otps(email, purpose="password_reset"):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            "UPDATE otp_tokens SET used=1 WHERE email=%s AND purpose=%s AND used=0",
            (email, purpose),
        )
    db.commit()
