import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { getBusinessLedger } from "../../api/business";

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function IncomePage() {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState([]);
  const [success, setSuccess] = useState(location.state?.success || "");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const { data } = await getBusinessLedger();
        const list = Array.isArray(data) ? data : data?.results || [];
        setRows(list);
      } catch {
        setError("Unable to load income records right now.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const incomeRows = useMemo(
    () => rows.filter((row) => row.transaction_type === "DEBIT"),
    [rows]
  );

  return (
    <div style={{ padding: "28px 26px", maxWidth: 1100, margin: "0 auto", fontFamily: "Inter, system-ui" }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Income</div>
        <div style={{ color: "#475569" }}>OCR and manual inflow records tracked separately from Credit Sales.</div>
      </div>

      {success && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #bbf7d0", background: "#ecfdf3", color: "#166534", fontWeight: 700 }}>
          {success}
        </div>
      )}

      {error && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 16, background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, height: 180 }} />
      ) : incomeRows.length === 0 ? (
        <div style={{ marginTop: 16, padding: 24, border: "1px dashed #cbd5e1", borderRadius: 12, background: "#f8fafc", textAlign: "center", color: "#475569" }}>
          No income records yet.
        </div>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1.2fr", padding: "10px 12px", fontWeight: 800, color: "#1e293b", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12 }}>
            <span>Date</span>
            <span>Customer</span>
            <span>Amount</span>
            <span>Source / Note</span>
          </div>
          {incomeRows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr 1.2fr",
                padding: "12px 12px",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                background: "#ffffff",
                color: "#0f172a",
                alignItems: "center",
                gap: 8,
              }}
            >
              <div style={{ fontWeight: 800 }}>{row.transaction_date}</div>
              <div style={{ fontWeight: 700 }}>{row.customer_name || row.merchant || "Unknown"}</div>
              <div style={{ fontWeight: 900, color: "#059669" }}>Rs. {formatMoney(row.amount)}</div>
              <div>
                <div style={{ fontWeight: 700 }}>{row.source}</div>
                <div style={{ color: "#64748b", fontSize: 13 }}>{row.note || "No note"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
