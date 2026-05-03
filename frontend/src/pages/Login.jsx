import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { GoogleLogin } from "@react-oauth/google";

import { resolveHomeRoute, useAuth } from "../context/AuthContext";
import { authenticateWithGoogle, formatGoogleError } from "../utils/googleAuth";
import { setTokens } from "../api/apiClient";

const Login = () => {
  const [screen, setScreen] = useState("login"); // "login" or "2fa"
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  const [otpForm, setOtpForm] = useState({
    email: "",
    otp: "",
  });
  const [error, setError] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { login, verifyTwoFactor, resendTwoFactor } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const result = await login(form);
      if (result?.two_factor_required) {
        // Show OTP screen
        setOtpForm({ email: result.email, otp: "" });
        setScreen("2fa");
      } else {
        // Login successful, navigate
        navigate(resolveHomeRoute(result));
      }
    } catch (err) {
      setError(err.message || "Invalid credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handle2FASubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const profile = await verifyTwoFactor(otpForm);
      navigate(resolveHomeRoute(profile));
    } catch (err) {
      setError(err.message || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setError("");
    setIsLoading(true);
    try {
      await resendTwoFactor(otpForm.email);
      setError(""); // Clear any previous error
      alert("OTP resent to your email");
    } catch (err) {
      setError(err.message || "Failed to resend OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    setError("");
    setGoogleError("");
    setIsLoading(true);
    try {
      const response = await authenticateWithGoogle(
        credentialResponse.credential,
        "PRIVATE"
      );
      setTokens(response.access, response.refresh);
      navigate(resolveHomeRoute(response.user));
    } catch (err) {
      setGoogleError(formatGoogleError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setGoogleError("Google sign-in failed. Please try again.");
  };

  if (screen === "2fa") {
    return (
      <div style={{ maxWidth: 380, margin: "60px auto", padding: "20px" }}>
        <div style={{ marginBottom: "30px" }}>
          <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", color: "#0f172a" }}>
            Verify your identity
          </h2>
          <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
            We sent a 6-digit code to your email
          </p>
        </div>

        {error && (
          <div
            style={{
              padding: "12px",
              marginBottom: "16px",
              background: "#fee2e2",
              color: "#991b1b",
              borderRadius: "6px",
              fontSize: "14px",
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handle2FASubmit} style={{ marginBottom: "20px" }}>
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#374151" }}>
              6-digit code
            </label>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              placeholder="------"
              value={otpForm.otp}
              onChange={(e) => setOtpForm({ ...otpForm, otp: e.target.value.replace(/\D/g, "") })}
              disabled={isLoading}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                fontSize: "24px",
                fontWeight: "900",
                letterSpacing: "6px",
                textAlign: "center",
                boxSizing: "border-box",
                background: "#ffffff",
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || otpForm.otp.length !== 6}
            style={{
              width: "100%",
              padding: "12px",
              background: isLoading || otpForm.otp.length !== 6 ? "#9ca3af" : "#0f172a",
              color: "white",
              borderRadius: "8px",
              border: "none",
              fontWeight: "600",
              cursor: isLoading || otpForm.otp.length !== 6 ? "not-allowed" : "pointer",
              fontSize: "14px",
            }}
          >
            {isLoading ? "Verifying..." : "Verify"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <button
            onClick={handleResendOTP}
            disabled={isLoading}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              textDecoration: "underline",
              cursor: isLoading ? "not-allowed" : "pointer",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Didn't receive code? Resend
          </button>
        </div>

        <button
          onClick={() => {
            setScreen("login");
            setError("");
            setOtpForm({ email: "", otp: "" });
          }}
          style={{
            width: "100%",
            padding: "12px",
            background: "#f3f4f6",
            color: "#0f172a",
            borderRadius: "8px",
            border: "none",
            fontWeight: "600",
            cursor: "pointer",
            fontSize: "14px",
          }}
        >
          Back to login
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 380, margin: "60px auto", padding: "20px" }}>
      <div style={{ marginBottom: "30px" }}>
        <h2 style={{ margin: "0 0 8px 0", fontSize: "28px", color: "#0f172a" }}>
          Welcome back
        </h2>
        <p style={{ margin: 0, color: "#6b7280", fontSize: "14px" }}>
          Sign in to manage your finances
        </p>
      </div>

      {error && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {error}
        </div>
      )}

      {googleError && (
        <div
          style={{
            padding: "12px",
            marginBottom: "16px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        >
          {googleError}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: "20px" }}>
        <div style={{ marginBottom: "14px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#374151" }}>
            Email
          </label>
          <input
            placeholder="you@example.com"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            disabled={isLoading}
            required
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              boxSizing: "border-box",
              background: "#ffffff",
            }}
          />
        </div>

        <div style={{ marginBottom: "16px" }}>
          <label style={{ display: "block", marginBottom: "6px", fontWeight: "600", color: "#374151" }}>
            Password
          </label>
          <input
            type="password"
            placeholder="Enter your password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            disabled={isLoading}
            required
            style={{
              width: "100%",
              padding: "12px",
              border: "1px solid #d1d5db",
              borderRadius: "8px",
              fontSize: "14px",
              boxSizing: "border-box",
              background: "#ffffff",
            }}
          />
        </div>

        <div style={{ marginBottom: "16px", textAlign: "right" }}>
          <Link
            to="/auth/forgot-password"
            style={{
              color: "#2563eb",
              textDecoration: "none",
              fontSize: "14px",
              fontWeight: "600",
            }}
          >
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          style={{
            width: "100%",
            padding: "12px",
            background: isLoading ? "#9ca3af" : "#0f172a",
            color: "white",
            borderRadius: "8px",
            border: "none",
            fontWeight: "600",
            cursor: isLoading ? "not-allowed" : "pointer",
            fontSize: "14px",
          }}
        >
          {isLoading ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          margin: "20px 0",
        }}
      >
        <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
        <span style={{ color: "#9ca3af", fontSize: "13px" }}>OR</span>
        <div style={{ flex: 1, height: "1px", background: "#e5e7eb" }} />
      </div>

      <div style={{ marginBottom: "20px" }}>
        <GoogleLogin
          onSuccess={handleGoogleSuccess}
          onError={handleGoogleError}
          width="380"
          text="signin_with"
          theme="light"
          locale="en"
        />
      </div>

      <p style={{ margin: 0, textAlign: "center", color: "#6b7280", fontSize: "14px" }}>
        Don't have an account?{" "}
        <Link
          to="/auth/signup"
          style={{
            color: "#2563eb",
            textDecoration: "none",
            fontWeight: "600",
          }}
        >
          Sign up
        </Link>
      </p>
    </div>
  );
};

export default Login;
