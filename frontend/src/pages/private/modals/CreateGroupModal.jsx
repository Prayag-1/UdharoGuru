import { useState } from "react";

import "../../private/PrivateDashboard.css";

export default function CreateGroupModal({ open, onClose, onSubmit, submitting }) {
  const [name, setName] = useState("");
  const [error, setError] = useState(null);

  const handleSave = async (e) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Group name is required.");
      return;
    }
    try {
      await onSubmit(name.trim());
      setName("");
    } catch (err) {
      setError(err?.message || "Unable to create group.");
    }
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <form className="modal" onSubmit={handleSave}>
        <div className="section-heading" style={{ marginBottom: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Create group</div>
          <button className="button secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <label className="label">
          Group name
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Trip to Pokhara"
            required
          />
        </label>
        {error && <div className="error-text">{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button className="button secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button className="button" type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </div>
  );
}
