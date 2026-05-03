import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import AuthLayout from "./AuthLayout";
import { useAuth } from "../../context/AuthContext";
import VerificationCodeCard from "./VerificationCodeCard";
import "./Signup.css";

const inputStyle = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  outline: "none",
  fontSize: 14,
};

const btnStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "#1d4ed8",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

export default function ForgotPassword() {
  const navigate = useNavigate();
  const {
    forgotPassword,
    verifyPasswordResetOTP,
    resetPassword,
    resendPasswordResetOTP,
  } = useAuth();

  const [screen, setScreen] = useState("request"); // "request", "verify", "reset"
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleRequestOTP = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setSubmitting(true);
    try {
      await forgotPassword(email);
      setStatus("If an account exists, a verification code has been sent to your email.");
      setScreen("verify");
      setOtp("");
      setResetToken("");
    } catch (err) {
      setError(err.message || "Failed to send verification code.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setSubmitting(true);
    try {
      const result = await verifyPasswordResetOTP({ email, otp });
      setResetToken(result.reset_token);
      setStatus("");
      setScreen("reset");
    } catch (err) {
      setError(err.message || "Invalid or expired OTP.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword({
        email,
        reset_token: resetToken,
        new_password: newPassword,
      });
      setStatus("Password reset successful! Redirecting to login...");
      setTimeout(() => {
        navigate("/auth/login");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to reset password. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOTP = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await resendPasswordResetOTP(email);
      setStatus("Password reset code sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to resend code.");
    } finally {
      setSubmitting(false);
    }
  };

  if (screen === "verify") {
    return (
      <VerificationCodeCard
        title="Verification Code"
        subtitle={`Enter the 6-digit password reset code sent to ${email}.`}
        code={otp}
        onCodeChange={setOtp}
        onSubmit={handleVerifyOTP}
        onResend={handleResendOTP}
        onBack={() => {
          setScreen("request");
          setError("");
          setOtp("");
        }}
        status={status}
        error={error}
        submitting={submitting}
        resendLabel="Resend"
        submitLabel="Confirm Code"
      />
    );
  }

  if (screen === "reset") {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="Enter your new password below."
        footer={
          <>
            Remember your password?{" "}
            <Link to="/auth/login" style={{ color: "#1d4ed8", fontWeight: 700 }}>
              Go to login
            </Link>
          </>
        }
      >
        <form onSubmit={handleResetPassword} style={{ display: "grid", gap: 12 }}>
          {status && (
            <div
              style={{
                padding: 12,
                borderRadius: 10,
                background: "#ecfdf3",
                border: "1px solid #bbf7d0",
                color: "#15803d",
                fontWeight: 700,
              }}
            >
              {status}
            </div>
          )}

          <div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 }}>
              New password
            </div>
            <input
              style={inputStyle}
              type="password"
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 }}>
              Confirm password
            </div>
            <input
              style={inputStyle}
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <button
            style={{ ...btnStyle, opacity: submitting ? 0.7 : 1 }}
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Resetting..." : "Reset password"}
          </button>

          {error && <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div>}
        </form>
      </AuthLayout>
    );
  }

  // Default: request screen
  return (
    <AuthLayout
      title="Forgot password?"
      subtitle="Enter your email address and we'll send you a code to reset your password."
      footer={
        <>
          Remember your password?{" "}
          <Link to="/auth/login" style={{ color: "#1d4ed8", fontWeight: 700 }}>
            Go to login
          </Link>
        </>
      }
    >
      <form onSubmit={handleRequestOTP} style={{ display: "grid", gap: 12 }}>
        {status && (
          <div
            style={{
              padding: 12,
              borderRadius: 10,
              background: "#ecfdf3",
              border: "1px solid #bbf7d0",
              color: "#15803d",
              fontWeight: 700,
            }}
          >
            {status}
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 }}>
            Email address
          </div>
          <input
            style={inputStyle}
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
            required
          />
        </div>

        <button
          style={{ ...btnStyle, opacity: submitting ? 0.7 : 1 }}
          type="submit"
          disabled={submitting}
        >
          {submitting ? "Sending..." : "Send verification code"}
        </button>

        {error && <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div>}
      </form>
    </AuthLayout>
  );
}
