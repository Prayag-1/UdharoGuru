import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import "./Signup.css";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";

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

export default function Signup() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    account_type: "PRIVATE",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { register } = useAuth();

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

  const accountTab = (active) => `tab-toggle ${active ? "tab-active" : ""}`;

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
            UdharoGuru - Business Portal
          </div>
          <h2>Sign up to continue</h2>
          <p className="form-lede">
            Access your dashboard, send reminders, and keep your books accurate every day.
          </p>

          <form onSubmit={handleSubmit} className="signup-form">
            <div className="tab-row">
              <button
                type="button"
                className={accountTab(form.account_type === "PRIVATE")}
                onClick={() => setForm({ ...form, account_type: "PRIVATE" })}
              >
                Personal
              </button>
              <button
                type="button"
                className={accountTab(form.account_type === "BUSINESS")}
                onClick={() => setForm({ ...form, account_type: "BUSINESS" })}
              >
                Business
              </button>
            </div>

            <label className="field">
              <span>Full name *</span>
              <input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Enter your full name"
                required
              />
            </label>

            <label className="field">
              <span>Email *</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@business.com"
                required
              />
            </label>

            <label className="field">
              <span>Password *</span>
              <input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter a strong password"
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
              <Link to="#" className="link-quiet">
                Forgot password?
              </Link>
            </div>

            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Creating account..." : "Sign up"}
            </button>

            {error && <div className="form-error">{error}</div>}
          </form>

          <p className="switch-auth">
            Already have an account?{" "}
            <Link to="/auth/login" className="link-quiet">
              Login
            </Link>
          </p>
        </section>
      </div>
    </div>
  );
}
