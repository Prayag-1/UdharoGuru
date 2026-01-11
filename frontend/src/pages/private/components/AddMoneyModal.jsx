import { useEffect, useMemo, useState } from "react";

import "../../private/PrivateDashboard.css";

const today = () => new Date().toISOString().slice(0, 10);

export default function AddMoneyModal({ open, onClose, onSubmit, initialData, submitting }) {
  const [personName, setPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [transactionType, setTransactionType] = useState("LENT");
  const [transactionDate, setTransactionDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setPersonName(initialData.person_name || "");
      setAmount(initialData.amount ?? "");
      setTransactionType(initialData.transaction_type || "LENT");
      setTransactionDate(initialData.transaction_date || today());
      setNote(initialData.note || "");
    } else {
      setPersonName("");
      setAmount("");
      setTransactionType("LENT");
      setTransactionDate(today());
      setNote("");
    }
    setError(null);
  }, [initialData, open]);

  const isEdit = useMemo(() => Boolean(initialData), [initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!personName.trim()) {
      setError("Person name is required.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    try {
      await onSubmit({
        person_name: personName.trim(),
        amount,
        transaction_type: transactionType,
        transaction_date: transactionDate,
        note: note.trim() || null,
      });
    } catch (err) {
      setError(err?.message || "Unable to save transaction.");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{isEdit ? "Edit Transaction" : "Add Transaction"}</div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="form-grid">
          <label className="label">
            Person name
            <input
              className="input"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
              required
            />
          </label>

          <label className="label">
            Amount
            <input
              className="input"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </label>

          <label className="label">
            Type
            <select
              className="select"
              value={transactionType}
              onChange={(e) => setTransactionType(e.target.value)}
            >
              <option value="LENT">Lent</option>
              <option value="BORROWED">Borrowed</option>
            </select>
          </label>

          <label className="label">
            Date
            <input
              className="input"
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              required
            />
          </label>

          <label className="label">
            Note
            <textarea
              className="textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Optional"
            />
          </label>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="button secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save Changes" : "Add Transaction"}
          </button>
        </div>
      </form>
    </div>
  );
}
