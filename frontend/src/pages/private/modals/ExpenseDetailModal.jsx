import "../../private/PrivateDashboard.css";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function ExpenseDetailModal({ open, onClose, expense }) {
  if (!open || !expense) return null;
  const isLent = expense.transaction_type === "LENT";
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Expense details</div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="form-grid">
          <div className="label">Person</div>
          <div>{expense.person_name}</div>

          <div className="label">Description</div>
          <div className="muted">{expense.note || "No note"}</div>

          <div className="label">Type</div>
          <div className="pill" style={{ background: isLent ? "#e0f7e9" : "#fde2e4", color: isLent ? "#065f46" : "#7f1d1d" }}>
            {isLent ? "You lent" : "You borrowed"}
          </div>

          <div className="label">Amount</div>
          <div className="currency" style={{ color: isLent ? "#0b7a34" : "#b91c1c" }}>{formatCurrency(expense.amount)}</div>

          <div className="label">Date</div>
          <div>{formatDate(expense.transaction_date)}</div>
        </div>
      </div>
    </div>
  );
}
