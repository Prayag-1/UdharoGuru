import { Link } from "react-router-dom";

export default function PrivateDashboard() {
  return (
    <div style={{ minHeight: "100vh", background: "#0b0b0b", color: "#fff", padding: 28, fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontWeight: 1000 }}>Private Dashboard</h1>
        <p style={{ color: "rgba(255,255,255,0.7)" }}>
          Simple personal tracking: who owes you, what you owe, reminders, and currency converter.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginTop: 18 }}>
          {["My Balances", "Splitwise-style Groups (later)", "Quick Reminders", "Currency Converter", "Basic OCR (optional)", "Email/SMS nudges (later)"].map((x) => (
            <div key={x} style={{ background: "#111", border: "1px solid #222", borderRadius: 16, padding: 16 }}>
              <div style={{ fontWeight: 900 }}>{x}</div>
              <div style={{ marginTop: 6, color: "rgba(255,255,255,0.65)", fontSize: 13 }}>
                Private mode keeps features focused and lightweight.
                <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
  <Link to="/customers">Customers</Link>
  <Link to="/transactions">Transactions</Link>
</div>

              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
