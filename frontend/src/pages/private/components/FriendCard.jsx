import { useNavigate } from "react-router-dom";
import { connectionDisplayName, formatShortDate } from "../privateShared";
import "../PrivateDashboard.css";

/**
 * FriendCard - Reusable friend list item component
 * Displays: avatar, name, balance, badges, recent activity
 * Click navigates to friend detail page
 */
export default function FriendCard({
  friend,
  onNavigate,
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/private/friends/${friend.id}`);
    onNavigate?.(friend.id);
  };

  const renderBalanceLabel = (balance) => {
    if (balance > 0) return `owes you NPR ${Number(balance).toLocaleString("ne-NP", { minimumFractionDigits: 2 })}`;
    if (balance < 0) return `you owe NPR ${Number(Math.abs(balance)).toLocaleString("ne-NP", { minimumFractionDigits: 2 })}`;
    return "all settled up";
  };

  const lastActivityDate = friend.latestActivity
    ? formatShortDate(friend.latestActivity)
    : "No activity";

  return (
    <button
      type="button"
      className="friend-card"
      onClick={handleClick}
      title={`View details for ${connectionDisplayName(friend)}`}
    >
      <div className="friend-card-main">
        <div className="friend-avatar">
          {connectionDisplayName(friend).slice(0, 1).toUpperCase()}
        </div>
        <div className="friend-copy">
          <div className="friend-name-row">
            <span className="friend-name">{connectionDisplayName(friend)}</span>
            <span
              className={`friend-balance-tone ${
                friend.balance > 0 ? "positive" : friend.balance < 0 ? "negative" : "neutral"
              }`}
            >
              {renderBalanceLabel(friend.balance)}
            </span>
          </div>
          <div className="friend-subtitle">
            {friend.email || "No email on record"}
            {lastActivityDate && ` · Updated ${lastActivityDate}`}
          </div>
          <div className="friend-badges">
            {friend.dueReminders.length > 0 && (
              <span className="badge warning">Reminder {friend.dueReminders.length}</span>
            )}
            {friend.activeItems.length > 0 && (
              <span className="badge">Items {friend.activeItems.length}</span>
            )}
            {friend.balance === 0 && <span className="badge success">Settled</span>}
          </div>
        </div>
      </div>
    </button>
  );
}
