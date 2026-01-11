import "../../private/PrivateDashboard.css";
import MoneyTransactionRow from "./MoneyTransactionRow";

const SkeletonRow = () => (
  <div className="row-card">
    <span className="skeleton" style={{ height: 18, width: "60%" }} />
    <span className="skeleton" style={{ height: 20, width: "80%" }} />
    <span className="skeleton" style={{ height: 16, width: "70%" }} />
    <span className="skeleton" style={{ height: 16, width: "90%" }} />
    <span className="skeleton" style={{ height: 32, width: "100%" }} />
  </div>
);

export default function MoneyTransactionList({
  transactions,
  loading,
  error,
  onAddClick,
  onEdit,
  onDelete,
}) {
  return (
    <div className="section-card">
      <div className="section-heading">
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Money Transactions</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Track who you lent or borrowed from.
          </div>
        </div>
        <button className="button" type="button" onClick={onAddClick}>
          Add Transaction
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      {loading ? (
        <div className="list">
          <SkeletonRow />
          <SkeletonRow />
        </div>
      ) : transactions.length === 0 ? (
        <div className="empty-state">No transactions yet. Start tracking your udharo.</div>
      ) : (
        <div className="list">
          {transactions.map((tx) => (
            <MoneyTransactionRow key={tx.id} tx={tx} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
