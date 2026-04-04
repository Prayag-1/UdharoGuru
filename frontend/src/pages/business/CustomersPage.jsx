import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from "../../api/customers";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import AddCustomerModal from "./AddCustomerModal";

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CustomersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
    }
  }, [user, navigate]);

  const loadCustomers = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getCustomers();
      const items = Array.isArray(data) ? data : data?.results || [];
      setCustomers(items);
    } catch {
      setError("Unable to load customers right now.");
      setCustomers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user || user.account_type !== "BUSINESS") return;
    loadCustomers();
  }, [user?.id]);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditing(customer);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (editing) {
      await updateCustomer(editing.id, payload);
    } else {
      await createCustomer(payload);
    }
    setModalOpen(false);
    setEditing(null);
    await loadCustomers();
  };

  const handleDelete = async (customer) => {
    if (!window.confirm(`Delete ${customer.name}?`)) return;
    await deleteCustomer(customer.id);
    await loadCustomers();
  };

  const totalOutstanding = useMemo(() => {
    return customers.reduce((sum, customer) => sum + Number(customer.outstanding_balance || 0), 0);
  }, [customers]);

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Customers</div>
            <div style={{ color: "#475569" }}>Track credit customers and outstanding balances.</div>
          </div>
          <button
            onClick={openCreate}
            style={{
              color: "#ffffff",
              fontWeight: 800,
              border: "none",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#2563eb",
              cursor: "pointer",
            }}
          >
            Add Customer
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 12 }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Total customers</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{customers.length}</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Total outstanding</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(totalOutstanding)}</div>
          </div>
        </div>

        <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Customer list</div>
              <div style={{ color: "#475569" }}>Review credit balances and profiles.</div>
            </div>
          </div>

          {loading ? (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 12, display: "grid", gap: 8 }}>
              {[...Array(4)].map((_, idx) => (
                <div key={idx} style={{ height: 18, borderRadius: 8, background: "#e2e8f0" }} />
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#475569", textAlign: "center" }}>
              No customers yet. Add your first credit customer.
            </div>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", background: "#f8fafc", fontWeight: 800, color: "#0f172a", fontSize: 13 }}>
                <div>Customer</div>
                <div>Phone</div>
                <div>Outstanding</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>
              {customers.map((customer) => (
                <div key={customer.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 8, padding: "12px 14px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
                  <div style={{ display: "grid" }}>
                    <span style={{ fontWeight: 800, color: "#0f172a" }}>{customer.name}</span>
                    <span style={{ fontSize: 12, color: "#64748b" }}>{customer.address || "No address"}</span>
                  </div>
                  <div style={{ color: "#0f172a" }}>{customer.phone || "-"}</div>
                  <div style={{ color: "#0f172a", fontWeight: 800 }}>Rs. {formatMoney(customer.outstanding_balance)}</div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                    <Link
                      to={`/business/customers/${customer.id}`}
                      style={{
                        color: "#0f172a",
                        fontWeight: 800,
                        border: "1px solid #cbd5e1",
                        padding: "6px 10px",
                        borderRadius: 10,
                        textDecoration: "none",
                        background: "#f8fafc",
                      }}
                    >
                      View
                    </Link>
                    <button
                      onClick={() => openEdit(customer)}
                      style={{
                        color: "#0f172a",
                        fontWeight: 800,
                        border: "1px solid #cbd5e1",
                        padding: "6px 10px",
                        borderRadius: 10,
                        background: "#ffffff",
                        cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(customer)}
                      style={{
                        color: "#b91c1c",
                        fontWeight: 800,
                        border: "1px solid #fecdd3",
                        padding: "6px 10px",
                        borderRadius: 10,
                        background: "#fff1f2",
                        cursor: "pointer",
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <AddCustomerModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initialData={editing}
      />
    </div>
  );
}
