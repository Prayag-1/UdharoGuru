import "../../private/PrivateDashboard.css";

const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

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

export default function ActiveItemCard({ loan, borrowerLabel, borrowerEmail, onReturn }) {
  const gmailUrl = borrowerEmail
    ? buildGmailLink({
        to: borrowerEmail,
        subject: `Return reminder for ${loan.item_name}`,
        body: `Hello,\n\nThis is a reminder to return ${loan.item_name}${
          loan.expected_return_date ? ` by ${formatDate(loan.expected_return_date)}` : ""
        }.\n\nPlease let me know once it has been returned.\n\nThanks.`,
      })
    : null;

  return (
    <div className="item-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 800 }}>{loan.item_name}</div>
        <span className="badge warning">Active</span>
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
        {borrowerLabel}
      </div>
      <div style={{ display: "grid", gap: 4, marginTop: 8, fontSize: 14 }}>
        <span title="The day you handed the item out">
          Lent on: <strong>{formatDate(loan.lent_date)}</strong>
        </span>
        <span>
          Expected return: <strong>{loan.expected_return_date ? formatDate(loan.expected_return_date) : "Not set"}</strong>
        </span>
        {loan.reminder_enabled && (
          <span>
            Reminder timer: <strong>{loan.reminder_interval_days} day{loan.reminder_interval_days === 1 ? "" : "s"}</strong>
          </span>
        )}
        {loan.item_description && <span className="muted">{loan.item_description}</span>}
      </div>
      <div className="item-card-actions">
        {gmailUrl && (
          <a className="button secondary sm" href={gmailUrl} target="_blank" rel="noreferrer">
            Gmail
          </a>
        )}
        <button className="button" type="button" onClick={() => onReturn(loan)}>
          Mark as returned
        </button>
      </div>
    </div>
  );
}
