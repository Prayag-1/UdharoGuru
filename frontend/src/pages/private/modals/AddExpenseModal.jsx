import { useEffect, useMemo, useState } from "react";

import "../../private/PrivateDashboard.css";

const today = () => new Date().toISOString().slice(0, 10);

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export default function AddExpenseModal({
  open,
  onClose,
  onSave,
  connections = [],
  submitting,
  defaultSplit = 50,
  onSaveDefaultSplit,
  prefill,
}) {
  const [description, setDescription] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [date, setDate] = useState(today());
  const [step, setStep] = useState(1);
  const [error, setError] = useState(null);
  const [splits, setSplits] = useState([]);
  const [saveAsDefault, setSaveAsDefault] = useState(true);

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

  const calcPercent = (amount, total) => {
    if (!total) return 0;
    return Math.max(0, (Number(amount) / Number(total)) * 100);
  };

  const recalcPercents = (splitArr, total) =>
    splitArr.map((s) => ({
      ...s,
      amount: Number(s.amount || 0),
      percent: calcPercent(s.amount || 0, total),
    }));

  useEffect(() => {
    if (!open) return;
    const ids = connections.slice(0, 1).map((c) => c.id);
    const initialSplits = ids.length
      ? [{ id: ids[0], amount: totalAmount ? Number(totalAmount) * (defaultSplit / 100) : 0 }]
      : [];
    setSplits(recalcPercents(initialSplits, totalAmount));
  }, [open, connections, defaultSplit, totalAmount]);

  useEffect(() => {
    if (!prefill || !open) return;
    setDescription(prefill.description || "");
    setTotalAmount(prefill.amount || "");
    setDate(prefill.date || today());
    setSplits((prev) => recalcPercents(prev.length ? prev : [], prefill.amount || totalAmount));
  }, [prefill, open, totalAmount]);

  useEffect(() => {
    if (!open) return;
    setSplits((prev) => recalcPercents(prev, totalAmount));
  }, [open, totalAmount]);

  const reset = () => {
    setDescription("");
    setTotalAmount("");
    setDate(today());
    setStep(1);
    setError(null);
    setSaveAsDefault(true);
    setSplits([]);
  };

  const handleNext = (e) => {
    e.preventDefault();
    setError(null);
    if (!description.trim()) {
      setError("Description is required.");
      return;
    }
    if (!totalAmount || Number(totalAmount) <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    if (!splits.length) {
      setError("Select at least one friend to split with.");
      return;
    }
    setStep(2);
  };

  const handleSave = async () => {
    setError(null);
    try {
      await onSave({
        description: description.trim(),
        totalAmount: Number(totalAmount),
        date,
        splits: recalcPercents(splits, totalAmount),
      });
      if (saveAsDefault && onSaveDefaultSplit && splits.length === 1) {
        onSaveDefaultSplit(Math.round(splits[0].percent));
      }
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
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                required
              />
            </label>
            <div className="label">
              Split with friends
              <div className="muted" style={{ fontSize: 12 }}>
                Choose who shares this expense and set custom amounts.
              </div>
            </div>
            <div className="list" style={{ maxHeight: 220, overflow: "auto" }}>
              {borrowerOptions.map((opt) => {
                const existing = splits.find((s) => String(s.id) === String(opt.id));
                return (
                  <div key={opt.id} className="row-card" style={{ gridTemplateColumns: "auto 1fr 120px" }}>
                    <input
                      type="checkbox"
                      checked={Boolean(existing)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        if (checked) {
                          setSplits((prev) =>
                            recalcPercents(
                              [...prev, { id: opt.id, amount: 0 }],
                              totalAmount
                            )
                          );
                        } else {
                          setSplits((prev) =>
                            recalcPercents(
                              prev.filter((s) => String(s.id) !== String(opt.id)),
                              totalAmount
                            )
                          );
                        }
                      }}
                      style={{ width: 18, height: 18 }}
                    />
                    <div>
                      <div style={{ fontWeight: 700 }}>{opt.label}</div>
                      {existing && (
                        <div className="muted" style={{ fontSize: 12 }}>
                          {existing.percent.toFixed(1)}% of total
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <input
                        className="input"
                        type="number"
                        min="0"
                        step="0.01"
                        value={existing ? existing.amount : ""}
                        placeholder="Amount"
                        disabled={!existing}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setSplits((prev) =>
                            recalcPercents(
                              prev.map((s) =>
                                String(s.id) === String(opt.id) ? { ...s, amount: val } : s
                              ),
                              totalAmount
                            )
                          );
                        }}
                        style={{ width: 80 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {splits.length > 0 && (
              <div className="muted" style={{ fontSize: 12 }}>
                Split total: {formatCurrency(splits.reduce((s, x) => s + Number(x.amount || 0), 0))}
              </div>
            )}
            <label className="label">
              Date
              <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </label>
            <div className="label">Paid by: You</div>
            <label className="flex-row" style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                style={{ width: 16, height: 16 }}
              />
              Save this split as default when only one friend is selected
            </label>
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
              <div className="list" style={{ marginTop: 6 }}>
                {splits.map((s) => {
                  const friend = borrowerOptions.find((b) => String(b.id) === String(s.id));
                  return (
                    <div key={s.id} style={{ display: "flex", justifyContent: "space-between" }}>
                      <div>{friend?.label || `Friend ${s.id}`}</div>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {s.percent.toFixed(1)}% ({formatCurrency(s.amount)})
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="muted" style={{ marginTop: 6 }}>{description}</div>
              <div className="currency" style={{ marginTop: 10 }}>{formatCurrency(totalAmount)}</div>
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
