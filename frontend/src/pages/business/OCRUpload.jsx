import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCreditSale, addItemToCreditSale } from "../../api/creditSales";
import { createCustomer, getCustomers } from "../../api/customers";
import { createProduct, getProducts } from "../../api/products";
import { processOCR } from "../../api/ocr";
import "./OCRUpload.css";

export default function OCRUpload() {
  const navigate = useNavigate();

  // Stage 1: Image Upload
  const [uploadedImage, setUploadedImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Stage 2: OCR Result & Confirmation
  const [ocrResult, setOcrResult] = useState(null);
  const [formData, setFormData] = useState({
    customer_name: "",
    items: [],
    total_amount: 0,
    note: "",
  });

  const [creatingCreditSale, setCreatingCreditSale] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (event) => {
      setUploadedImage({
        file,
        preview: event.target.result,
      });
    };
    reader.readAsDataURL(file);
  };

  // Send image to OCR backend
  const handleProcessOCR = async () => {
    if (!uploadedImage?.file) {
      setError("Please select an image first");
      return;
    }

    setError("");
    setSuccessMessage("");
    setUploading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("image", uploadedImage.file);

      const response = await processOCR(formDataToSend);
      console.log("OCR Response:", response);

      if (response.status === "success" && response.parsed_data) {
        setOcrResult(response);

        // Initialize form with parsed data
        setFormData({
          customer_name: response.parsed_data.customer_name || "",
          items: response.parsed_data.items || [],
          total_amount: response.parsed_data.total_amount || 0,
          note: "",
        });

        setSuccessMessage("OCR processing complete! Review the data below.");
      } else {
        setError(response.message || "OCR processing failed");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      setError(err.message || "Failed to process image");
    } finally {
      setUploading(false);
    }
  };

  // Handle editable form changes
  const handleCustomerChange = (value) => {
    setFormData((prev) => ({ ...prev, customer_name: value }));
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === "name" ? value : parseFloat(value) || 0,
    };
    // Recalculate subtotal
    if (field === "quantity" || field === "unit_price") {
      newItems[index].subtotal = newItems[index].quantity * newItems[index].unit_price;
    }
    setFormData((prev) => ({ ...prev, items: newItems }));
  };

  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        { name: "", quantity: 1, unit_price: 0, subtotal: 0 },
      ],
    }));
  };

  const handleRemoveItem = (index) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleTotalChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      total_amount: parseFloat(value) || 0,
    }));
  };

  const handleNoteChange = (value) => {
    setFormData((prev) => ({ ...prev, note: value }));
  };

  // Create credit sale from confirmed OCR data
  const handleCreateCreditSale = async () => {
    if (!formData.customer_name.trim()) {
      setError("Customer name is required");
      return;
    }

    if (formData.items.length === 0) {
      setError("At least one item is required");
      return;
    }

    if (formData.total_amount <= 0) {
      setError("Total amount must be greater than 0");
      return;
    }

    setError("");
    setCreatingCreditSale(true);

    try {
      // Step 1: Get or create customer
      console.log("Getting/creating customer...");
      let customerId;
      
      try {
        // Try to find existing customer by name
        const customersRes = await getCustomers();
        const existingCustomer = customersRes.data.results?.find(
          (c) => c.name.toLowerCase() === formData.customer_name.toLowerCase()
        ) || customersRes.data.find(
          (c) => c.name.toLowerCase() === formData.customer_name.toLowerCase()
        );
        
        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log("Found existing customer:", customerId);
        } else {
          // Create new customer
          const customerRes = await createCustomer({ name: formData.customer_name });
          customerId = customerRes.data.id;
          console.log("Created new customer:", customerId);
        }
      } catch (err) {
        throw new Error(`Failed to get/create customer: ${err.message}`);
      }

      // Step 2: Create credit sale with customer ID
      console.log("Creating credit sale...");
      const creditSaleData = {
        customer: customerId,
        notes: formData.note || "",
      };

      const saleResponse = await createCreditSale(creditSaleData);
      const creditSaleId = saleResponse.data.id;
      console.log("Credit Sale Created:", creditSaleId);

      // Step 3: Get or create products and add items to the credit sale
      console.log("Adding items to credit sale...");
      const productsRes = await getProducts();
      const existingProducts = productsRes.data.results || productsRes.data || [];
      
      for (const item of formData.items) {
        if (item.name && item.quantity > 0 && item.unit_price > 0) {
          try {
            // Find or create product
            let productId;
            const existingProduct = existingProducts.find(
              (p) => p.name.toLowerCase() === item.name.toLowerCase()
            );
            
            if (existingProduct) {
              productId = existingProduct.id;
              console.log("Using existing product:", item.name, productId);
            } else {
              // Create new product
              const productRes = await createProduct({
                name: item.name,
                selling_price: item.unit_price,
                category: "OCR Import",
                stock_quantity: 0, // OCR items don't affect inventory
              });
              productId = productRes.data.id;
              console.log("Created new product:", item.name, productId);
            }

            // Add item to credit sale using product ID
            const itemData = {
              product: productId,
              quantity: item.quantity,
              unit_price: item.unit_price,
            };
            await addItemToCreditSale(creditSaleId, itemData);
            console.log("Added item:", item.name);
          } catch (itemErr) {
            console.error("Failed to add item:", item.name, itemErr);
            // Continue adding other items even if one fails
          }
        }
      }

      setSuccessMessage("Credit sale created successfully!");
      setTimeout(() => {
        navigate("/business/credit-sales");
      }, 1500);
    } catch (err) {
      console.error("Error creating credit sale:", err);
      setError(err.response?.data?.detail || err.message || "Failed to create credit sale");
    } finally {
      setCreatingCreditSale(false);
    }
  };

  // Stage 1: Image Upload
  if (!ocrResult) {
    return (
      <div className="ocr-upload-container">
        <div className="ocr-card">
          <div className="ocr-header">
            <h1>📸 Upload Receipt or Bill</h1>
            <p>Upload an image of your handwritten bill or receipt to automatically extract transaction details.</p>
          </div>

          <div className="ocr-upload-area">
            {uploadedImage ? (
              <div className="image-preview">
                <img
                  src={typeof uploadedImage === "string" ? uploadedImage : uploadedImage.preview}
                  alt="Preview"
                />
                <div className="preview-actions">
                  <button
                    onClick={() => {
                      setUploadedImage(null);
                      setOcrResult(null);
                      setFormData({ customer_name: "", items: [], total_amount: 0, note: "" });
                    }}
                    className="btn-secondary"
                  >
                    Choose Different Image
                  </button>
                </div>
              </div>
            ) : (
              <label className="upload-label">
                <div className="upload-icon">📄</div>
                <div className="upload-text">
                  <p className="upload-main">Click to upload or drag & drop</p>
                  <p className="upload-hint">PNG, JPG or GIF (max. 5MB)</p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {successMessage && <div className="alert alert-success">{successMessage}</div>}

          <button
            onClick={handleProcessOCR}
            disabled={!uploadedImage || uploading}
            className="btn-primary"
            style={{ marginTop: 20 }}
          >
            {uploading ? "Processing..." : "Process with OCR"}
          </button>

          <div className="ocr-tips">
            <h3>💡 Tips for Best Results:</h3>
            <ul>
              <li>Use clear, well-lit images</li>
              <li>Ensure text is readable</li>
              <li>Include customer name and total amount</li>
              <li>List items if possible</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  // Stage 2: Review & Confirm
  return (
    <div className="ocr-upload-container">
      <div className="ocr-card">
        <div className="ocr-header">
          <h1>✅ Review OCR Results</h1>
          <p>
            Raw text was extracted and parsed. Please review and edit any incorrect values below.
          </p>

          <div className="ocr-status">
            <span className={`confidence-badge ${ocrResult.confidence}`}>
              Confidence: {(ocrResult.confidence || "medium").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Show raw text for reference */}
        <details className="raw-text-section">
          <summary>📝 Show Raw Text</summary>
          <div className="raw-text-content">
            <pre>{ocrResult.raw_text}</pre>
          </div>
        </details>

        {/* Editable Form */}
        <div className="ocr-form">
          <div className="form-group">
            <label>Customer Name *</label>
            <input
              type="text"
              value={formData.customer_name}
              onChange={(e) => handleCustomerChange(e.target.value)}
              placeholder="Enter customer name"
            />
          </div>

          <div className="items-section">
            <h3>Items ({formData.items.length})</h3>

            <div className="items-list">
              {formData.items.map((item, index) => (
                <div key={index} className="item-row">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={item.name}
                    onChange={(e) => handleItemChange(index, "name", e.target.value)}
                    className="item-input item-name"
                  />
                  <input
                    type="number"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, "quantity", e.target.value)}
                    className="item-input item-qty"
                  />
                  <input
                    type="number"
                    placeholder="Price"
                    value={item.unit_price}
                    onChange={(e) => handleItemChange(index, "unit_price", e.target.value)}
                    className="item-input item-price"
                  />
                  <div className="item-subtotal">
                    ₹ {item.subtotal.toFixed(2)}
                  </div>
                  <button
                    onClick={() => handleRemoveItem(index)}
                    className="btn-remove"
                    title="Remove item"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <button onClick={handleAddItem} className="btn-secondary">
              + Add Item
            </button>
          </div>

          <div className="form-group">
            <label>Total Amount *</label>
            <div className="input-with-currency">
              <span>₹</span>
              <input
                type="number"
                value={formData.total_amount}
                onChange={(e) => handleTotalChange(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Notes (optional)</label>
            <textarea
              value={formData.note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder="Add any additional notes about this transaction"
              rows={3}
            />
          </div>

          {error && <div className="alert alert-error">{error}</div>}
          {successMessage && <div className="alert alert-success">{successMessage}</div>}

          <div className="form-actions">
            <button
              onClick={() => {
                setOcrResult(null);
                setFormData({ customer_name: "", items: [], total_amount: 0, note: "" });
              }}
              className="btn-secondary"
            >
              ← Back to Upload
            </button>
            <button
              onClick={handleCreateCreditSale}
              disabled={creatingCreditSale}
              className="btn-primary"
            >
              {creatingCreditSale ? "Creating..." : "✓ Create Credit Sale"}
            </button>
          </div>
        </div>

        <div className="ocr-warning">
          <p>
            <strong>⚠️ Important:</strong> OCR is a helper tool. Always verify the extracted data is
            correct before saving. You are responsible for the accuracy of the credit sale.
          </p>
        </div>
      </div>
    </div>
  );
}
