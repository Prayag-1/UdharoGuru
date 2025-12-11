import { useEffect, useState } from "react";
import { getCustomers } from "../api/customers";
import {
  getTransactions,
  createTransaction,
  getSummary,
} from "../api/transactions";

const Transactions = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({
    customer: "",
    amount: "",
    transaction_type: "CREDIT",
    description: "",
  });

  const loadCustomers = async () => {
    const res = await getCustomers();
    setCustomers(res.data);
  };

  const loadTransactions = async () => {
    if (!selectedCustomer) return;
    const res = await getTransactions(selectedCustomer);
    setTransactions(res.data);

    const summaryRes = await getSummary(selectedCustomer);
    setSummary(summaryRes.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createTransaction(form);
    setShowForm(false);
    setForm({
      customer: selectedCustomer,
      amount: "",
      transaction_type: "CREDIT",
      description: "",
    });
    loadTransactions();
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  useEffect(() => {
    setForm({ ...form, customer: selectedCustomer });
    loadTransactions();
  }, [selectedCustomer]);

  return (
    <div style={{ padding: 20 }}>
      <h1>Ledger</h1>

      {/* Customer Selector */}
      <div style={{ marginBottom: 20 }}>
        <select
          value={selectedCustomer}
          onChange={(e) => setSelectedCustomer(e.target.value)}
          style={{ padding: 10, fontSize: "16px" }}
        >
          <option value="">Select Customer</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary Card */}
      {summary && (
        <div
          style={{
            marginBottom: 30,
            padding: 20,
            background: "#f4f4f4",
            borderRadius: 10,
          }}
        >
          <h3>Balance Summary</h3>
          <p><strong>Total Credit:</strong> Rs {summary.credit_total}</p>
          <p><strong>Total Debit:</strong> Rs {summary.debit_total}</p>
          <p><strong>Balance:</strong> Rs {summary.balance}</p>
        </div>
      )}

      {/* Add Transaction Button */}
      {selectedCustomer && (
        <button
          style={{
            padding: "10px 20px",
            background: "black",
            color: "white",
            borderRadius: 8,
            cursor: "pointer",
          }}
          onClick={() => setShowForm(true)}
        >
          + Add Credit / Debit
        </button>
      )}

      {/* Modal Form */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <form
            onSubmit={handleSubmit}
            style={{
              background: "white",
              padding: 30,
              width: "350px",
              borderRadius: 10,
            }}
          >
            <h3>Add Transaction</h3>

            <input
              placeholder="Amount"
              type="number"
              value={form.amount}
              onChange={(e) =>
                setForm({ ...form, amount: e.target.value })
              }
              style={{ width: "100%", padding: 10, marginTop: 10 }}
            />

            <select
              value={form.transaction_type}
              onChange={(e) =>
                setForm({ ...form, transaction_type: e.target.value })
              }
              style={{ width: "100%", padding: 10, marginTop: 10 }}
            >
              <option value="CREDIT">Credit</option>
              <option value="DEBIT">Debit</option>
            </select>

            <input
              placeholder="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              style={{ width: "100%", padding: 10, marginTop: 10 }}
            />

            <button
              type="submit"
              style={{
                width: "100%",
                marginTop: 15,
                padding: 10,
                background: "black",
                color: "white",
                borderRadius: 8,
              }}
            >
              Save
            </button>

            <button
              onClick={() => setShowForm(false)}
              type="button"
              style={{
                width: "100%",
                marginTop: 10,
                padding: 10,
                background: "lightgray",
                borderRadius: 8,
              }}
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Transaction List */}
      <div style={{ marginTop: 30 }}>
        <h3>Transactions</h3>
        {transactions.length === 0 && <p>No transactions yet.</p>}

        {transactions.map((t) => (
          <div
            key={t.id}
            style={{
              padding: 12,
              marginBottom: 10,
              background: t.transaction_type === "CREDIT" ? "#d1ffd1" : "#ffd1d1",
              borderRadius: 8,
            }}
          >
            <strong>{t.transaction_type}</strong>  
            <span style={{ float: "right" }}>Rs {t.amount}</span>
            <p style={{ margin: 0 }}>{t.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Transactions;
