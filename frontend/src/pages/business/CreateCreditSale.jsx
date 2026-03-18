import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCreditSale, getCreditSales } from "../../api/creditSales";
import { getCustomers } from "../../api/customers";
import { getProducts } from "../../api/products";
import { useAuth } from "../../context/AuthContext";

const inputStyle = {
  border: "1px solid #d7def0",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 14,
  fontFamily: "Inter, system-ui",
  background: "#f9fbff",
  width: "100%",
  boxSizing: "border-box",
};

const labelStyle = {
  display: "grid",
  gap: 6,
  fontWeight: 700,
  color: "#1d2d4a",
};

const formatMoney = (value) => {
  const num = Number(value || 0);
  if (Number.isNaN(num)) return "0.00";
  return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function CreateCreditSale() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState({
    customer: "",
    due_date: "",
    notes: "",
  });

  const [items, setItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState("");
  const [itemQuantity, setItemQuantity] = useState("");
  const [itemUnitPrice, setItemUnitPrice] = useState("");

  const totalAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  }, [items]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const [customersRes, productsRes] = await Promise.all([
          getCustomers(),
          getProducts(),
        ]);
        setCustomers(Array.isArray(customersRes.data) ? customersRes.data : customersRes.data?.results || []);
        setProducts(Array.isArray(productsRes.data) ? productsRes.data : productsRes.data?.results || []);
      } catch {
        setError("Failed to load customers and products");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const selectedProductObj = products.find((p) => String(p.id) === selectedProduct);
  const availableStock = selectedProductObj?.stock_quantity || 0;

  const addItem = () => {
    if (!selectedProduct || !itemQuantity || !itemUnitPrice) {
      setError("Please fill in all item fields");
      return;
    }

    const quantity = Number(itemQuantity);
    const unitPrice = Number(itemUnitPrice);

    if (quantity <= 0 || unitPrice < 0) {
      setError("Invalid quantity or price");
      return;
    }

    if (quantity > availableStock) {
      setError(`Insufficient stock. Available: ${availableStock}`);
      return;
    }

    const product = selectedProductObj;
    const existingIndex = items.findIndex((item) => item.product === product.id);

    if (existingIndex >= 0) {
      const newQuantity = items[existingIndex].quantity + quantity;
      if (newQuantity > availableStock) {
        setError(`Total quantity exceeds stock. Available: ${availableStock}`);
        return;
      }
      items[existingIndex].quantity = newQuantity;
      items[existingIndex].unit_price = unitPrice;
      setItems([...items]);
    } else {
      setItems([
        ...items,
        {
          product: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity,
          unit_price: unitPrice,
          subtotal: quantity * unitPrice,
        },
      ]);
    }

    setSelectedProduct("");
    setItemQuantity("");
    setItemUnitPrice("");
    setError("");
  };

  const removeItem = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const generateInvoiceNumber = () => {
    return `INV-${Date.now()}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!formData.customer) {
      setError("Please select a customer");
      return;
    }

    if (items.length === 0) {
      setError("Please add at least one item");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        customer: formData.customer,
        invoice_number: generateInvoiceNumber(),
        due_date: formData.due_date || null,
        notes: formData.notes,
        amount_paid: 0,
      };

      const response = await createCreditSale(payload);
      const saleId = response.data.id;

      // Add items to the sale
      const itemRequests = items.map((item) =>
        fetch(`/api/credit-sales/${saleId}/add_item/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
          body: JSON.stringify({
            product: item.product,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }),
        })
      );

      await Promise.all(itemRequests);
      navigate(`/business/credit-sales/${saleId}`);
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create credit sale");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", padding: "28px 24px", fontFamily: "Inter, system-ui" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ marginBottom: 24 }}>
          <button
            onClick={() => navigate("/business/credit-sales")}
            style={{
              background: "none",
              border: "none",
              color: "#2563eb",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            ← Back to Credit Sales
          </button>
        </div>

        <div style={{ background: "#ffffff", borderRadius: 14, padding: 24, border: "1px solid #e2e8f0" }}>
          <div style={{ fontSize: 24, fontWeight: 900, color: "#0f172a", marginBottom: 20 }}>Create Credit Sale</div>

          {error && (
            <div style={{ padding: 12, borderRadius: 12, border: "1px solid #fecdd3", background: "#fff1f2", color: "#b91c1c", fontWeight: 700, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: 20 }}>
            {/* Customer Selection */}
            <label style={labelStyle}>
              <span>Customer *</span>
              <select
                style={inputStyle}
                value={formData.customer}
                onChange={(e) => setFormData({ ...formData, customer: e.target.value })}
                required
              >
                <option value="">-- Select Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {/* Due Date */}
            <label style={labelStyle}>
              <span>Due Date</span>
              <input
                type="date"
                style={inputStyle}
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </label>

            {/* Notes */}
            <label style={labelStyle}>
              <span>Notes</span>
              <textarea
                style={{ ...inputStyle, minHeight: 80, fontFamily: "Inter, system-ui", resize: "vertical" }}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              />
            </label>

            {/* Items Section */}
            <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a", marginBottom: 16 }}>Add Products *</div>

              <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
                <label style={labelStyle}>
                  <span>Product</span>
                  <select style={inputStyle} value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)}>
                    <option value="">-- Select Product --</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (Stock: {p.stock_quantity})
                      </option>
                    ))}
                  </select>
                </label>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <label style={labelStyle}>
                    <span>Quantity *</span>
                    <input
                      type="number"
                      step="1"
                      min="1"
                      style={inputStyle}
                      value={itemQuantity}
                      onChange={(e) => setItemQuantity(e.target.value)}
                      placeholder="0"
                    />
                    {selectedProductObj && (
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                        Available: {selectedProductObj.stock_quantity}
                      </div>
                    )}
                  </label>

                  <label style={labelStyle}>
                    <span>Unit Price *</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      style={inputStyle}
                      value={itemUnitPrice}
                      onChange={(e) => setItemUnitPrice(e.target.value)}
                      placeholder="0.00"
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#0f172a",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Add Item
                </button>
              </div>

              {/* Items List */}
              {items.length > 0 && (
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.5fr", gap: 8, padding: "10px 12px", background: "#f8fafc", fontWeight: 700, fontSize: 13 }}>
                    <div>Product</div>
                    <div>Qty</div>
                    <div>Unit Price</div>
                    <div>Subtotal</div>
                    <div></div>
                  </div>
                  {items.map((item, idx) => (
                    <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 0.5fr", gap: 8, padding: "10px 12px", borderTop: "1px solid #e2e8f0", alignItems: "center" }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{item.product_name}</div>
                      <div style={{ fontSize: 14 }}>{item.quantity}</div>
                      <div style={{ fontSize: 14 }}>Rs. {formatMoney(item.unit_price)}</div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>Rs. {formatMoney(item.subtotal)}</div>
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        style={{
                          background: "#fee2e2",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          padding: "4px 8px",
                          borderRadius: 4,
                          fontWeight: 700,
                          fontSize: 12,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Total */}
              <div style={{ marginTop: 16, padding: "12px 14px", background: "#f0f9ff", borderRadius: 8, textAlign: "right" }}>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 4 }}>Total Amount:</div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#0f172a" }}>Rs. {formatMoney(totalAmount)}</div>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #e2e8f0", paddingTop: 20 }}>
              <button
                type="button"
                onClick={() => navigate("/business/credit-sales")}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
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
                disabled={items.length === 0 || submitting}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "none",
                  background: "#2563eb",
                  color: "#ffffff",
                  fontWeight: 900,
                  cursor: items.length === 0 || submitting ? "not-allowed" : "pointer",
                  opacity: items.length === 0 || submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Creating..." : "Create Sale"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
