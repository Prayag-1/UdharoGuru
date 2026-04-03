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
  const [renderError, setRenderError] = useState("");

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
    setRenderError("");
    setUploading(true);

    try {
      const formDataToSend = new FormData();
      formDataToSend.append("image", uploadedImage.file);

      const response = await processOCR(formDataToSend);
      console.log("OCR Response:", response);

      if (response.status === "success" && response.parsed_data) {
        // Validate that we extracted meaningful data
        const parsedData = response.parsed_data || {};
        const hasCustomerName = parsedData.customer_name && parsedData.customer_name.trim().length > 0;
        const hasItems = Array.isArray(parsedData.items) && parsedData.items.length > 0;
        const hasTotal = parsedData.total_amount && Number(parsedData.total_amount) > 0;

        // If confidence is low and no meaningful data was extracted, allow manual entry
        if (parsedData.confidence === "low" && !hasCustomerName && !hasItems) {
          // Still proceed but show warning
          setSuccessMessage("⚠️ Low confidence extraction. Please review and fill in missing details manually.");
        } else {
          const confidenceColor = {
            high: "✅",
            medium: "⚠️",
            low: "❌",
          }[parsedData.confidence] || "⚠️";
          setSuccessMessage(`${confidenceColor} OCR processing complete! Review and edit the data below.`);
        }

        setOcrResult(response);

        // Initialize form with parsed data, ensuring all item properties exist with proper types
        const normalizedItems = Array.isArray(parsedData.items)
          ? parsedData.items.map((item) => {
              const qty = parseInt(item.quantity) || 1;
              const price = parseFloat(item.unit_price) || 0;
              return {
                name: String(item.name || "").trim(),
                quantity: qty,
                unit_price: price,
                subtotal: qty * price,
              };
            })
          : [];

        setFormData({
          customer_name: String(parsedData.customer_name || "").trim(),
          items: normalizedItems,
          total_amount: parseFloat(parsedData.total_amount) || 0,
          note: parsedData.warning ? `Note: ${parsedData.warning}` : "",
        });
      } else {
        setError(response.message || "OCR processing failed. Please try again.");
      }
    } catch (err) {
      console.error("OCR Error:", err);
      const errorMsg = err.message || err.detail || "Failed to process image. Please try again.";
      setError(errorMsg);
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
    // Validate inputs
    if (!formData.customer_name.trim()) {
      setError("Customer name is required");
      return;
    }

    if (formData.items.length === 0) {
      setError("At least one item is required");
      return;
    }

    const validItems = formData.items.filter(
      (item) => item.name.trim() && item.quantity > 0 && item.unit_price > 0
    );
    if (validItems.length === 0) {
      setError("At least one valid item is required (must have name, quantity > 0, and price > 0)");
      return;
    }

    if (formData.total_amount <= 0) {
      setError("Total amount must be greater than 0");
      return;
    }

    setError("");
    setSuccessMessage("");
    setCreatingCreditSale(true);

    try {
      // Step 1: Get or create customer
      console.log("Step 1: Getting/creating customer...");
      let customerId;

      try {
        const customersRes = await getCustomers();
        const customersList = Array.isArray(customersRes.data)
          ? customersRes.data
          : customersRes.data?.results || [];

        const existingCustomer = customersList.find(
          (c) => c.name && c.name.toLowerCase() === formData.customer_name.toLowerCase()
        );

        if (existingCustomer) {
          customerId = existingCustomer.id;
          console.log("✓ Found existing customer:", customerId);
        } else {
          const customerRes = await createCustomer({
            name: formData.customer_name,
          });
          customerId = customerRes.data.id;
          console.log("✓ Created new customer:", customerId);
        }
      } catch (err) {
        console.error("Customer creation error:", err);
        throw new Error(
          err.response?.data?.detail ||
            err.message ||
            "Failed to get/create customer"
        );
      }

      // Step 2: Create credit sale
      console.log("Step 2: Creating credit sale...");
      let creditSaleId;
      try {
        const creditSaleData = {
          customer: customerId,
          notes: formData.note || "",
        };

        const saleResponse = await createCreditSale(creditSaleData);
        creditSaleId = saleResponse.data.id;
        console.log("✓ Credit Sale created:", creditSaleId);
      } catch (err) {
        console.error("Credit sale creation error:", err);
        throw new Error(
          err.response?.data?.detail ||
            err.message ||
            "Failed to create credit sale"
        );
      }

      // Step 3: Get existing products and add items
      console.log("Step 3: Adding items to credit sale...");
      let addedItemCount = 0;
      let failedItems = [];

      try {
        const productsRes = await getProducts();
        const existingProducts = Array.isArray(productsRes.data)
          ? productsRes.data
          : productsRes.data?.results || [];

        for (const item of validItems) {
          try {
            // Find or create product
            let productId;
            const existingProduct = existingProducts.find(
              (p) => p.name && p.name.toLowerCase() === item.name.toLowerCase()
            );

            if (existingProduct) {
              productId = existingProduct.id;
            } else {
              const productRes = await createProduct({
                name: item.name,
                selling_price: item.unit_price,
                category: "OCR Import",
                stock_quantity: 0,
              });
              productId = productRes.data.id;
              existingProducts.push(productRes.data);
            }

            // Add item to credit sale
            await addItemToCreditSale(creditSaleId, {
              product: productId,
              quantity: item.quantity,
              unit_price: item.unit_price,
            });

            addedItemCount++;
            console.log(`✓ Added item: ${item.name}`);
          } catch (itemErr) {
            console.error(`✗ Failed to add item "${item.name}":`, itemErr);
            failedItems.push(item.name);
          }
        }

        if (addedItemCount === 0) {
          throw new Error("Failed to add any items to the credit sale");
        }

        if (failedItems.length > 0) {
          console.warn(
            `Warning: Failed to add ${failedItems.length} items: ${failedItems.join(", ")}`
          );
        }
      } catch (err) {
        console.error("Item addition error:", err);
        throw new Error(
          failedItems.length > 0
            ? `Added ${addedItemCount} items but failed for: ${failedItems.join(", ")}`
            : err.message || "Failed to add items to credit sale"
        );
      }

      // Success
      console.log(`✓ Credit sale created successfully with ${addedItemCount} items`);
      setSuccessMessage(
        failedItems.length > 0
          ? `✓ Credit sale created with ${addedItemCount} items (${failedItems.length} failed)`
          : "✓ Credit sale created successfully!"
      );

      setTimeout(() => {
        navigate("/business/credit-sales");
      }, 1500);
    } catch (err) {
      console.error("Error creating credit sale:", err);
      setError(err.message || "Failed to create credit sale. Please try again.");
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
  if (ocrResult) {
    // Safety check to ensure we have valid data
    if (!ocrResult.parsed_data) {
      return (
        <div className="ocr-upload-container">
          <div className="ocr-card">
            <div className="ocr-header">
              <h1>❌ Error Processing Image</h1>
              <p>The system could not process the image data properly.</p>
            </div>
            <div className="alert alert-error">
              {error || "An unexpected error occurred while processing the OCR data."}
            </div>
            <button
              onClick={() => {
                setOcrResult(null);
                setFormData({ customer_name: "", items: [], total_amount: 0, note: "" });
                setError("");
              }}
              className="btn-secondary"
              style={{ marginTop: 20 }}
            >
              ← Try Again
            </button>
          </div>
        </div>
      );
    }

    return (
    <div className="ocr-upload-container">
      <div className="ocr-card">
        <div className="ocr-header">
          <h1>✅ Review OCR Results</h1>
          <p>
            Raw text was extracted and parsed. Please review and edit any incorrect values below.
          </p>

          <div className="ocr-status">
            <span className={`confidence-badge ${ocrResult.parsed_data?.confidence || "medium"}`}>
              Confidence: {(ocrResult.parsed_data?.confidence || "medium").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Show raw text for reference */}
        {ocrResult.raw_text && (
          <details className="raw-text-section">
            <summary>📝 Show Raw Text</summary>
            <div className="raw-text-content">
              <pre>{ocrResult.raw_text}</pre>
            </div>
          </details>
        )}

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
                    ₹ {(item.subtotal || 0).toFixed(2)}
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
}
