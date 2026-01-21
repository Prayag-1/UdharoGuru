import { useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";

const features = [
  { name: "OCR Upload", desc: "Scan receipts and extract udharo automatically.", cta: "/business/ocr" },
  { name: "Inventory Udharo", desc: "Track items given on credit." },
  { name: "Loan Ledger", desc: "Manage business loans and repayments." },
  { name: "Top Debtors", desc: "Identify customers with highest outstanding." },
  { name: "Monthly Summary", desc: "Credit vs debit analytics." },
  { name: "Reminder Automations", desc: "Auto reminders via SMS / Email." },
];

export default function BusinessDashboard() {
  const { user } = useAuth();
  useBusinessGate("/business/dashboard");
  const verified = user?.business_status === "APPROVED";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0b",
        color: "#fff",
        padding: 28,
        fontFamily: "Inter, system-ui",
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontWeight: 1000 }}>Business Dashboard</h1>

        <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
          {verified
            ? "Verified business account. All advanced features are unlocked."
            : "Business verification pending. Your admin team can approve KYC to unlock advanced features."}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 12,
            marginTop: 20,
          }}
        >
          {features.map((f) => (
            <div
              key={f.name}
              style={{
                background: "#111",
                border: "1px solid #222",
                borderRadius: 16,
                padding: 16,
                opacity: verified ? 1 : 0.45,
                pointerEvents: verified ? "auto" : "none",
                transition: "opacity 0.2s ease",
              }}
              >
                <div style={{ fontWeight: 900 }}>{f.name}</div>

              <div
                style={{
                  marginTop: 6,
                  color: "rgba(255,255,255,0.65)",
                  fontSize: 13,
                  lineHeight: 1.4,
                }}
              >
                {f.desc}
              </div>

              <div
                style={{
                  marginTop: 10,
                  fontSize: 12,
                  fontWeight: 800,
                  color: verified ? "#6ee7b7" : "#fbbf24",
                }}
              >
                {verified ? "Enabled" : "Requires verification"}
              </div>
              {verified && f.cta && (
                <a
                  href={f.cta}
                  style={{
                    marginTop: 10,
                    display: "inline-flex",
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid #1f2937",
                    background: "#0f172a",
                    color: "#e2e8f0",
                    fontWeight: 800,
                    textDecoration: "none",
                  }}
                >
                  Open
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
