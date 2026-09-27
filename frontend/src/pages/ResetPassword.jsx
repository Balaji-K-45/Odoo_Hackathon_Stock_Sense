// ──────────────────────────────────────────────────────────
// src/pages/ResetPassword.jsx — Set new password with OTP confirmation
// ──────────────────────────────────────────────────────────

import { useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { resetPassword, login } from "../services/authApi";
import { useAuth } from "../context/AuthContext";
import { USE_MOCKS } from "../services/api";
import "./Auth.css";

export default function ResetPassword() {
  const location               = useLocation();
  const email                  = location.state?.email || "";
  const resetToken             = location.state?.resetToken || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const navigate                = useNavigate();
  const { loginUser }           = useAuth();

  if (!email || !resetToken) {
    return <Navigate to="/forgot-password" replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!password) {
      setError("Please enter a new password");
      return;
    }
    if (password.length < 6) {
      setError("Password must contain at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const resetResult = await resetPassword(email, resetToken, password);
      if (resetResult.token && resetResult.user) {
        loginUser(resetResult.token, resetResult.user);
      } else if (USE_MOCKS) {
        const loginRes = await login(email, password);
        loginUser(loginRes.token, loginRes.user);
      } else {
        throw new Error("Password reset completed but no session was issued");
      }
      setSuccess(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 900);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">◈</span>
          <h1>StockSense</h1>
          <p>Create New Password</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>New Credentials</h2>
          <p className="auth-desc">
            Verified OTP code for <strong>{email || "your account"}</strong>.
          </p>

          {success ? (
            <div className="auth-success">
              Password updated successfully. Taking you to your dashboard...
            </div>
          ) : (
            <>
              {error && <div className="auth-error">{error}</div>}

              <div className="form-group">
                <label className="form-label">New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Confirm New Password</label>
                <input
                  type="password"
                  className="form-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat new password"
                  required
                />
              </div>

              {password && confirm && (
                <div style={{ marginBottom: 16 }}>
                  {password === confirm ? (
                    <span style={{ fontSize: 12, color: "var(--success)", fontWeight: 600 }}>
                      ✓ Passwords match
                    </span>
                  ) : (
                    <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>
                      ✕ Passwords do not match
                    </span>
                  )}
                </div>
              )}

              <button
                type="submit"
                className="btn btn--primary btn--lg auth-submit"
                disabled={loading}
              >
                {loading ? "Updating Password..." : "Save Password & Continue"}
              </button>
            </>
          )}

          <p className="auth-switch">
            <Link to="/login">← Cancel and Back to Sign In</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
