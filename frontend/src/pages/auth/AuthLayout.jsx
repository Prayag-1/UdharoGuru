import logo from "../../assets/LOGO.png";

export default function AuthLayout({ title, subtitle, children, footer }) {
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
        fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      <div style={{ width: "100%", maxWidth: "420px", margin: "0 auto" }}>
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            padding: 24,
            border: "1px solid #e5e7eb",
            boxShadow: "0 16px 40px rgba(15,23,42,0.12)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <img src={logo} alt="Udharo Guru" style={{ width: 48, height: 48, objectFit: "contain" }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#0f172a" }}>{title}</div>
              {subtitle && <div style={{ color: "#475569", marginTop: 4, fontSize: 14 }}>{subtitle}</div>}
            </div>
          </div>
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>{children}</div>
          {footer && <div style={{ marginTop: 16, color: "#475569", textAlign: "center", fontSize: 14 }}>{footer}</div>}
        </div>
      </div>
    </div>
  );
}
