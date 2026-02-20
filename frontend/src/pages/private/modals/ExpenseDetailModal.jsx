import "../../private/PrivateDashboard.css";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const parseSplitMeta = (note, amount) => {
  const percentMatch = note?.match(/Split\s+([\d.]+)%/i);
  const totalMatch = note?.match(/Total\s+\$?([\d,]+(?:\.\d+)?)/i);
  const friendPercent = percentMatch ? Number(percentMatch[1]) : null;
  const total = totalMatch ? Number(totalMatch[1].replace(/,/g, "")) : null;
  if (total && !Number.isNaN(total)) {
    const pct = friendPercent || (amount && total ? (amount / total) * 100 : null);
    return { total, friendPercent: pct };
  }
  if (friendPercent && amount) {
    const derivedTotal = (amount / friendPercent) * 100;
    return { total: derivedTotal, friendPercent };
  }
  return { total: null, friendPercent };
};

export default function ExpenseDetailModal({ open, onClose, expense }) {
  if (!open || !expense) return null;
  const isLent = expense.transaction_type === "LENT";
  const { total, friendPercent } = parseSplitMeta(expense.note, Number(expense.amount));
  const friendShare = Number(expense.amount || 0);
  const computedTotal = total || (friendPercent ? (friendShare / friendPercent) * 100 : null);
  const yourShare = computedTotal ? Math.max(0, computedTotal - friendShare) : null;
  const pctFriend = Math.min(100, Math.max(0, friendPercent || (computedTotal ? (friendShare / computedTotal) * 100 : 0)));
  const pctYou = Math.max(0, 100 - pctFriend);
  const yourPercent = pctYou;

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

          {(computedTotal || friendPercent) && (
            <>
              <div className="label">Split</div>
              <div className="split-visual">
                <div className="split-bar-track">
                  <div className="split-bar-fill them" style={{ width: `${pctFriend}%` }} />
                  <div className="split-bar-fill you" style={{ width: `${pctYou}%` }} />
                </div>
                <div className="split-legend">
                  <div>
                    <span className="bar-dot" style={{ background: "#4f7cf8" }} /> Them: {pctFriend.toFixed(1)}%
                    {computedTotal && ` (${formatCurrency(friendShare)})`}
                  </div>
                  {computedTotal && (
                    <div>
                      <span className="bar-dot" style={{ background: "#22c55e" }} /> You: {yourPercent.toFixed(1)}%
                      {yourShare !== null && ` (${formatCurrency(yourShare)})`}
                    </div>
                  )}
                  {computedTotal && (
                    <div className="muted" style={{ fontSize: 12 }}>
                      Total expense: {formatCurrency(computedTotal)}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
