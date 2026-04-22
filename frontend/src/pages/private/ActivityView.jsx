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
  Number(value || 0).toLocaleString("ne-NP", { style: "currency", currency: "NPR", minimumFractionDigits: 2 });

const isEmail = (value) => /\S+@\S+\.\S+/.test((value || "").trim());

const buildGmailLink = ({ to, subject, body }) => {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
};

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
          {user?.email && <div className="muted" style={{ fontSize: 13 }}>{user.email}</div>}
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
              const personEmail = isEmail(item.person_name) ? item.person_name.trim() : "";
              const gmailUrl = personEmail
                ? buildGmailLink({
                    to: personEmail,
                    subject: isLent ? "Outstanding amount reminder" : "Settlement update",
                    body: isLent
                      ? `Hello,\n\nThis is a reminder that ${formatCurrency(item.amount)} is still pending.${
                          item.note ? `\n\nReference: ${item.note}` : ""
                        }\n\nPlease settle it when possible.\n\nThanks.`
                      : `Hello,\n\nI am reaching out regarding the ${formatCurrency(item.amount)} transaction${
                          item.note ? ` for "${item.note}"` : ""
                        }.\n\nPlease let me know the settlement status.\n\nThanks.`,
                  })
                : null;

              return (
                <div key={item.id} className="row-card" style={{ gridTemplateColumns: "1fr 1fr auto auto" }}>
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
                  <div className="row-actions">
                    {gmailUrl && (
                      <a className="button secondary sm" href={gmailUrl} target="_blank" rel="noreferrer">
                        Gmail
                      </a>
                    )}
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
