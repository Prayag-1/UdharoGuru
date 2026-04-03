import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "./Signup.css";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

function readPendingOtpLogin() {
  try {
    const raw = sessionStorage.getItem("pending_otp_login");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function VerifyOtp() {
  const navigate = useNavigate();
  const { verifyOtp } = useAuth();
  const pending = useMemo(() => readPendingOtpLogin(), []);

  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (!pending?.userId) {
      setError("No pending OTP login found. Please sign in again.");
      return;
    }
    if (!/^\d{6}$/.test(otp)) {
      setError("Enter the 6-digit OTP.");
      return;
    }

    setSubmitting(true);
    try {
      const profile = await verifyOtp({ user_id: pending.userId, otp });
      sessionStorage.removeItem("pending_otp_login");
      navigate(resolveHomeRoute(profile), { replace: true });
    } catch (err) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <section className="signup-hero">
          <div className="hero-pill">
            <span className="dot" />
            Two-Factor Authentication
          </div>
          <h1>
            Enter your <span>OTP code</span>
          </h1>
          <p className="hero-lede">
            We sent a 6-digit code to <strong>{pending?.email || "your email"}</strong>. The code expires in 5 minutes.
          </p>
        </section>

        <section className="signup-form-panel">
          <div className="hero-pill pill-light">
            <span className="dot dot-light" />
            Email OTP Verification
          </div>
          <h2>Verify sign in</h2>
          <p className="form-lede">Enter the OTP from your inbox to complete login and receive your token.</p>

          <form onSubmit={handleSubmit} className="signup-form">
            {status && <div className="form-status">{status}</div>}

            <label className="field">
              <span>OTP Code *</span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                required
              />
            </label>

            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Verifying..." : "Verify OTP"}
            </button>

            {error && <div className="form-error">{error}</div>}
          </form>

          <p className="switch-auth">
            Didn&apos;t get a code or it expired?{" "}
            <Link to="/auth/login" className="link-quiet" onClick={() => sessionStorage.removeItem("pending_otp_login")}>
              Go back to login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
