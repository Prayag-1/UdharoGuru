import { useEffect, useState } from "react";

import "../../private/PrivateDashboard.css";

export default function AddGroupMemberModal({ open, onClose, group, friends, onSubmit, submitting }) {
  const [selected, setSelected] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open) {
      setSelected("");
      setError(null);
    }
  }, [open]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (!selected) {
      setError("Select a friend to add.");
      return;
    }
    try {
      await onSubmit(group?.id, Number(selected));
    } catch (err) {
      setError(err?.message || "Unable to add member.");
    }
  };

  if (!open || !group) return null;

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSave}>
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Add member to {group.name}</div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <label className="label">
          Friend
          <select className="select" value={selected} onChange={(e) => setSelected(e.target.value)} required>
            <option value="">Select friend</option>
            {friends.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>

        {error && <div className="error-text">{error}</div>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="button secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add member"}
          </button>
        </div>
      </form>
    </div>
  );
}
