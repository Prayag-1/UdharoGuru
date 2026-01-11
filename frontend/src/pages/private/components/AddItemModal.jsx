import { useEffect, useState } from "react";

import "../../private/PrivateDashboard.css";

const today = () => new Date().toISOString().slice(0, 10);

export default function AddItemModal({ open, onClose, onSubmit, connections = [], submitting }) {
  const [borrower, setBorrower] = useState("");
  const [itemName, setItemName] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [reminderInterval, setReminderInterval] = useState(3);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setBorrower("");
      setItemName("");
      setItemDescription("");
      setExpectedReturnDate("");
      setReminderInterval(3);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!borrower) {
      setError("Borrower is required.");
      return;
    }
    if (!itemName.trim()) {
      setError("Item name is required.");
      return;
    }
    try {
      await onSubmit({
        borrower,
        item_name: itemName.trim(),
        item_description: itemDescription.trim() || null,
        lent_date: today(),
        expected_return_date: expectedReturnDate || null,
        reminder_interval_days: Number(reminderInterval) || 3,
      });
    } catch (err) {
      setError(err?.message || "Unable to save item.");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSubmit}>
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Lend an Item</div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="form-grid">
          <label className="label">
            Borrower
            <select
              className="select"
              value={borrower}
              onChange={(e) => setBorrower(e.target.value)}
              required
            >
              <option value="">Select a connection</option>
              {connections.map((conn) => {
                const target = conn.connected_user || conn;
                const label = target.full_name
                  ? `${target.full_name} (${target.email || target.invite_code})`
                  : target.email || target.invite_code || `User ${target.id}`;
                return (
                  <option key={target.id} value={target.id}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>

          <label className="label">
            Item name
            <input
              className="input"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
            />
          </label>

          <label className="label">
            Description
            <textarea
              className="textarea"
              value={itemDescription}
              onChange={(e) => setItemDescription(e.target.value)}
              placeholder="Optional"
            />
          </label>

          <label className="label">
            Expected return date
            <input
              className="input"
              type="date"
              value={expectedReturnDate}
              onChange={(e) => setExpectedReturnDate(e.target.value)}
            />
          </label>

          <label className="label">
            Reminder interval (days)
            <input
              className="input"
              type="number"
              min="1"
              value={reminderInterval}
              onChange={(e) => setReminderInterval(e.target.value)}
              required
            />
          </label>
        </div>

        {error && <div className="error-text">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="button secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Save Item"}
          </button>
        </div>
      </form>
    </div>
  );
}
