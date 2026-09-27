// ──────────────────────────────────────────────────────────
// src/pages/Signup.jsx — Sign-up page with target audience roles
// ──────────────────────────────────────────────────────────

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { signup, verifySignupOtp } from "../services/authApi";
import { USE_MOCKS } from "../services/api";
import "./Auth.css";

export default function Signup() {
  const [step, setStep] = useState("details");
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "WAREHOUSE_STAFF",
    password: "",
    confirmPassword: "",
  });
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  useEffect(() => {
    if (!resendSeconds) return undefined;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.name || !form.email || !form.password) {
      setError("Please fill in all fields");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    setLoading(true);
    try {
      await signup({
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password,
      });
      setResendSeconds(30);
      setStep("otp");
    } catch (err) {
      if (err.status === 429) setResendSeconds(Number(err.retryAfter) || 30);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e) {
    e.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit code sent to your email");
      return;
    }

    setLoading(true);
    try {
      await verifySignupOtp(form.email, otp);
      setStep("verified");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError("");
    setLoading(true);
    try {
      await signup({
        name: form.name,
        email: form.email,
        role: form.role,
        password: form.password,
      });
      setOtp("");
      setResendSeconds(30);
    } catch (err) {
      if (err.status === 429) setResendSeconds(Number(err.retryAfter) || 30);
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
          <p>Create your account</p>
        </div>

        <form
          className="auth-form"
          onSubmit={step === "details" ? handleSubmit : handleVerifyOtp}
        >
          {step === "verified" ? (
            <>
              <h2>Email verified</h2>
              <div className="auth-success">
                Your email is verified. You can now sign in.
              </div>
              <Link className="btn btn--primary btn--lg auth-submit" to="/login">
                Continue to Sign In
              </Link>
            </>
          ) : step === "otp" ? (
            <>
              <h2>Verify your email</h2>
              <p className="auth-desc">
                Enter the 6-digit code sent to <strong>{form.email}</strong>.
              </p>
              {USE_MOCKS && (
                <p className="form-help-text">Demo verification code: 123456</p>
              )}
              {error && <div className="auth-error">{error}</div>}
              <div className="form-group">
                <label className="form-label" htmlFor="signup-otp">Verification code</label>
                <input
                  id="signup-otp"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="form-input otp-input"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="6-digit code"
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit" className="btn btn--primary btn--lg auth-submit" disabled={loading}>
                {loading ? "Verifying..." : "Verify Email"}
              </button>
              <p className="auth-switch">
                Didn’t receive it?{" "}
                {resendSeconds > 0 ? (
                  `Resend code in ${resendSeconds}s`
                ) : (
                  <button type="button" className="auth-link-btn" onClick={handleResendOtp} disabled={loading}>
                    Resend code
                  </button>
                )}
              </p>
              <p className="auth-switch" style={{ marginTop: 12 }}>
                <button type="button" className="auth-link-btn" onClick={() => setStep("details")}>
                  Change signup details
                </button>
              </p>
            </>
          ) : (
            <>
          <h2>Sign Up</h2>
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input
              type="text"
              className="form-input"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Alex Rivera"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Account Role</label>
            <input className="form-input" value="Warehouse Staff" readOnly />
            {!USE_MOCKS && <span className="form-help-text">Manager accounts are provisioned by an administrator.</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Email</label>
            <input
              type="email"
              className="form-input"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input
              type="password"
              className="form-input"
              value={form.password}
              onChange={(e) => update("password", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Confirm Password</label>
            <input
              type="password"
              className="form-input"
              value={form.confirmPassword}
              onChange={(e) => update("confirmPassword", e.target.value)}
              placeholder="••••••••"
              autoComplete="new-password"
              required
            />
          </div>

          <button type="submit" className="btn btn--primary btn--lg auth-submit" disabled={loading}>
            {loading ? "Creating account..." : "Create Warehouse Staff Account"}
          </button>

          <p className="auth-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
