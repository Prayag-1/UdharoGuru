import { useEffect, useMemo, useState } from "react";

import {
  addBusinessLedgerTransaction,
  getBusinessCustomerBalances,
  getBusinessLedger,
} from "../../api/business";
import { useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";

const currency = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "—";
  return num.toLocaleString("en-US", { style: "currency", currency: "USD" });
};

export default function BusinessDashboard() {
  const { user } = useAuth();
  const gate = useBusinessGate("/business/dashboard");
  const [ledger, setLedger] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const verified = user?.business_status === "APPROVED";

  const loadLedger = async () => {
    setLoading(true);
    setError("");
    try {
      const [ledgerRes, customerRes] = await Promise.all([getBusinessLedger(), getBusinessCustomerBalances()]);
      setLedger(Array.isArray(ledgerRes.data) ? ledgerRes.data : ledgerRes.data?.results || []);
      setCustomers(Array.isArray(customerRes.data) ? customerRes.data : customerRes.data?.results || []);
    } catch (err) {
      setError("Unable to load ledger right now.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (gate.loading) return;
    if (!verified) {
      setLoading(false);
      return;
    }
    loadLedger();
  }, [gate.loading, verified]);

  const summary = useMemo(() => {
    let receivable = 0;
    let payable = 0;
    ledger.forEach((tx) => {
      const type = (tx.transaction_type || "").toUpperCase();
      const amt = Number(tx.amount || 0);
      const credit = type === "CREDIT" || type === "LENT";
      if (credit) receivable += amt;
      else payable += amt;
    });
    return {
      receivable,
      payable,
      net: receivable - payable,
    };
  }, [ledger]);

  const filteredLedger = useMemo(() => {
    if (!selectedCustomer) return ledger;
    return ledger.filter((tx) => (tx.customer_name || tx.merchant) === selectedCustomer);
  }, [ledger, selectedCustomer]);

  const handleCreate = async (payload) => {
    setSaving(true);
    setError("");
    try {
      await addBusinessLedgerTransaction(payload);
      setModalOpen(false);
      setSelectedCustomer(null);
      await loadLedger();
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.response?.data?.non_field_errors?.[0] ||
        err?.response?.data?.customer_name?.[0] ||
        err?.response?.data?.amount?.[0] ||
        "Unable to add transaction.";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0b0b0b",
        color: "#fff",
        padding: 28,
        fontFamily: "Inter, system-ui",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <h1 style={{ margin: 0, fontWeight: 1000 }}>Business Dashboard</h1>
        <p style={{ color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
          {verified
            ? "Verified business account. Ledger and OCR are ready."
            : "Business verification pending. Complete KYC to unlock ledger and OCR."}
        </p>

        {!verified ? (
          <div style={{ marginTop: 16, padding: 16, borderRadius: 12, border: "1px solid #334155", background: "#111827" }}>
            Finish verification to use the ledger.
          </div>
        ) : (
          <>
            {error && (
              <div style={{ marginTop: 12, padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#7f1d1d", color: "#fff", fontWeight: 700 }}>
                {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px,1fr))", gap: 12, marginTop: 16 }}>
              <SummaryCard label="Total receivable" value={currency(summary.receivable)} />
              <SummaryCard label="Total payable" value={currency(summary.payable)} />
              <SummaryCard label="Net" value={currency(summary.net)} />
            </div>

            <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <div style={{ fontWeight: 900, fontSize: 20 }}>Transactions</div>
              <button
                type="button"
                onClick={() => setModalOpen(true)}
                style={{
                  border: "1px solid #1f2937",
                  background: "#0f172a",
                  color: "#e2e8f0",
                  padding: "10px 14px",
                  borderRadius: 10,
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                Add transaction
              </button>
            </div>

            {loading ? (
              <div style={{ marginTop: 12, borderRadius: 12, background: "#111827", border: "1px solid #1f2937", height: 160 }} />
            ) : filteredLedger.length === 0 ? (
              <div style={{ marginTop: 12, padding: 16, borderRadius: 12, border: "1px dashed #334155", background: "#0f172a" }}>
                No transactions yet. Add one manually or confirm OCR.
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#0f172a", borderRadius: 12, overflow: "hidden" }}>
                  <thead style={{ background: "#111827", color: "#cbd5e1" }}>
                    <tr>
                      <th style={th}>Date</th>
                      <th style={th}>Customer</th>
                      <th style={th}>Amount</th>
                      <th style={th}>Type</th>
                      <th style={th}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLedger.map((tx) => {
                      const isCredit = (tx.transaction_type || "").toUpperCase() === "CREDIT" || (tx.transaction_type || "").toUpperCase() === "LENT";
                      return (
                        <tr key={tx.id} style={{ borderBottom: "1px solid #1f2937" }}>
                          <td style={td}>{new Date(tx.transaction_date).toLocaleDateString()}</td>
                          <td style={td}>{tx.customer_name || tx.merchant || "Unknown"}</td>
                          <td style={{ ...td, color: isCredit ? "#4ade80" : "#f87171" }}>{currency(tx.amount)}</td>
                          <td style={td}>{tx.transaction_type}</td>
                          <td style={td}>{tx.source}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 24 }}>
              <div style={{ fontWeight: 900, fontSize: 18, marginBottom: 8 }}>Customers</div>
              {customers.length === 0 ? (
                <div style={{ padding: 12, borderRadius: 12, border: "1px dashed #334155", background: "#0f172a" }}>
                  No customers yet. Add a transaction to see balances.
                </div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {customers.map((c) => (
                    <div
                      key={c.customer_name}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        alignItems: "center",
                        padding: 12,
                        borderRadius: 12,
                        border: "1px solid #1f2937",
                        background: "#0f172a",
                        cursor: "pointer",
                      }}
                      onClick={() => setSelectedCustomer(c.customer_name)}
                    >
                      <div>
                        <div style={{ fontWeight: 800 }}>{c.customer_name}</div>
                      </div>
                      <div style={{ fontWeight: 900, color: Number(c.balance) >= 0 ? "#4ade80" : "#f87171" }}>
                        {currency(c.balance)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {modalOpen && (
        <AddTransactionModal
          onClose={() => setModalOpen(false)}
          onSubmit={handleCreate}
          saving={saving}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={{ background: "#111827", border: "1px solid #1f2937", borderRadius: 14, padding: 14 }}>
      <div style={{ color: "#cbd5e1", fontSize: 13 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900 }}>{value}</div>
    </div>
  );
}

function AddTransactionModal({ onClose, onSubmit, saving }) {
  const [customer, setCustomer] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("CREDIT");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");

  const isValid = customer && amount && date;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValid || saving) return;
    onSubmit({
      customer_name: customer,
      amount,
      transaction_type: type,
      transaction_date: date,
      note,
    });
  };

  return (
    <div style={modalOverlay}>
      <div style={modalCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 900, fontSize: 18 }}>Add transaction</div>
          <button type="button" onClick={onClose} style={closeBtn}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
          <label style={labelStyle}>
            Customer name
            <input style={inputStyle} value={customer} onChange={(e) => setCustomer(e.target.value)} required />
          </label>
          <label style={labelStyle}>
            Amount
            <input style={inputStyle} type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required />
          </label>
          <label style={labelStyle}>
            Date
            <input style={inputStyle} type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <label style={labelStyle}>
            Type
            <select style={inputStyle} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="CREDIT">Credit (customer owes you)</option>
              <option value="DEBIT">Debit (you owe customer)</option>
            </select>
          </label>
          <label style={labelStyle}>
            Note (optional)
            <textarea style={{ ...inputStyle, minHeight: 80 }} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button type="button" onClick={onClose} style={secondaryBtn}>
              Cancel
            </button>
            <button type="submit" disabled={!isValid || saving} style={primaryBtn(isValid && !saving)}>
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const th = { textAlign: "left", padding: "10px 12px", fontWeight: 800, fontSize: 13 };
const td = { padding: "10px 12px", fontSize: 13, color: "#cbd5e1" };
const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "grid",
  placeItems: "center",
  zIndex: 100,
};
const modalCard = {
  width: "min(520px, 92vw)",
  background: "#0b1220",
  border: "1px solid #1f2937",
  borderRadius: 14,
  padding: 16,
  color: "#e2e8f0",
  display: "grid",
  gap: 12,
};
const labelStyle = { display: "grid", gap: 6, fontWeight: 800 };
const closeBtn = {
  border: "none",
  background: "transparent",
  color: "#e2e8f0",
  fontSize: 20,
  cursor: "pointer",
};
const secondaryBtn = {
  border: "1px solid #334155",
  background: "transparent",
  color: "#e2e8f0",
  padding: "10px 12px",
  borderRadius: 10,
  fontWeight: 800,
  cursor: "pointer",
};
const primaryBtn = (enabled) => ({
  border: "none",
  background: enabled ? "#0ea5e9" : "#334155",
  color: "#0b0b0b",
  padding: "10px 12px",
  borderRadius: 10,
  fontWeight: 900,
  cursor: enabled ? "pointer" : "not-allowed",
});
const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid #1f2937",
  background: "#0f172a",
  color: "#e2e8f0",
  fontSize: 14,
  fontWeight: 700,
};
