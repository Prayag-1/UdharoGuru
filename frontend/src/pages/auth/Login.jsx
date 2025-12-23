import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

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
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Enter password"
                required
              />
            </label>

            <div className="form-meta">
              <label className="checkbox">
                <input type="checkbox" />
                <span>Keep me signed in</span>
              </label>
              <Link to="#" className="link-quiet">
                Forgot password?
              </Link>
            </div>

            <button className="primary-btn" type="submit" disabled={submitting}>
              {submitting ? "Processing..." : "Sign in"}
            </button>

            {error && <div className="form-error">{error}</div>}
          </form>

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
