import { useMemo, useState } from "react";

import "../../private/PrivateDashboard.css";

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("ne-NP", { style: "currency", currency: "NPR", minimumFractionDigits: 2 });

export default function SettleUpModal({ open, onClose, connections = [], balances = {}, onSubmit, submitting }) {
  const payableOptions = useMemo(() => {
    return connections
      .map((conn) => {
        const target = conn.connected_user || {};
        const id = conn.connected_user_id || target.id || conn.id;
        const email = conn.connected_user_email || target.email || conn.email;
        const balance = balances[id] || 0;
        return { id, email, balance };
      })
      .filter((c) => c.balance < 0);
  }, [balances, connections]);

  const receivableOptions = useMemo(() => {
    return connections
      .map((conn) => {
        const target = conn.connected_user || {};
        const id = conn.connected_user_id || target.id || conn.id;
        const email = conn.connected_user_email || target.email || conn.email;
        const balance = balances[id] || 0;
        return { id, email, balance };
      })
      .filter((c) => c.balance > 0);
  }, [balances, connections]);

  const [selected, setSelected] = useState(null);
  const [selectedBalance, setSelectedBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState(null);

  const handleChoose = (id, balance) => {
    setSelected(id);
    setSelectedBalance(balance || 0);
    setAmount(Math.abs(balance || 0));
    setError(null);
  };

  const handleSave = async () => {
    if (!selected) {
      setError("Select a friend to settle with.");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    try {
      const direction = selectedBalance < 0 ? "you_owe" : "owed_to_you";
      await onSubmit({ connectionId: selected, amount: Number(amount), direction });
      setSelected(null);
      setSelectedBalance(0);
      setAmount("");
      setError(null);
    } catch (err) {
      setError(err?.message || "Unable to record settlement.");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Settle up</div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        {payableOptions.length === 0 && receivableOptions.length === 0 ? (
          <div className="empty-state">No balances to settle right now.</div>
        ) : (
          <div className="form-grid">
            {payableOptions.length > 0 && (
              <>
                <div className="label">You owe</div>
                <div className="list">
                  {payableOptions.map((p) => (
                    <label
                      key={p.id}
                      className="row-card"
                      style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }}
                      onClick={() => handleChoose(p.id, p.balance)}
                    >
                      <span>{p.email || `User ${p.id}`}</span>
                      <span className="currency" style={{ color: "#b91c1c" }}>
                        {formatCurrency(Math.abs(p.balance))}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}

            {receivableOptions.length > 0 && (
              <>
                <div className="label">Owed to you</div>
                <div className="list">
                  {receivableOptions.map((p) => (
                    <label
                      key={p.id}
                      className="row-card"
                      style={{ gridTemplateColumns: "1fr auto", cursor: "pointer" }}
                      onClick={() => handleChoose(p.id, p.balance)}
                    >
                      <span>{p.email || `User ${p.id}`}</span>
                      <span className="currency" style={{ color: "#0b7a34" }}>
                        {formatCurrency(Math.abs(p.balance))}
                      </span>
                    </label>
                  ))}
                </div>
              </>
            )}

            <label className="label">
              Amount
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={!selected}
              />
            </label>
          </div>
        )}

        {error && <div className="error-text">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="button secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            className="button"
            type="button"
            onClick={handleSave}
            disabled={submitting || (payableOptions.length === 0 && receivableOptions.length === 0)}
          >
            {submitting ? "Saving..." : "Record settlement"}
          </button>
        </div>
      </div>
    </div>
  );
}
