import "../../private/PrivateDashboard.css";
import ActiveItemCard from "./ActiveItemCard";
import ReturnedItemCard from "./ReturnedItemCard";

const SkeletonCard = () => (
  <div className="item-card">
    <span className="skeleton" style={{ width: "40%", height: 18 }} />
    <span className="skeleton" style={{ width: "60%", height: 14, marginTop: 10 }} />
    <span className="skeleton" style={{ width: "70%", height: 14, marginTop: 6 }} />
    <span className="skeleton" style={{ width: "80%", height: 14, marginTop: 6 }} />
  </div>
);

export default function ItemLoanSection({ items, loading, error, onAddItem, onReturn, borrowerLookup }) {
  const active = items.filter((loan) => loan.status === "ACTIVE");
  const returned = items.filter((loan) => loan.status === "RETURNED");

  const borrowerLabel = (loan) => {
    const borrower = borrowerLookup?.[loan.borrower];
    if (!borrower) return `Borrower #${loan.borrower}`;
    const name = borrower.full_name || borrower.email || borrower.invite_code;
    return borrower.email ? `${name} (${borrower.email})` : name;
  };

  return (
    <div className="section-card">
      <div className="section-heading">
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Item Lending</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Track borrowed items and remind returns.
          </div>
        </div>
        <button className="button" type="button" onClick={onAddItem}>
          Lend an Item
        </button>
      </div>

      {error && <div className="error-text">{error}</div>}

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Active Items</div>
          {loading ? (
            <div className="loans-grid">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : active.length === 0 ? (
            <div className="empty-state">
              No items lent yet. Lend an item to track returns and reminders.
            </div>
          ) : (
            <div className="loans-grid">
              {active.map((loan) => (
                <ActiveItemCard
                  key={loan.id}
                  loan={loan}
                  borrowerLabel={borrowerLabel(loan)}
                  onReturn={onReturn}
                />
              ))}
            </div>
          )}
        </div>

        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Returned Items</div>
          {loading ? (
            <div className="loans-grid">
              <SkeletonCard />
            </div>
          ) : returned.length === 0 ? (
            <div className="empty-state">No returned items yet.</div>
          ) : (
            <div className="loans-grid">
              {returned.map((loan) => (
                <ReturnedItemCard
                  key={loan.id}
                  loan={loan}
                  borrowerLabel={borrowerLabel(loan)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
