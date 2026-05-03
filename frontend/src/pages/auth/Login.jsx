import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import "./Signup.css";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import { setTokens } from "../../api/apiClient";
import { resendTwoFactor } from "../../api/auth";
import { authenticateWithGoogle, formatGoogleError } from "../../utils/googleAuth";
import VerificationCodeCard from "./VerificationCodeCard";

const features = [
  {
    title: "Real-time tracking",
    description: "Monitor every credit entry, repayment, and reminder in one view.",
  },
  {
    title: "In-built OCR System",
    description: "Upload bills and receipts to automatically extract and organize udharo entries.",
  },
  {
    title: "Instant updates",
    description: "Notify clients instantly and keep your books automatically in sync.",
  },
];

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const { login, verifyTwoFactor, setUserState } = useAuth();

  useEffect(() => {
    if (location.state?.message) {
      setStatus(location.state.message);
      navigate(location.pathname, { replace: true });
    }

  }, [location, navigate]);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = window.setInterval(() => {
      setResendCooldown((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setSubmitting(true);
    try {
      const profile = await login(form);
      if (profile?.two_factor_required) {
        setOtpEmail(profile.email || form.email);
        setOtp("");
        setResendCooldown(60);
        setStatus(profile.message || "OTP sent to your email.");
        return;
      }
      navigate(resolveHomeRoute(profile), { replace: true });
    } catch (err) {
      const message = err.message || "Login failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (response) => {
    setError("");
    setStatus("");
    try {
      const result = await authenticateWithGoogle(response.credential, "PRIVATE");
      setTokens(result.access, result.refresh);
      setUserState(result.user);
      navigate(resolveHomeRoute(result.user), { replace: true });
    } catch (err) {
      setError(formatGoogleError(err));
    }
  };

  const handleOtpSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setSubmitting(true);
    try {
      const profile = await verifyTwoFactor({ email: otpEmail, otp });
      navigate(resolveHomeRoute(profile), { replace: true });
    } catch (err) {
      setError(err.message || "OTP verification failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    if (!otpEmail || resendCooldown > 0 || submitting) return;
    setError("");
    setStatus("");
    setSubmitting(true);
    try {
      const { data } = await resendTwoFactor(otpEmail);
      setStatus(data?.message || "OTP sent to your email.");
      setResendCooldown(60);
    } catch (err) {
      const retryAfter = err?.response?.data?.retry_after;
      if (retryAfter) {
        setResendCooldown(Number(retryAfter));
      }
      setError(err?.response?.data?.detail || "Unable to resend OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setOtpEmail("");
    setOtp("");
    setError("");
    setStatus("");
    setResendCooldown(0);
  };

  const handleGoogleError = () => {
    setError("Google sign-in failed. Please try again.");
  };

  if (otpEmail) {
    return (
      <VerificationCodeCard
        title="Verification Code"
        subtitle={`Enter the 6-digit code we sent to ${otpEmail}.`}
        code={otp}
        onCodeChange={setOtp}
        onSubmit={handleOtpSubmit}
        onResend={handleResendOtp}
        onBack={handleBackToLogin}
        status={status}
        error={error}
        submitting={submitting}
        resendLabel={resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend"}
        submitLabel="Confirm Code"
      />
    );
  }

  return (
    <div className="signup-page">
      <div className="signup-card">
        <section className="signup-hero">
          <div className="hero-pill">
            <span className="dot" />
            Smart Ledger Management
          </div>
          <h1>
            Welcome to <span>UdharoGuru</span>
          </h1>
          <p className="hero-lede">
            Manage dues, repayments, and customer reminders in one secure platform built for modern
            businesses.
          </p>

          <div className="feature-grid">
            {features.map((item) => (
              <div key={item.title} className="feature-card">
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="signup-form-panel">
          <div className="hero-pill pill-light">
            <span className="dot dot-light" />
            UdharoGuru -Your Trusted Credit Management Partner
          </div>
          <h2>Sign in to continue</h2>
          <p className="form-lede">
            Access your dashboard, send reminders, and keep your books accurate every day.
          </p>

          <form onSubmit={handleSubmit} className="signup-form">
            {status && (
              <div className="form-status">
                {status}
              </div>
            )}

            {error && <div className="form-error">{error}</div>}

            <label className="field">
              <span>Email *</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="field">
              <span>Password *</span>
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
                required
              />
            </label>

            <div className="form-meta">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={showPassword}
                  onChange={(e) => setShowPassword(e.target.checked)}
                />
                <span>Show password</span>
              </label>
              <Link to="/auth/forgot-password" className="link-quiet">
                Forgot password?
              </Link>
            </div>

            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Processing..." : "Sign in"}
            </button>
          </form>

          <div style={{ margin: "20px 0", display: "flex", gap: "10px" }}>
            <hr style={{ flex: 1, marginTop: "10px" }} />
            <span style={{ fontSize: "14px", color: "#666" }}>or</span>
            <hr style={{ flex: 1, marginTop: "10px" }} />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text="signin_with"
              theme="outline"
              locale="en"
              width="100%"
              useOneTap={false}
            />
          </div>

          <p className="switch-auth">
            New here?{" "}
            <Link to="/auth/signup" className="link-quiet">
              Create an account
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
