import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

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

const accountTab = (active) => ({
  padding: "12px 14px",
  borderRadius: 10,
  border: active ? "2px solid #2563eb" : "1px solid #cbd5e1",
  background: active ? "rgba(37,99,235,0.08)" : "#f8fafc",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
});

export default function Signup() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    account_type: "PRIVATE",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

  const isBusiness = form.account_type === "BUSINESS";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const profile = await register(form);
      navigate(resolveHomeRoute(profile), { replace: true });
    } catch (err) {
      setError(err.message || "Signup failed. Please check your details and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const businessPanel = (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        padding: 16,
        display: "grid",
        gap: 12,
      }}
    >
      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>At just Rs 18,000 / year</div>
      <div style={{ color: "#475569", lineHeight: 1.5 }}>
        Business onboarding with analytics-ready workflows, KYC-aware routing, and priority support. Payments shown below are visual only.
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ fontWeight: 700, color: "#0f172a" }}>Accepted wallets (UI only)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["eSewa", "Khalti", "FonePay", "IME Pay"].map((name) => (
            <span
              key={name}
              style={{
                padding: "6px 10px",
                borderRadius: 10,
                border: "1px solid #e5e7eb",
                background: "#fff",
                color: "#0f172a",
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {["Priority review within 24h", "KYC-aware dashboards", "OCR-ready ledger exports"].map((item) => (
          <div key={item} style={{ color: "#475569", fontWeight: 600, display: "flex", gap: 6 }}>
            <span style={{ color: "#22c55e" }}>•</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
      <button
        type="button"
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          border: "1px solid #cbd5e1",
          background: "#2563eb",
          color: "#fff",
          fontWeight: 800,
          cursor: "default",
        }}
        disabled
      >
        UI-only payment placeholder
      </button>
    </div>
  );

  const formFields = (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
        <button
          type="button"
          style={accountTab(form.account_type === "PRIVATE")}
          onClick={() => setForm({ ...form, account_type: "PRIVATE" })}
        >
          Personal
        </button>
        <button
          type="button"
          style={accountTab(form.account_type === "BUSINESS")}
          onClick={() => setForm({ ...form, account_type: "BUSINESS" })}
        >
          Business
        </button>
      </div>

      <div>
        <div style={{ fontSize: 12, color: "#475569", marginBottom: 6, fontWeight: 700 }}>Full name</div>
        <input
          style={inputStyle}
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          placeholder="Enter your full name"
          required
        />
      </div>

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
          placeholder="Enter password (min 8 characters)"
          required
        />
      </div>

      <button style={{ ...btnStyle, opacity: submitting ? 0.7 : 1 }} type="submit" disabled={submitting}>
        {submitting ? "Creating account..." : "Sign up"}
      </button>

      {error && <div style={{ color: "#b91c1c", fontWeight: 800 }}>{error}</div>}
    </>
  );

  if (!isBusiness) {
    return (
      <AuthLayout
        title="Create your account"
        subtitle="Choose Personal or Business. No verification required."
        footer={
          <>
            Already registered? <Link to="/auth/login" style={{ color: "#2563eb", fontWeight: 700 }}>Back to login</Link>
          </>
        }
      >
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          {formFields}
        </form>
      </AuthLayout>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "flex-start",
        paddingTop: "40px",
        background: "#e8f1ff",
        fontFamily: "Inter, system-ui",
      }}
    >
      <div style={{ width: "100%", maxWidth: "900px", margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            border: "1px solid #e5e7eb",
            boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 16,
            padding: 16,
          }}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>Create your account</div>
            <div style={{ color: "#475569" }}>Business signup with a quick preview of pricing and benefits.</div>
            <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
              {formFields}
            </form>
          </div>
          <div>{businessPanel}</div>
        </div>
      </div>
    </div>
  );
}
