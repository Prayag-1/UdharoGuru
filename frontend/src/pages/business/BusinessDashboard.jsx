import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { getBusinessLedger, getBusinessLedgerSummary, listBusinessOcr } from "../../api/business";
import { useAuth } from "../../context/AuthContext";
import { useBusinessGate } from "../../hooks/useBusinessGate";
import { LedgerHeader, LedgerRow, formatMoney } from "./components/LedgerRow";

const initialSummary = {
  receivable: 0,
  payable: 0,
  net: 0,
  pending_ocr_drafts: 0,
};

const deriveSummary = (rows, draftCount = 0) => {
  let receivable = 0;
  let payable = 0;
  rows.forEach((tx) => {
    if (tx.is_settled === true) return;
    const amount = Number(tx.amount || 0);
    if (Number.isNaN(amount)) return;
    const type = (tx.transaction_type || "").toUpperCase();
    if (type === "CREDIT") receivable += amount;
    else if (type === "DEBIT") payable += amount;
  });
  return {
    receivable,
    payable,
    net: receivable - payable,
    pending_ocr_drafts: draftCount || 0,
  };
};

const normalizeSummaryResponse = (data) => {
  const toNumber = (val) => {
    const num = Number(val || 0);
    return Number.isNaN(num) ? 0 : num;
  };
  const receivable = toNumber(data?.receivable);
  const payable = toNumber(data?.payable);
  const net = data && Object.prototype.hasOwnProperty.call(data, "net") ? toNumber(data.net) : receivable - payable;
  const pending = Number.isFinite(Number(data?.pending_ocr_drafts))
    ? Number(data.pending_ocr_drafts)
    : 0;
  return {
    receivable,
    payable,
    net,
    pending_ocr_drafts: pending,
  };
};

export default function BusinessDashboard() {
  const { user } = useAuth();
  const gate = useBusinessGate("/business/dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(initialSummary);
  const [summarySource, setSummarySource] = useState("api");
  const [ledger, setLedger] = useState([]);
  const hasFetched = useRef(false);

  const verified = user?.business_status === "APPROVED";
  const canView = user && user.account_type === "BUSINESS" && verified;
  const gateMessage = !user
    ? "Login required to view the business dashboard."
    : user.account_type !== "BUSINESS"
      ? "Business account required."
      : `Business dashboard is available after KYC approval. Current status: ${user.business_status || "pending"}.`;

  const fetchDraftCount = async () => {
    try {
      const { data } = await listBusinessOcr();
      const docs = Array.isArray(data) ? data : data?.results || [];
      return docs.filter((doc) => (doc.status || "").toUpperCase() === "DRAFT").length;
    } catch {
      return 0;
    }
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const ledgerPromise = getBusinessLedger();
      const summaryPromise = getBusinessLedgerSummary().catch((err) => ({ __error: err }));
      const [ledgerRes, summaryRes] = await Promise.all([ledgerPromise, summaryPromise]);

      const ledgerRows = Array.isArray(ledgerRes.data) ? ledgerRes.data : ledgerRes.data?.results || [];
      setLedger(ledgerRows);

      if (summaryRes && !summaryRes.__error && summaryRes.data) {
        setSummary(normalizeSummaryResponse(summaryRes.data));
        setSummarySource("api");
      } else {
        const draftCount = await fetchDraftCount();
        setSummary(deriveSummary(ledgerRows, draftCount));
        setSummarySource("client");
      }
    } catch (err) {
      setError("Unable to load dashboard data right now.");
      setLedger([]);
      setSummary(initialSummary);
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
    loadDashboard();
  }, [gate.loading, canView]);

  const recentLedger = useMemo(() => {
    const sorted = [...ledger];
    sorted.sort((a, b) => {
      const aDate = new Date(a.transaction_date || a.created_at || 0).getTime();
      const bDate = new Date(b.transaction_date || b.created_at || 0).getTime();
      return bDate - aDate;
    });
    return sorted.slice(0, 5);
  }, [ledger]);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Business Dashboard</div>
            <div style={{ color: "#475569" }}>
              Instant financial clarity for your ledger and OCR drafts.
            </div>
          </div>
          <Link
            to="/business/ocr"
            style={{
              color: "#0f172a",
              fontWeight: 800,
              border: "1px solid #cbd5e1",
              padding: "10px 12px",
              borderRadius: 10,
              background: "#ffffff",
              textDecoration: "none",
            }}
          >
            View OCR
          </Link>
        </div>

        {!canView ? (
          <div style={{ padding: 16, borderRadius: 12, border: "1px solid #e2e8f0", background: "#ffffff", color: "#0f172a", fontWeight: 700 }}>
            {gateMessage}
          </div>
        ) : (
          <>
            {error && (
              <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
                {error}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))", gap: 12 }}>
              <SummaryCard label="Total receivable" value={formatMoney(summary.receivable)} loading={loading} />
              <SummaryCard label="Total payable" value={formatMoney(summary.payable)} loading={loading} />
              <SummaryCard label="Net balance" value={formatMoney(summary.net)} loading={loading} />
              <SummaryCard label="Pending OCR drafts" value={summary.pending_ocr_drafts} loading={loading} />
            </div>
            <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700 }}>
              {summarySource === "api" ? "Using summary endpoint" : "Summary derived from ledger and OCR drafts"}
            </div>

            <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Latest ledger activity</div>
                  <div style={{ color: "#475569" }}>Most recent five transactions.</div>
                </div>
                <Link
                  to="/business/ledger"
                  style={{
                    color: "#0f172a",
                    fontWeight: 800,
                    border: "1px solid #cbd5e1",
                    padding: "8px 10px",
                    borderRadius: 10,
                    textDecoration: "none",
                    background: "#f8fafc",
                  }}
                >
                  View all ledger
                </Link>
              </div>

              {loading ? (
                <LedgerPlaceholder />
              ) : recentLedger.length === 0 ? (
                <div style={{ padding: 14, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#475569", textAlign: "center" }}>
                  No transactions yet. Confirm OCR receipts or add entries in your ledger.
                </div>
              ) : (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
                  <LedgerHeader />
                  {recentLedger.map((tx) => (
                    <LedgerRow key={tx.id} tx={tx} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, loading }) {
  return (
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
      <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>{label}</div>
      {loading ? (
        <div style={{ height: 26, borderRadius: 8, background: "#e2e8f0" }} />
      ) : (
        <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{value}</div>
      )}
    </div>
  );
}

function LedgerPlaceholder() {
  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 12, display: "grid", gap: 8 }}>
      {[...Array(4)].map((_, idx) => (
        <div key={idx} style={{ height: 18, borderRadius: 8, background: "#e2e8f0" }} />
      ))}
    </div>
  );
}
