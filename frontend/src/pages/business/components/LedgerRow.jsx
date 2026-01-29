const gridTemplate = "1.05fr 1fr 1fr 0.8fr 0.9fr 1fr";

export const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "--";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

export const formatDate = (value) => {
  if (!value) return "--";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export function LedgerHeader() {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: gridTemplate,
        padding: "10px 12px",
        fontWeight: 800,
        color: "#0f172a",
        background: "#f8fafc",
        borderBottom: "1px solid #e2e8f0",
      }}
    >
      <span>Date</span>
      <span>Customer</span>
      <span>Amount</span>
      <span>Type</span>
      <span>Source</span>
      <span>Status</span>
    </div>
  );
}

export function LedgerRow({ tx, onSettle, settling = false, onSelectCustomer }) {
  const isCredit = (tx.transaction_type || "").toUpperCase() === "CREDIT";
  const settled = tx.is_settled === true;
  const customer = tx.customer_name || tx.merchant || "Unknown";
  const settledLabel = tx.settled_at ? `Settled ${formatDate(tx.settled_at)}` : "Settled";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: gridTemplate,
        padding: "12px 12px",
        alignItems: "center",
        borderBottom: "1px solid #e2e8f0",
        color: "#0f172a",
        background: settled ? "#f8fafc" : "#ffffff",
        opacity: settled ? 0.82 : 1,
      }}
    >
      <div style={{ fontWeight: 700 }}>{formatDate(tx.transaction_date || tx.created_at)}</div>
      <button
        type="button"
        onClick={() => onSelectCustomer && onSelectCustomer(customer)}
        style={{
          textAlign: "left",
          color: "#334155",
          fontWeight: 700,
          background: "transparent",
          border: "none",
          padding: 0,
          cursor: onSelectCustomer ? "pointer" : "default",
        }}
      >
        {customer}
      </button>
      <div style={{ fontWeight: 900, color: isCredit ? "#15803d" : "#b91c1c" }}>{formatMoney(tx.amount)}</div>
      <div style={{ fontWeight: 800, color: "#475569" }}>{(tx.transaction_type || "").toUpperCase()}</div>
      <div style={{ color: "#64748b", fontWeight: 700 }}>{tx.source || "Manual"}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        <span
          style={{
            padding: "4px 8px",
            borderRadius: 999,
            fontWeight: 800,
            fontSize: 12,
            background: settled ? "#e2e8f0" : "#fef3c7",
            color: settled ? "#334155" : "#92400e",
            border: settled ? "1px solid #cbd5e1" : "1px solid #fcd34d",
            whiteSpace: "nowrap",
          }}
        >
          {settled ? settledLabel : "Outstanding"}
        </span>
        {!settled && onSettle && (
          <button
            type="button"
            onClick={() => onSettle(tx)}
            disabled={settling}
            style={{
              padding: "6px 10px",
              borderRadius: 10,
              border: "1px solid #0f172a",
              background: "#0f172a",
              color: "#ffffff",
              fontWeight: 800,
              cursor: settling ? "not-allowed" : "pointer",
            }}
          >
            {settling ? "Marking..." : "Mark settled"}
          </button>
        )}
      </div>
    </div>
  );
}
