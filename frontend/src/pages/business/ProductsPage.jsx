import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getProducts, createProduct, deleteProduct } from "../../api/products";
import { useAuth } from "../../context/AuthContext";
import "./ProductsPage.css";

const formatCurrency = (value) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

export default function ProductsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    selling_price: "",
    stock_quantity: "",
    sku: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await getProducts();
      const items = Array.isArray(response.data)
        ? response.data
        : response.data?.results || [];
      setProducts(items);
    } catch (err) {
      console.error("Failed to load products:", err);
      setError("Failed to load products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = () => {
    setFormData({
      name: "",
      category: "",
      selling_price: "",
      stock_quantity: "",
      sku: "",
    });
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setFormData({
      name: "",
      category: "",
      selling_price: "",
      stock_quantity: "",
      sku: "",
    });
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddProduct = async () => {
    if (!formData.name.trim()) {
      setError("Product name is required");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const productData = {
        name: formData.name,
        category: formData.category || "General",
        selling_price: parseFloat(formData.selling_price) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        sku: formData.sku || "",
      };

      await createProduct(productData);
      handleCloseModal();
      await loadProducts();
    } catch (err) {
      console.error("Failed to create product:", err);
      setError(err.response?.data?.detail || "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm("Are you sure you want to delete this product?")) {
      return;
    }

    try {
      await deleteProduct(id);
      await loadProducts();
    } catch (err) {
      console.error("Failed to delete product:", err);
      setError("Failed to delete product");
    }
  };

  return (
    <div className="products-container">
      {/* Header */}
      <div className="products-header">
        <div>
          <h1 className="products-title">Products</h1>
          <p className="products-subtitle">Manage your product catalog</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn-primary" onClick={handleOpenModal}>
            Add Product
          </button>
          <button 
            className="btn-secondary"
            onClick={() => navigate("/business/ocr")}
          >
            📄 OCR Invoice
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && <div className="error-banner">{error}</div>}

      {/* Products Table */}
      {loading ? (
        <div className="loading-state">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="empty-state">
          <p className="empty-title">No Products Yet</p>
          <p className="empty-hint">
            Add your first product to get started creating credit sales.
          </p>
          <button className="btn-primary" onClick={handleOpenModal}>
            Add Product
          </button>
        </div>
      ) : (
        <div className="products-card">
          <div className="table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id} className="table-row">
                    <td className="product-name">{product.name}</td>
                    <td>{product.category || "—"}</td>
                    <td className="product-price">
                      {formatCurrency(product.selling_price)}
                    </td>
                    <td>
                      <span
                        className={`stock-badge ${
                          product.stock_quantity > 0 ? "in-stock" : "out-of-stock"
                        }`}
                      >
                        {product.stock_quantity}
                      </span>
                    </td>
                    <td className="table-actions">
                      <button
                        className="btn-delete"
                        onClick={() => handleDeleteProduct(product.id)}
                        title="Delete product"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Add Product</h2>
              <button
                className="modal-close"
                onClick={handleCloseModal}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Enter product name"
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <input
                  type="text"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  placeholder="e.g., Electronics, Groceries"
                  className="form-input"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Selling Price</label>
                  <input
                    type="number"
                    name="selling_price"
                    value={formData.selling_price}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="form-input"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Stock Quantity</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={formData.stock_quantity}
                    onChange={handleInputChange}
                    placeholder="0"
                    className="form-input"
                    min="0"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">SKU</label>
                <input
                  type="text"
                  name="sku"
                  value={formData.sku}
                  onChange={handleInputChange}
                  placeholder="Optional"
                  className="form-input"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={handleCloseModal}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleAddProduct}
                disabled={submitting || !formData.name.trim()}
              >
                {submitting ? "Adding..." : "Add Product"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
