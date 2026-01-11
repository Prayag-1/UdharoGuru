import { useMemo, useState } from "react";

import "../../private/PrivateDashboard.css";

const today = () => new Date().toISOString().slice(0, 10);

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export default function AddExpenseModal({ open, onClose, onSave, connections = [], submitting }) {
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [borrower, setBorrower] = useState("");
  const [date, setDate] = useState(today());
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);

  const borrowerOptions = useMemo(
    () =>
      connections.map((conn) => {
        const target = conn.connected_user || {};
        const id = conn.connected_user_id || target.id || conn.id;
        const email = conn.connected_user_email || target.email || conn.email;
        const name = target.full_name || conn.full_name;
        return { id, label: name ? `${name} (${email || "no email"})` : email || `User ${id}` };
      }),
    [connections]
  );

  const reset = () => {
    setDescription("");
    setAmount("");
    setBorrower("");
    setDate(today());
    setStep(1);
    setError(null);
  };

  const handleNext = (e) => {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (!borrower) {
      setError("Select a borrower.");
      return;
    }
    setStep(2);
  };

  const handleSave = async () => {
    setError(null);
    try {
      await onSave({
        description: description.trim(),
        amount: Number(amount),
        borrower,
        date,
      });
      reset();
    } catch (err) {
      setError(err?.message || "Unable to save expense.");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>
            {step === 1 ? "Add an expense" : "Confirm expense"}
          </div>
          <button className="button secondary" type="button" onClick={() => { reset(); onClose(); }}>
            Close
          </button>
        </div>

        {step === 1 ? (
          <form className="form-grid" onSubmit={handleNext}>
            <label className="label">
              Description
              <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} required />
            </label>
            <label className="label">
              Amount
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </label>
            <label className="label">
              Borrower
              <select className="select" value={borrower} onChange={(e) => setBorrower(e.target.value)} required>
                <option value="">Select a friend</option>
                {borrowerOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Date
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <div className="label">Paid by: You</div>
            {error && <div className="error-text">{error}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="button secondary" type="button" onClick={() => { reset(); onClose(); }}>
                Cancel
              </button>
              <button className="button" type="submit" disabled={submitting}>
                Next
              </button>
            </div>
          </form>
        ) : (
          <div className="form-grid">
            <div className="section-card" style={{ background: "#f9fafb", borderStyle: "dashed" }}>
              <div className="card-title">You paid for</div>
              <div style={{ marginTop: 6, fontWeight: 800 }}>{borrowerOptions.find((b) => String(b.id) === String(borrower))?.label}</div>
              <div className="muted" style={{ marginTop: 6 }}>{description}</div>
              <div className="currency" style={{ marginTop: 10 }}>{formatCurrency(amount)}</div>
              <div className="muted" style={{ marginTop: 6 }}>Date: {date}</div>
            </div>
            {error && <div className="error-text">{error}</div>}
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <button className="button secondary" type="button" onClick={() => setStep(1)} disabled={submitting}>
                Back
              </button>
              <button className="button" type="button" onClick={handleSave} disabled={submitting}>
                {submitting ? "Saving..." : "Save expense"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
