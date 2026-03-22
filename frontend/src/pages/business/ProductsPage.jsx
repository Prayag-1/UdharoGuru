import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { createProduct, deleteProduct, getProducts, updateProduct } from "../../api/products";
import { resolveHomeRoute, useAuth } from "../../context/AuthContext";
import BusinessNav from "../../components/BusinessNav";

const inputStyle = {
  border: "1px solid #d7def0",
  borderRadius: 12,
  padding: "12px 14px",
  fontSize: 14,
  fontFamily: "Inter, system-ui",
  background: "#f9fbff",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#1d2d4a",
};

const gridTwo = { display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" };

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function ProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
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

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await getProducts();
      const items = Array.isArray(data) ? data : data?.results || [];
      setProducts(items);
    } catch {
      setError("Unable to load products right now.");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setModalOpen(true);
  };

  const handleSave = async (payload) => {
    if (editing) {
      await updateProduct(editing.id, payload);
    } else {
      await createProduct(payload);
    }
    setModalOpen(false);
    setEditing(null);
    await loadProducts();
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    await deleteProduct(product.id);
    await loadProducts();
  };

  const inventoryValue = useMemo(() => {
    return products.reduce((sum, product) => {
      const cost = Number(product.cost_price || 0);
      const stock = Number(product.stock_quantity || 0);
      return sum + cost * stock;
    }, 0);
  }, [products]);

  return (
    <>
      <BusinessNav />
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#0f172a" }}>Products</div>
            <div style={{ color: "#475569" }}>Manage inventory and track stock levels.</div>
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
            Add Product
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700 }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px,1fr))", gap: 12 }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Total products</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>{products.length}</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, display: "grid", gap: 6 }}>
            <div style={{ color: "#475569", fontWeight: 700, fontSize: 13 }}>Inventory value</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(inventoryValue)}</div>
          </div>
        </div>

        <div style={{ border: "1px solid #e2e8f0", background: "#ffffff", borderRadius: 14, padding: 14, display: "grid", gap: 10 }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>Product catalog</div>
            <div style={{ color: "#475569" }}>Track cost, selling price, and stock.</div>
          </div>

          {loading ? (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, background: "#f8fafc", padding: 12, display: "grid", gap: 8 }}>
              {[...Array(4)].map((_, idx) => (
                <div key={idx} style={{ height: 18, borderRadius: 8, background: "#e2e8f0" }} />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div style={{ padding: 14, borderRadius: 12, border: "1px dashed #cbd5e1", color: "#475569", textAlign: "center" }}>
              No products yet. Add your first product.
            </div>
          ) : (
            <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", background: "#f8fafc", fontWeight: 800, color: "#0f172a", fontSize: 13 }}>
                <div>Product</div>
                <div>Stock</div>
                <div>Cost</div>
                <div>Selling</div>
                <div style={{ textAlign: "right" }}>Actions</div>
              </div>
              {products.map((product) => {
                const lowStock = Number(product.stock_quantity || 0) <= Number(product.low_stock_threshold || 0);
                return (
                  <div key={product.id} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 8, padding: "12px 14px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
                    <div style={{ display: "grid" }}>
                      <span style={{ fontWeight: 800, color: "#0f172a" }}>{product.name}</span>
                      <span style={{ fontSize: 12, color: "#64748b" }}>{product.sku || "No SKU"}</span>
                    </div>
                    <div style={{ color: lowStock ? "#b91c1c" : "#0f172a", fontWeight: 800 }}>
                      {product.stock_quantity} {product.unit || ""}
                    </div>
                    <div style={{ color: "#0f172a" }}>Rs. {formatMoney(product.cost_price)}</div>
                    <div style={{ color: "#0f172a" }}>Rs. {formatMoney(product.selling_price)}</div>
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
                      <button
                        onClick={() => openEdit(product)}
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
                        onClick={() => handleDelete(product)}
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
                );
              })}
            </div>
          )}
        </div>
      </div>

      <ProductModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
        initialData={editing}
      />
    </div>
    </>
  );
}

