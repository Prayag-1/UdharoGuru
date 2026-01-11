import "../../private/PrivateDashboard.css";

const Skeleton = ({ height = 20 }) => (
  <span className="skeleton" style={{ width: "80%", height }} />
);

const formatCurrency = (value) => {
  if (value === null || value === undefined) return "—";
  const amount = Number(value);
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
};

export default function MoneySummaryCards({ summary, loading, error }) {
  const net = Number(summary?.net_balance || 0);
  const cards = [
    { label: "You’ll Receive", key: "total_receivable", tone: "#0b7a34" },
    { label: "You Owe", key: "total_payable", tone: "#b91c1c" },
    {
      label: "Net Balance",
      key: "net_balance",
      tone: net > 0 ? "#0b7a34" : net < 0 ? "#b91c1c" : "#0f172a",
    },
  ];

  return (
    <div className="grid-3">
      {cards.map(({ label, key, tone }) => (
        <div key={key} className="summary-card">
          <div className="card-title">{label}</div>
          {loading ? (
            <div style={{ marginTop: 8 }}>
              <Skeleton height={26} />
            </div>
          ) : (
            <div className="currency" style={{ marginTop: 6, color: typeof tone === "string" ? tone : undefined }}>
              {formatCurrency(summary?.[key])}
            </div>
          )}
          {error && <div className="error-text">{error}</div>}
        </div>
      ))}
    </div>
  );
}
