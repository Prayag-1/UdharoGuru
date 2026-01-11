import "../../private/PrivateDashboard.css";

const formatDate = (dateString) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

export default function ReturnedItemCard({ loan, borrowerLabel }) {
  return (
    <div className="item-card returned">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <div style={{ fontWeight: 800 }}>{loan.item_name}</div>
        <span className="badge success">Returned</span>
      </div>
      <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>
        {borrowerLabel}
      </div>
      <div style={{ display: "grid", gap: 4, marginTop: 8, fontSize: 14 }}>
        <span>Lent on: <strong>{formatDate(loan.lent_date)}</strong></span>
        <span>Expected return: <strong>{loan.expected_return_date ? formatDate(loan.expected_return_date) : "Not set"}</strong></span>
        {loan.item_description && <span className="muted">{loan.item_description}</span>}
      </div>
    </div>
  );
}