function ProductModal({ open, onClose, onSave, initialData }) {
  const [form, setForm] = useState({
    name: "",
    sku: "",
    category: "",
    cost_price: "0",
    selling_price: "0",
    stock_quantity: "0",
    low_stock_threshold: "0",
    unit: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      name: initialData?.name || "",
      sku: initialData?.sku || "",
      category: initialData?.category || "",
      cost_price: initialData?.cost_price ?? "0",
      selling_price: initialData?.selling_price ?? "0",
      stock_quantity: initialData?.stock_quantity ?? "0",
      low_stock_threshold: initialData?.low_stock_threshold ?? "0",
      unit: initialData?.unit || "",
    });
  }, [open, initialData]);

  const isValid = useMemo(() => {
    return (
      form.name &&
      form.cost_price !== "" &&
      form.selling_price !== "" &&
      form.stock_quantity !== "" &&
      !Number.isNaN(Number(form.cost_price)) &&
      !Number.isNaN(Number(form.selling_price)) &&
      !Number.isNaN(Number(form.stock_quantity))
    );
  }, [form]);

  const handleChange = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isValid || submitting) return;
    setSubmitting(true);
    try {
      await onSave({
        ...form,
        cost_price: Number(form.cost_price || 0),
        selling_price: Number(form.selling_price || 0),
        stock_quantity: Number(form.stock_quantity || 0),
        low_stock_threshold: Number(form.low_stock_threshold || 0),
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 50,
      }}
    >
      <div
        style={{
          width: "min(720px, 100%)",
          background: "#ffffff",
          borderRadius: 18,
          padding: 22,
          boxShadow: "0 20px 60px rgba(15,23,42,0.28)",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 18, color: "#0f1f40", marginBottom: 12 }}>
          {initialData ? "Edit Product" : "Add New Product"}
        </div>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          <div style={gridTwo}>
            <label style={labelStyle}>
              <span>Product Name *</span>
              <input style={inputStyle} value={form.name} onChange={(e) => handleChange("name", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>SKU</span>
              <input style={inputStyle} value={form.sku} onChange={(e) => handleChange("sku", e.target.value)} />
            </label>
            <label style={labelStyle}>
              <span>Category</span>
              <input style={inputStyle} value={form.category} onChange={(e) => handleChange("category", e.target.value)} />
            </label>
            <label style={labelStyle}>
              <span>Unit</span>
              <input style={inputStyle} value={form.unit} onChange={(e) => handleChange("unit", e.target.value)} placeholder="pcs, kg, box" />
            </label>
            <label style={labelStyle}>
              <span>Cost Price *</span>
              <input type="number" step="0.01" style={inputStyle} value={form.cost_price} onChange={(e) => handleChange("cost_price", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Selling Price *</span>
              <input type="number" step="0.01" style={inputStyle} value={form.selling_price} onChange={(e) => handleChange("selling_price", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Stock Quantity *</span>
              <input type="number" step="1" style={inputStyle} value={form.stock_quantity} onChange={(e) => handleChange("stock_quantity", e.target.value)} required />
            </label>
            <label style={labelStyle}>
              <span>Low Stock Threshold</span>
              <input type="number" step="1" style={inputStyle} value={form.low_stock_threshold} onChange={(e) => handleChange("low_stock_threshold", e.target.value)} />
            </label>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #cbd5e1",
                background: "#f8fafc",
                color: "#0f172a",
                fontWeight: 800,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid || submitting}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "#2563eb",
                color: "#ffffff",
                fontWeight: 900,
                cursor: !isValid || submitting ? "not-allowed" : "pointer",
                opacity: !isValid || submitting ? 0.7 : 1,
              }}
            >
              {submitting ? "Saving..." : initialData ? "Update Product" : "Create Product"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
