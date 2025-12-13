import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { login } from "../../api/auth";

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    gridTemplateColumns: "1.2fr 1fr",
    background: "radial-gradient(1200px 800px at 10% 10%, #111 0%, #0b0b0b 45%, #070707 100%)",
    color: "#fff",
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
  },
  left: {
    padding: "60px 56px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
  },
  brand: { fontSize: 28, fontWeight: 800, letterSpacing: 0.2 },
  tagline: { marginTop: 10, color: "rgba(255,255,255,0.75)", lineHeight: 1.5, maxWidth: 520 },
  bullets: { marginTop: 22, display: "grid", gap: 10, color: "rgba(255,255,255,0.8)" },
  bullet: { display: "flex", gap: 10, alignItems: "flex-start" },
  dot: { width: 10, height: 10, borderRadius: 999, background: "rgba(255,255,255,0.35)", marginTop: 6 },
  footer: { color: "rgba(255,255,255,0.55)", fontSize: 12 },
  right: {
    padding: "60px 56px",
    background: "linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.03) 100%)",
    borderLeft: "1px solid rgba(255,255,255,0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 26,
    borderRadius: 18,
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(255,255,255,0.10)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
    backdropFilter: "blur(10px)",
  },
  title: { fontSize: 22, fontWeight: 800, marginBottom: 6 },
  sub: { color: "rgba(255,255,255,0.70)", marginBottom: 18, fontSize: 13, lineHeight: 1.5 },
  seg: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 16,
  },
  segBtn: (active) => ({
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
    cursor: "pointer",
    fontWeight: 700,
    color: "#fff",
  }),
  label: { fontSize: 12, color: "rgba(255,255,255,0.70)", marginBottom: 8 },
  input: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    outline: "none",
  },
  row: { display: "grid", gap: 12, marginBottom: 14 },
  btn: {
    width: "100%",
    padding: "12px 12px",
    borderRadius: 12,
    border: "none",
    background: "#fff",
    color: "#000",
    fontWeight: 900,
    cursor: "pointer",
  },
  hint: { marginTop: 12, fontSize: 12, color: "rgba(255,255,255,0.65)" },
  error: { marginTop: 10, color: "#ff6b6b", fontSize: 12, fontWeight: 700 },
};

export default function AuthShell() {
  const [accountType, setAccountType] = useState("private"); // private | business
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const typeCopy = useMemo(() => {
    if (accountType === "business") {
      return "Business accounts unlock OCR, inventory-style udharo tracking, loan tracking, and team-ready workflows. KYC required.";
    }
    return "Private accounts focus on simple lending, Splitwise-like tracking, reminders, and quick currency conversion.";
  }, [accountType]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const res = await login(form);
      localStorage.setItem("access_token", res.data.access);
      localStorage.setItem("refresh_token", res.data.refresh);

      // Demo-state for tomorrow (until backend profile endpoints are ready)
      localStorage.setItem("account_type", accountType);

      if (accountType === "business") {
        // If KYC already submitted, take them to pending/dashboard based on status
        const kycStatus = localStorage.getItem("kyc_status") || "not_submitted";
        if (kycStatus === "verified") navigate("/business/dashboard");
        else if (kycStatus === "pending") navigate("/business/pending");
        else navigate("/business/kyc");
      } else {
        navigate("/private/dashboard");
      }
    } catch (err) {
      setError("Invalid credentials. Check username/password.");
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.left}>
        <div>
          <div style={styles.brand}>UdharoGuru</div>
          <div style={styles.tagline}>
            Track udharo like a pro. Two modes, one platform:{" "}
            <b>Private</b> for personal tracking and reminders, <b>Business</b> for OCR-led ledgers, inventory-style udharo, and loan workflows.
          </div>

          <div style={styles.bullets}>
            <div style={styles.bullet}><span style={styles.dot} />Secure JWT login + user-scoped data</div>
            <div style={styles.bullet}><span style={styles.dot} />Analytics-ready backend (outstanding, top debtors, monthly summaries)</div>
            <div style={styles.bullet}><span style={styles.dot} />OCR pipeline ready for receipts and bills</div>
          </div>
        </div>

        <div style={styles.footer}>Demo build. KYC verification shown as realistic flow; admin verification hooks can be added next.</div>
      </div>

      <div style={styles.right}>
        <div style={styles.card}>
          <div style={styles.title}>Welcome back</div>
          <div style={styles.sub}>{typeCopy}</div>

          <div style={styles.seg}>
            <button style={styles.segBtn(accountType === "private")} onClick={() => setAccountType("private")} type="button">
              Private
            </button>
            <button style={styles.segBtn(accountType === "business")} onClick={() => setAccountType("business")} type="button">
              Business
            </button>
          </div>

          <form onSubmit={onSubmit}>
            <div style={styles.row}>
              <div>
                <div style={styles.label}>Username</div>
                <input
                  style={styles.input}
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  placeholder="Enter username"
                />
              </div>

              <div>
                <div style={styles.label}>Password</div>
                <input
                  style={styles.input}
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Enter password"
                />
              </div>
            </div>

            <button style={styles.btn} type="submit">
              Continue
            </button>

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.hint}>
              Business accounts require KYC verification by admin before unlocking all features.
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
