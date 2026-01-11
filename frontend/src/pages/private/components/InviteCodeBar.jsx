import { useMemo } from "react";

import "../../private/PrivateDashboard.css";

const Skeleton = ({ width = "120px" }) => <span className="skeleton" style={{ height: 12, width }} />;

export default function InviteCodeBar({ code, onCopy, loading }) {
  const formattedCode = useMemo(() => code || null, [code]);

  return (
    <div className="section-card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span className="label" style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Your Invite Code
        </span>
        {loading ? (
          <Skeleton width="140px" />
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pill" style={{ fontSize: 13, letterSpacing: 0.6 }}>
              {formattedCode || "Not available"}
            </span>
            <button className="button secondary" type="button" onClick={onCopy} disabled={!formattedCode}>
              Copy
            </button>
          </div>
        )}
        <span className="muted" style={{ fontSize: 13 }}>
          Share this code with friends to lend items
        </span>
      </div>
    </div>
  );
}
