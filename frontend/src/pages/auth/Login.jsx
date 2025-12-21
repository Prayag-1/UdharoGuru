import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import AuthLayout from "./AuthLayout";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

const inputStyle = {
  width: "100%",
  padding: "12px 12px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#f8fafc",
  color: "#0f172a",
  outline: "none",
};

const btnStyle = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 10,
  border: "none",
  background: "#2563eb",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
};

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    if (location.state?.message) {
      setStatus(location.state.message);
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setStatus("");
    setSubmitting(true);
    try {
      const profile = await login(form);
      navigate(resolveHomeRoute(profile), { replace: true });
    } catch (err) {
      const message = err.message || "Login failed.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Login to Udharo Guru"
      subtitle="Use your email and password to access your workspace."
      footer={
        <>
          New here? <Link to="/auth/signup" style={{ color: "#2563eb", fontWeight: 700 }}>Create an account</Link>
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
            style={inputStyle}
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            required
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 }}>Password</div>
          <input
            style={inputStyle}
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="Enter password"
            required
          />
        </div>

        <button style={{ ...btnStyle, opacity: submitting ? 0.7 : 1 }} type="submit" disabled={submitting}>
          {submitting ? "Processing..." : "Login"}
        </button>

        {error && <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div>}
      </form>
    </AuthLayout>
  );
}
