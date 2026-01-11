import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { getPrivateTransactions } from "../../api/private";
import "./PrivateDashboard.css";

const formatDateTime = (value) => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString(undefined, { month: "short", day: "numeric" });
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export default function ActivityView() {
  const { user } = useOutletContext();
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { data } = await getPrivateTransactions();
        if (!active) return;
        const list = Array.isArray(data) ? data : data?.results || [];
        const sorted = [...list].sort(
          (a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime()
        );
        setActivity(sorted.slice(0, 20));
      } catch (err) {
        console.error("Failed to load activity", err);
        if (!active) return;
        setActivity([]);
        setError("Unable to load activity.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dashboard-shell">
      <div className="section-heading" style={{ marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 900 }}>Recent activity</div>
          <div className="muted">Latest moves on your account, {user?.email}</div>
        </div>
      </div>

      {loading ? (
        <div className="section-card">
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
        </div>
      ) : error ? (
        <div className="error-text">{error}</div>
      ) : activity.length === 0 ? (
        <div className="empty-state">No recent activity.</div>
      ) : (
        <div className="section-card">
          <div className="list">
            {activity.map((item) => {
              const isLent = item.transaction_type === "LENT";
              return (
                <div key={item.id} className="row-card" style={{ gridTemplateColumns: "1fr 1fr auto" }}>
                  <div>
                    <div style={{ fontWeight: 800 }}>{item.person_name}</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                      {item.note || "Expense"} · {formatDateTime(item.transaction_date)}
                    </div>
                  </div>
                  <div className="muted" style={{ fontSize: 13 }}>{isLent ? "You lent" : "You borrowed"}</div>
                  <div className="currency" style={{ color: isLent ? "#0b7a34" : "#b91c1c" }}>
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
