import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getBusinessCustomerTransactions, getBusinessLedger, settleBusinessTransaction } from "../../api/business";
import { useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";
import { LedgerHeader, LedgerRow, formatMoney } from "./components/LedgerRow";

export default function BusinessLedger() {
  const { user } = useAuth();
  const gate = useBusinessGate("/business/ledger");
  const [loading, setLoading] = useState(true);
  const [ledger, setLedger] = useState([]);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [confirmTx, setConfirmTx] = useState(null);
  const [settlingId, setSettlingId] = useState(null);
  const [customerName, setCustomerName] = useState("");
  const [customerTx, setCustomerTx] = useState([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const hasFetched = useRef(false);

  const canView = user && user.account_type === "BUSINESS" && user.business_status === "APPROVED";
  const gateMessage = !user
    ? "Login required to view the ledger."
    : user.account_type !== "BUSINESS"
      ? "Business account required."
      : `Ledger is available after KYC approval. Current status: ${user.business_status || "pending"}.`;

  const loadLedger = async () => {
    setLoading(true);
    setError("");
    setActionError("");
    try {
      const { data } = await getBusinessLedger();
      setLedger(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setError("Unable to load ledger right now.");
      setLedger([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gate.loading) return;
    if (!canView) {
      setLoading(false);
      return;
    }
    if (hasFetched.current) return;
    hasFetched.current = true;
    loadLedger();
  }, [gate.loading, canView]);

  const syncTransactionUpdate = (updatedTx) => {
    if (!updatedTx || !updatedTx.id) return;
    setLedger((prev) => prev.map((row) => (row.id === updatedTx.id ? updatedTx : row)));
    setCustomerTx((prev) => prev.map((row) => (row.id === updatedTx.id ? updatedTx : row)));
  };

  const requestSettle = (tx) => {
    if (!tx || tx.is_settled || settlingId) return;
    setActionError("");
    setConfirmTx(tx);
  };

  const performSettlement = async () => {
    if (!confirmTx) return;
    setSettlingId(confirmTx.id);
    setActionError("");
    try {
      const { data } = await settleBusinessTransaction(confirmTx.id);
      syncTransactionUpdate(data);
    } catch (err) {
      setActionError("Unable to settle transaction right now.");
    } finally {
      setSettlingId(null);
      setConfirmTx(null);
    }
  };

  const openCustomerDetail = async (name) => {
    if (!name) return;
    setCustomerName(name);
    setCustomerLoading(true);
    setCustomerError("");
    try {
      const { data } = await getBusinessCustomerTransactions(name);
      setCustomerTx(Array.isArray(data) ? data : data?.results || []);
    } catch (err) {
      setCustomerError("Unable to load customer details.");
      setCustomerTx([]);
    } finally {
      setCustomerLoading(false);
    }
  };

  const closeCustomerDetail = () => {
    setCustomerName("");
    setCustomerTx([]);
    setCustomerError("");
    setCustomerLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a" }}>Ledger</div>
            <div style={{ color: "#475569" }}>All business transactions in one place.</div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              to="/business/dashboard"
              style={{
                color: "#0f172a",
                fontWeight: 800,
                border: "1px solid #cbd5e1",
                padding: "8px 10px",
                borderRadius: 10,
                textDecoration: "none",
                background: "#ffffff",
              }}
            >
              Dashboard
            </Link>
            <Link
              to="/business/ocr"
              style={{
                color: "#0f172a",
                fontWeight: 800,
                border: "1px solid #cbd5e1",
                padding: "8px 10px",
                borderRadius: 10,
                textDecoration: "none",
                background: "#ffffff",
              }}
            >
              OCR
            </Link>
          </div>
        </div>

        {!canView ? (
          <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontWeight: 700 }}>
            {gateMessage}
          </div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 12 }}>
            {error && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
                {error}
              </div>
            )}
            {actionError && (
              <div style={{ marginBottom: 12, padding: 10, borderRadius: 10, border: "1px solid #fcd34d", background: "#fffbeb", color: "#92400e", fontWeight: 700 }}>
                {actionError}
              </div>
            )}

            {loading ? (
              <div style={{ display: "grid", gap: 8 }}>
                {[...Array(5)].map((_, idx) => (
                  <div key={idx} style={{ height: 20, borderRadius: 8, background: "#e2e8f0" }} />
                ))}
              </div>
            ) : ledger.length === 0 ? (
              <div style={{ padding: 16, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#475569", textAlign: "center" }}>
                No transactions found. Confirm OCR receipts or add ledger entries.
              </div>
            ) : (
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                <LedgerHeader />
                {ledger.map((tx) => (
                  <LedgerRow
                    key={tx.id}
                    tx={tx}
                    onSettle={requestSettle}
                    settling={settlingId === tx.id}
                    onSelectCustomer={openCustomerDetail}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!confirmTx}
        title="Mark as settled"
        description="Mark this transaction as settled? This action can't be undone."
        onCancel={() => setConfirmTx(null)}
        onConfirm={performSettlement}
        busy={!!settlingId}
      />
      <CustomerDetailPanel
        name={customerName}
        open={!!customerName}
        transactions={customerTx}
        loading={customerLoading}
        error={customerError}
        onClose={closeCustomerDetail}
        onSettle={requestSettle}
        settlingId={settlingId}
      />
    </div>
  );
}

function ConfirmDialog({ open, title, description, onCancel, onConfirm, busy }) {
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "grid", placeItems: "center", padding: 12, zIndex: 20 }}>
      <div style={{ width: "min(460px, 100%)", background: "#ffffff", borderRadius: 16, padding: 20, border: "1px solid #cbd5e1", boxShadow: "0 12px 30px rgba(15,23,42,0.14)" }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{title}</div>
        <div style={{ color: "#475569", margin: "8px 0 16px", lineHeight: 1.5 }}>{description}</div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            style={{ padding: "8px 12px", borderRadius: 10, border: "1px solid #0f172a", background: "#0f172a", color: "#ffffff", fontWeight: 800, cursor: busy ? "not-allowed" : "pointer" }}
          >
            {busy ? "Marking..." : "Mark as settled"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomerDetailPanel({ name, open, transactions = [], loading, error, onClose, onSettle, settlingId }) {
  if (!open) return null;

  const outstanding = transactions.reduce((acc, tx) => {
    if (tx.is_settled) return acc;
    const amount = Number(tx.amount || 0);
    if (Number.isNaN(amount)) return acc;
    const type = (tx.transaction_type || "").toUpperCase();
    return type === "CREDIT" ? acc + amount : acc - amount;
  }, 0);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.28)", display: "flex", justifyContent: "flex-end", zIndex: 15 }}>
      <div style={{ width: "min(520px, 100%)", background: "#ffffff", borderLeft: "1px solid #e2e8f0", padding: 18, display: "grid", gap: 12, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>{name}</div>
            <div style={{ color: "#475569" }}>Transactions and settlement status</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #cbd5e1", background: "#ffffff", color: "#0f172a", fontWeight: 800, cursor: "pointer" }}
          >
            Close
          </button>
        </div>

        <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 12, background: "#f8fafc", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Outstanding balance</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: outstanding >= 0 ? "#15803d" : "#b91c1c" }}>{formatMoney(outstanding)}</div>
          </div>
          <div style={{ color: "#94a3b8", fontWeight: 700, fontSize: 12 }}>Based on unsettled entries only</div>
        </div>

        {error && (
          <div style={{ padding: 10, borderRadius: 10, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: "grid", gap: 8 }}>
            {[...Array(4)].map((_, idx) => (
              <div key={idx} style={{ height: 18, borderRadius: 8, background: "#e2e8f0" }} />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 14, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#475569", textAlign: "center" }}>
            No transactions for this customer yet.
          </div>
        ) : (
          <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
            <LedgerHeader />
            {transactions.map((tx) => (
              <LedgerRow
                key={tx.id}
                tx={tx}
                onSettle={onSettle}
                settling={settlingId === tx.id}
                onSelectCustomer={null}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
