import "../../private/PrivateDashboard.css";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });

const formatDate = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function MoneyTransactionRow({ tx, onEdit, onDelete }) {
  const isLent = tx.transaction_type === "LENT";
  return (
    <div className="row-card">
      <div style={{ display: "grid", gap: 4 }}>
        <div style={{ fontWeight: 700 }}>{tx.person_name}</div>
        <div className="muted" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {isLent ? "You lent" : "You borrowed"}
        </div>
      </div>
      <div className="currency" style={{ color: isLent ? "#0b7a34" : "#b91c1c" }}>
        {formatCurrency(tx.amount)}
      </div>
      <div className="muted" style={{ fontSize: 14 }}>{formatDate(tx.transaction_date)}</div>
      <div className="muted" style={{ fontSize: 14, minHeight: 18 }}>
        {tx.note || "—"}
      </div>
      <div className="row-actions">
        <button className="button secondary" type="button" onClick={() => onEdit(tx)}>
          Edit
        </button>
        <button className="button danger" type="button" onClick={() => onDelete(tx)}>
          Delete
        </button>
      </div>
    </div>
  );
}
