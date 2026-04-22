import { useState } from "react";

import "../../private/PrivateDashboard.css";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("ne-NP", { style: "currency", currency: "NPR", minimumFractionDigits: 2 });

export default function QuickSettleModal({ open, onClose, expense, onSubmit, submitting }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);

  if (!open || !expense) return null;

  const defaultAmount = Number(expense.amount || 0);
  const displayAmount = amount || defaultAmount;
  const isLent = expense.transaction_type === "LENT";
  const direction = isLent ? "owed_to_you" : "you_owe";
  const directionLabel = isLent ? "They owe you" : "You owe them";

  const handleSave = async () => {
    const settleAmount = Number(amount || defaultAmount);
    if (settleAmount <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    try {
      await onSubmit({
        personName: expense.person_name,
        amount: settleAmount,
        direction,
      });
      setAmount("");
      setError(null);
      onClose();
    } catch (err) {
      setError(err?.message || "Unable to record settlement.");
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Record settlement</div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="form-grid">
          <div className="label">Person</div>
          <div>{expense.person_name}</div>

          <div className="label">Settlement Type</div>
          <div className="pill" style={{ background: isLent ? "#e0f7e9" : "#fde2e4", color: isLent ? "#065f46" : "#7f1d1d" }}>
            {directionLabel}
          </div>

          <label className="label">
            Amount
            <input
              className="input"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              placeholder={formatCurrency(defaultAmount)}
              onChange={(e) => {
                setAmount(e.target.value);
                setError(null);
              }}
              autoFocus
            />
          </label>

          <div style={{ fontSize: 12, color: "#6b7280", marginTop: -8 }}>
            Original expense: {formatCurrency(defaultAmount)}
          </div>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="button secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="button"
            type="button"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? "Recording..." : "Record settlement"}
          </button>
        </div>
      </div>
    </div>
  );
}
