import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { createPrivateItem, getPrivateItems, getPrivateSummary, returnPrivateItem } from "../../api/private";
import AddItemModal from "./components/AddItemModal";
import ItemLoanSection from "./components/ItemLoanSection";
import "./PrivateDashboard.css";

const currency = (value) =>
  Number(value || 0).toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

export default function DashboardView() {
  const { user, connections } = useOutletContext();
  const [summary, setSummary] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryError, setSummaryError] = useState(null);
  const [itemsError, setItemsError] = useState(null);
  const [showItemModal, setShowItemModal] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  const borrowerLookup = useMemo(() => {
    const map = {};
    connections.forEach((conn) => {
      const targetId = conn.connected_user_id || conn.connected_user?.id || conn.id;
      const targetEmail = conn.connected_user_email || conn.connected_user?.email || conn.email;
      if (targetId) map[targetId] = { email: targetEmail, full_name: conn.full_name };
    });
    return map;
  }, [connections]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setSummaryError(null);
      setItemsError(null);
      try {
        const [summaryRes, itemsRes] = await Promise.all([getPrivateSummary(), getPrivateItems()]);
        if (!active) return;
        setSummary(summaryRes.data);
        setItems(Array.isArray(itemsRes.data) ? itemsRes.data : itemsRes.data?.results || []);
      } catch (err) {
        console.error("Failed to load dashboard view", err);
        if (!active) return;
        setSummary(null);
        setItems([]);
        setSummaryError("Unable to load summary.");
        setItemsError("Unable to load items.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const net = useMemo(() => Number(summary?.net_balance || 0), [summary]);
  const owes = useMemo(() => Number(summary?.total_payable || 0), [summary]);
  const owed = useMemo(() => Number(summary?.total_receivable || 0), [summary]);

  const handleReturnItem = async (loan) => {
    setItemsError(null);
    try {
      await returnPrivateItem(loan.id);
      const { data } = await getPrivateItems();
      setItems(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to return item", err);
      setItemsError("Unable to mark as returned.");
    }
  };

  const handleCreateItem = async (payload) => {
    setSavingItem(true);
    try {
      await createPrivateItem({
        ...payload,
        borrower: Number(payload.borrower),
      });
      setShowItemModal(false);
      const { data } = await getPrivateItems();
      setItems(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      console.error("Failed to create item", err);
      setItemsError("Unable to save item.");
    } finally {
      setSavingItem(false);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-shell">
        <div className="section-card">
          <span className="skeleton" style={{ width: "60%", height: 18 }} />
        </div>
        <div className="grid-3">
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
          <span className="skeleton" style={{ width: "100%", height: 80 }} />
        </div>
        <div className="section-card">
          <span className="skeleton" style={{ width: "100%", height: 180 }} />
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell">
      <div className="section-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900 }}>Overview</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Splitwise-style summary for {user?.email}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="summary-card" style={{ flex: "1 1 200px" }}>
            <div className="card-title">You’ll Receive</div>
            <div className="currency" style={{ color: "#0b7a34", marginTop: 6 }}>{currency(owed)}</div>
          </div>
          <div className="summary-card" style={{ flex: "1 1 200px" }}>
            <div className="card-title">You Owe</div>
            <div className="currency" style={{ color: "#b91c1c", marginTop: 6 }}>{currency(owes)}</div>
          </div>
          <div className="summary-card" style={{ flex: "1 1 200px" }}>
            <div className="card-title">Net Balance</div>
            <div
              className="currency"
              style={{ color: net > 0 ? "#0b7a34" : net < 0 ? "#b91c1c" : "#0f172a", marginTop: 6 }}
            >
              {currency(net)}
            </div>
          </div>
        </div>
        {net === 0 && (
          <div className="pill" style={{ marginTop: 12, background: "#e0f2fe", color: "#075985" }}>
            You are all settled up
          </div>
        )}
        {summaryError && <div className="error-text">{summaryError}</div>}
      </div>

      <div className="section-card">
        <div className="section-heading">
          <div>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Item Lending</div>
            <div className="muted" style={{ fontSize: 14 }}>
              Track borrowed items and remind returns.
            </div>
          </div>
          <button className="button" type="button" onClick={() => setShowItemModal(true)}>
            Lend an Item
          </button>
        </div>
        <ItemLoanSection
          items={items}
          loading={false}
          error={itemsError}
          borrowerLookup={borrowerLookup}
          onAddItem={() => setShowItemModal(true)}
          onReturn={handleReturnItem}
        />
      </div>

      <AddItemModal
        open={showItemModal}
        onClose={() => setShowItemModal(false)}
        onSubmit={handleCreateItem}
        connections={connections.map((conn) => {
          const target = conn.connected_user || {};
          return {
            id: conn.connected_user_id || target.id || conn.id,
            email: conn.connected_user_email || target.email || conn.email,
            full_name: target.full_name || conn.full_name,
          };
        })}
        submitting={savingItem}
      />
    </div>
  );
}
