import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import VerificationCodeCard from "./VerificationCodeCard";
import "./Signup.css";

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail, resendEmailVerification } = useAuth();

  const [email, setEmail] = useState(location.state?.email || "");
  const [otp, setOtp] = useState("");
  const [status, setStatus] = useState(location.state?.message || "We sent a 6-digit code to your email.");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (location.state?.email) {
      setEmail(location.state.email);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const profile = await verifyEmail({ email, otp });
      navigate(resolveHomeRoute(profile), { replace: true });
    } catch (err) {
      setError(err.message || "Verification failed. Check the code or request a new one.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await resendEmailVerification(email);
      setStatus("Verification code sent to your email.");
    } catch (err) {
      setError(err.message || "Failed to resend code. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <VerificationCodeCard
      title="Verification Code"
      subtitle={`Enter the 6-digit code we sent to ${email || "your email"} to activate your account.`}
      code={otp}
      onCodeChange={setOtp}
      onSubmit={handleSubmit}
      onResend={handleResend}
      onBack={() => navigate("/auth/signup")}
      status={status}
      error={error}
      submitting={submitting}
      resendLabel="Resend"
      submitLabel="Confirm Code"
    />
  );
}
