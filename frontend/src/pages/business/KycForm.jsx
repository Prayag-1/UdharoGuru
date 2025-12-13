import { useNavigate } from "react-router-dom";

const s = {
  wrap: { minHeight: "100vh", padding: 28, background: "#0b0b0b", color: "#fff", fontFamily: "Inter, system-ui" },
  card: { maxWidth: 760, margin: "0 auto", background: "#111", border: "1px solid #222", borderRadius: 16, padding: 22 },
  h1: { fontSize: 22, fontWeight: 900, marginBottom: 6 },
  p: { color: "rgba(255,255,255,0.7)", marginBottom: 18 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  input: { padding: 12, borderRadius: 12, border: "1px solid #2a2a2a", background: "#0d0d0d", color: "#fff" },
  full: { gridColumn: "1 / -1" },
  btnRow: { marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" },
  btn: { padding: "12px 14px", borderRadius: 12, border: "none", cursor: "pointer", fontWeight: 900 },
  primary: { background: "#fff", color: "#000" },
  ghost: { background: "#1b1b1b", color: "#fff", border: "1px solid #2a2a2a" },
};

export default function KycForm() {
  const navigate = useNavigate();

  const submitKyc = (e) => {
    e.preventDefault();

    // Demo state for tomorrow. Later this will be POST /api/kyc/submit/
    localStorage.setItem("kyc_status", "pending");
    navigate("/business/pending");
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.h1}>Business KYC</div>
        <div style={s.p}>
          Submit business details for verification. After approval, OCR + advanced features unlock.
        </div>

        <form onSubmit={submitKyc}>
          <div style={s.grid}>
            <input style={s.input} placeholder="Business Name" required />
            <input style={s.input} placeholder="PAN / Registration No." required />
            <input style={s.input} placeholder="Owner Full Name" required />
            <input style={s.input} placeholder="Owner Phone" required />
            <input style={{ ...s.input, ...s.full }} placeholder="Business Address" required />
            <input style={{ ...s.input, ...s.full }} placeholder="Upload document later (demo)" disabled />
          </div>

          <div style={s.btnRow}>
            <button type="button" style={{ ...s.btn, ...s.ghost }} onClick={() => navigate("/auth")}>
              Back
            </button>
            <button type="submit" style={{ ...s.btn, ...s.primary }}>
              Submit for Verification
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
