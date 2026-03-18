import React, { useState, useEffect } from "react";
import { getCustomerLedger } from "../api/ledger";
import "./LedgerSection.css";

export default function LedgerSection({ customerId }) {
  const [ledgerData, setLedgerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!customerId) return;

    setLoading(true);
    getCustomerLedger(customerId)
      .then((response) => {
        setLedgerData(response.data);
        setError(null);
      })
      .catch((err) => {
        console.error("Failed to load ledger:", err);
        setError("Failed to load ledger");
      })
      .finally(() => setLoading(false));
  }, [customerId]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(amount);
  };

  const getTypeBadgeClass = (type) => {
    switch (type) {
      case "CREDIT_SALE":
        return "badge-sale";
      case "PAYMENT":
        return "badge-payment";
      case "OPENING_BALANCE":
        return "badge-opening";
      default:
        return "badge-default";
    }
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case "CREDIT_SALE":
        return "Credit Sale";
      case "PAYMENT":
        return "Payment";
      case "OPENING_BALANCE":
        return "Opening Balance";
      default:
        return type;
    }
  };

  if (loading) {
    return <div className="ledger-loading">Loading ledger...</div>;
  }

  if (error) {
    return <div className="ledger-error">{error}</div>;
  }

  if (!ledgerData || !ledgerData.entries || ledgerData.entries.length === 0) {
    return (
      <div className="ledger-empty">
        <p>No transactions yet</p>
      </div>
    );
  }

  return (
    <div className="ledger-section">
      <div className="ledger-header">
        <h3>Transaction Ledger</h3>
        <div className="ledger-summary">
          <div className="summary-item">
            <span className="label">Opening Balance:</span>
            <span className="value">{formatCurrency(ledgerData.opening_balance)}</span>
          </div>
          <div className="summary-item">
            <span className="label">Current Balance:</span>
            <span className={`value ${ledgerData.current_balance >= 0 ? "positive" : "negative"}`}>
              {formatCurrency(ledgerData.current_balance)}
            </span>
          </div>
        </div>
      </div>

      <div className="ledger-table-container">
        <table className="ledger-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Description</th>
              <th className="amount-col">Amount</th>
              <th className="balance-col">Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {ledgerData.entries.map((entry, idx) => (
              <tr key={idx} className={`entry-row entry-${entry.type.toLowerCase()}`}>
                <td className="date-col">{new Date(entry.date).toLocaleDateString()}</td>
                <td>
                  <span className={`badge ${getTypeBadgeClass(entry.type)}`}>
                    {getTypeLabel(entry.type)}
                  </span>
                </td>
                <td className="description-col">{entry.description}</td>
                <td className="amount-col">{formatCurrency(entry.amount)}</td>
                <td className={`balance-col ${entry.running_balance >= 0 ? "positive" : "negative"}`}>
                  {formatCurrency(entry.running_balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
