import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createPaymentRequest, listPendingCustomerRequests } from '../../api/paymentRequest';
import { getCreditSales } from '../../api/business';
import api from '../../api/apiClient';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import '../../styles/BusinessPaymentRequest.css';

export default function BusinessPaymentRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [step, setStep] = useState('customer'); // 'customer', 'amount', 'confirm'
  
  // Form state
  const [customers, setCustomers] = useState([]);
  const [creditSales, setCreditSales] = useState([]);
  const [formData, setFormData] = useState({
    customer_id: '',
    credit_sale_id: '',
    amount: '',
    description: '',
  });

  // Payment requests
  const [pendingRequests, setPendingRequests] = useState([]);
  const [showQRModal, setShowQRModal] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== 'BUSINESS') {
      navigate('/');
      return;
    }

    loadCustomers();
    loadPendingRequests();
  }, [user]);

  const loadCustomers = async () => {
    try {
      const response = await api.get('/customers/');
      setCustomers(response.data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    }
  };

  const loadCreditSales = async (customerId) => {
    try {
      const response = await getCreditSales();
      // Filter to get only pending/partial sales for selected customer
      const filtered = response.data.filter(
        sale => sale.customer === parseInt(customerId) && 
                 (sale.status === 'PENDING' || sale.status === 'PARTIAL')
      );
      setCreditSales(filtered);
    } catch (err) {
      console.error('Failed to load credit sales:', err);
    }
  };

  const loadPendingRequests = async () => {
    try {
      const response = await listPendingCustomerRequests();
      setPendingRequests(response.data);
    } catch (err) {
      console.error('Failed to load pending requests:', err);
    }
  };

  const handleCustomerSelect = (customerId) => {
    setFormData(prev => ({
      ...prev,
      customer_id: customerId,
      credit_sale_id: '',
      amount: '',
    }));
    loadCreditSales(customerId);
    setStep('amount');
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const requestData = {
        request_type: 'BUSINESS',
        customer_id: parseInt(formData.customer_id),
        amount: parseFloat(formData.amount),
        description: formData.description || `Payment Request for Customer`,
      };

      if (formData.credit_sale_id) {
        requestData.credit_sale_id = parseInt(formData.credit_sale_id);
      }

      const response = await createPaymentRequest(requestData);
      
      // Show QR code modal
      setShowQRModal(response.data);
      setSuccess(
        response.data.checkout_url
          ? 'Payment request created successfully. Send it on WhatsApp or share the payment link.'
          : 'Payment reminder created successfully. Send it on WhatsApp.'
      );

      // Reset form
      setFormData({
        customer_id: '',
        credit_sale_id: '',
        amount: '',
        description: '',
      });
      setStep('customer');

      // Refresh pending requests
      setTimeout(() => loadPendingRequests(), 1000);

    } catch (err) {
      const data = err.response?.data;
      const firstFieldError =
        data && typeof data === 'object' && !Array.isArray(data)
          ? Object.values(data).flat().find(Boolean)
          : null;
      setError(
        data?.error ||
        (Array.isArray(data) ? data[0] : firstFieldError) ||
        'Failed to create payment request'
      );
    } finally {
      setLoading(false);
    }
  };

  const selectedCustomer = customers.find(c => c.id === parseInt(formData.customer_id));
  const selectedSale = creditSales.find(s => s.id === parseInt(formData.credit_sale_id));

  return (
    <div className="business-payment-container">
      {/* Header */}
      <div className="business-payment-header">
        <h1>Send Payment Requests</h1>
        <p>Request payment from customers instantly via Stripe or QR code</p>
      </div>

      {/* Tabs */}
      <div className="business-payment-tabs">
        <button
          className={`tab ${step.includes('customer') || step === 'amount' ? 'active' : ''}`}
          onClick={() => setStep('customer')}
        >
          ➕ New Request
        </button>
        <button
          className={`tab ${step === 'sent' ? 'active' : ''}`}
          onClick={() => setStep('sent')}
        >
          📤 Pending ({pendingRequests.length})
        </button>
      </div>

      {/* New Request Form */}
      {(step === 'customer' || step === 'amount') && (
        <div className="payment-request-card">
          {step === 'customer' ? (
            <>
              <h2>Select Customer</h2>
              <p className="subtitle">Choose a customer to send payment request</p>

              {customers.length === 0 ? (
                <div className="empty-state">
                  <p>No customers yet. Add a customer first.</p>
                  <button
                    className="btn-primary"
                    onClick={() => navigate('/business/customers/create')}
                  >
                    Add Customer
                  </button>
                </div>
              ) : (
                <div className="customer-grid">
                  {customers.map(customer => (
                    <div
                      key={customer.id}
                      className="customer-card"
                      onClick={() => handleCustomerSelect(customer.id)}
                    >
                      <h3>{customer.name}</h3>
                      <p className="phone">{customer.phone || 'No phone'}</p>
                      <p className="balance">Balance: Rs. {customer.outstanding_balance?.toLocaleString('en-IN')}</p>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <h2>Request Details</h2>
              <p className="subtitle">Customer: <strong>{selectedCustomer?.name}</strong></p>

              <form onSubmit={handleCreateRequest}>
                {creditSales.length > 0 && (
                  <div className="form-group">
                    <label>Link to Invoice (optional)</label>
                    <select
                      name="credit_sale_id"
                      value={formData.credit_sale_id}
                      onChange={(e) => {
                        const saleId = parseInt(e.target.value);
                        const sale = creditSales.find(s => s.id === saleId);
                        setFormData(prev => ({
                          ...prev,
                          credit_sale_id: e.target.value,
                          amount: sale ? sale.amount_due : prev.amount,
                        }));
                      }}
                    >
                      <option value="">Select an invoice...</option>
                      {creditSales.map(sale => (
                        <option key={sale.id} value={sale.id}>
                          {sale.invoice_number} - Rs. {sale.amount_due?.toLocaleString('en-IN')}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-group">
                  <label>Amount (Rs.)</label>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      amount: e.target.value
                    }))}
                    placeholder="Enter amount"
                    min="1"
                    step="0.01"
                    required
                  />
                  {selectedSale && (
                    <small>Invoice due: Rs. {selectedSale.amount_due?.toLocaleString('en-IN')}</small>
                  )}
                </div>

                <div className="form-group">
                  <label>Description (optional)</label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    placeholder="e.g., Invoice #INV-001 payment..."
                    rows="2"
                  />
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <div className="form-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setStep('customer')}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary"
                  >
                    {loading ? 'Creating...' : 'Create Payment Request'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      )}

      {/* Pending Requests */}
      {step === 'sent' && (
        <div className="payment-request-card">
          <h2>Pending Payment Requests</h2>
          <p className="subtitle">Requests waiting for customer payment</p>

          {pendingRequests.length === 0 ? (
            <div className="empty-state">
              <p>No pending payment requests</p>
            </div>
          ) : (
            <div className="requests-list">
              {pendingRequests.map(req => (
                <div key={req.id} className="request-item">
                  <div className="request-info">
                    <h3>{req.customer_name || 'Customer'}</h3>
                    <p className="amount">Rs. {parseFloat(req.amount).toLocaleString('en-IN')}</p>
                    {req.description && <p className="description">{req.description}</p>}
                    <p className="status">Status: {req.status}</p>
                    <p className="date">Created: {new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="request-actions">
                    {req.whatsapp_url && (
                      <button
                        className="btn-primary"
                        onClick={() => window.open(req.whatsapp_url, '_blank', 'noopener,noreferrer')}
                      >
                        Open WhatsApp
                      </button>
                    )}
                    {req.checkout_url && (
                      <button
                        className="btn-secondary"
                        onClick={() => navigator.clipboard.writeText(req.checkout_url)}
                      >
                        Copy Stripe Link
                      </button>
                    )}
                    <button
                      className="btn-secondary"
                      onClick={() => setShowQRModal(req)}
                    >
                      Show QR
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* QR Code Modal */}
      {showQRModal && (
        <QRCodeDisplay
          paymentRequest={showQRModal}
          onClose={() => setShowQRModal(null)}
        />
      )}
    </div>
  );
}
