import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthLayout from "./AuthLayout";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

const inputStyle = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#0f172a",
  outline: "none",
  textAlign: "center",
  letterSpacing: 6,
  fontWeight: 900,
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

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail } = useAuth();

  const [email, setEmail] = useState(location.state?.email || "");
  const [code, setCode] = useState("");
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
    setStatus("");
    setSubmitting(true);
    try {
      const profile = await verifyEmail({ email, code });
      const redirectTo = profile ? resolveHomeRoute(profile) : "/auth/login";
      navigate(redirectTo, { replace: true, state: { message: "Email verified. You can now log in." } });
    } catch (err) {
      setError(err.message || "Verification failed. Check the code or request a new one.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Verify your email"
      subtitle="Enter the 6-digit code we sent to your email to activate your account."
      footer={
        <>
          Need an account? <Link to="/auth/signup" style={{ color: "#1d4ed8", fontWeight: 700 }}>Go to signup</Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        {status && (
          <div style={{ padding: 12, borderRadius: 10, background: "#ecfdf3", border: "1px solid #bbf7d0", color: "#15803d", fontWeight: 700 }}>
            {status}
          </div>
        )}

        <div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 }}>Email</div>
          <input
            style={{ ...inputStyle, letterSpacing: 0, textAlign: "left" }}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 }}>6-digit code</div>
          <input
            style={inputStyle}
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            placeholder="------"
            required
          />
        </div>

        <button style={{ ...btnStyle, opacity: submitting ? 0.7 : 1 }} type="submit" disabled={submitting}>
          {submitting ? "Verifying..." : "Verify email"}
        </button>

        {error && <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div>}
      </form>
    </AuthLayout>
  );
}
