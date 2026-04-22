import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createPaymentRequest, listReceivedRequests } from '../../api/paymentRequest';
import { getPrivateFriends } from '../../api/private';
import QRCodeDisplay from '../../components/QRCodeDisplay';
import '../../styles/PaymentRequest.css';

export default function PrivatePaymentRequest() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState('create'); // 'create' or 'view'
  
  // Create request form
  const [formData, setFormData] = useState({
    receiver_id: '',
    amount: '',
    description: '',
  });

  // Payment requests received
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [friends, setFriends] = useState([]);
  const [showQRModal, setShowQRModal] = useState(null);

  useEffect(() => {
    if (!user) return;
    if (user.account_type !== 'PRIVATE') {
      navigate('/');
      return;
    }

    loadReceivedRequests();
    loadFriends();
  }, [user]);

  const loadFriends = async () => {
    try {
      const response = await getPrivateFriends();
      const friendsList = Array.isArray(response.data) ? response.data : response.data?.results || [];
      
      // Normalize friends structure
      const normalizedFriends = friendsList.map(friend => ({
        id: friend.id || friend.user_id,
        email: friend.email || friend.connected_user_email,
        full_name: friend.full_name || friend.name,
      }));
      
      setFriends(normalizedFriends);
    } catch (err) {
      console.error('Failed to load friends:', err);
    }
  };

  const loadReceivedRequests = async () => {
    try {
      const response = await listReceivedRequests();
      setReceivedRequests(response.data);
    } catch (err) {
      console.error('Failed to load received requests:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const requestData = {
        request_type: 'PRIVATE',
        receiver_id: parseInt(formData.receiver_id),
        amount: parseFloat(formData.amount),
        description: formData.description,
      };

      const response = await createPaymentRequest(requestData);
      
      // Show QR code modal
      setShowQRModal(response.data);
      setFormData({ receiver_id: '', amount: '', description: '' });

      // Refresh received requests
      setTimeout(() => loadReceivedRequests(), 1000);

    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create payment request');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="payment-request-container">
      {/* Header */}
      <div className="payment-request-header">
        <h1>Payment Requests</h1>
        <p>Request or send payment to friends</p>
      </div>

      {/* Tabs */}
      <div className="payment-request-tabs">
        <button
          className={`tab ${step === 'create' ? 'active' : ''}`}
          onClick={() => setStep('create')}
        >
          💬 Request Payment
        </button>
        <button
          className={`tab ${step === 'view' ? 'active' : ''}`}
          onClick={() => setStep('view')}
        >
          📥 Requests to You ({receivedRequests.length})
        </button>
      </div>

      {/* Create Request Step */}
      {step === 'create' && (
        <div className="payment-request-card">
          <h2>Request Payment</h2>
          <p className="subtitle">Ask a friend to pay by generating a payment link</p>

          <form onSubmit={handleCreateRequest}>
            <div className="form-group">
              <label>Select Friend</label>
              <select
                name="receiver_id"
                value={formData.receiver_id}
                onChange={handleInputChange}
                required
              >
                <option value="">Choose a friend...</option>
                {friends.map(friend => (
                  <option key={friend.id} value={friend.id}>
                    {friend.full_name} ({friend.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Amount (Rs.)</label>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                placeholder="Enter amount"
                min="1"
                step="0.01"
                required
              />
            </div>

            <div className="form-group">
              <label>Description (optional)</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="e.g., Dinner payment, Rent..."
                rows="3"
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" disabled={loading} className="btn-primary">
              {loading ? 'Creating...' : 'Generate Payment Link'}
            </button>
          </form>
        </div>
      )}

      {/* View Requests Step */}
      {step === 'view' && (
        <div className="payment-request-card">
          <h2>Payment Requests to You</h2>
          <p className="subtitle">Pay or ignore requests from friends</p>

          {receivedRequests.length === 0 ? (
            <div className="empty-state">
              <p>No payment requests yet</p>
            </div>
          ) : (
            <div className="requests-list">
              {receivedRequests.map(req => (
                <div key={req.id} className="request-item">
                  <div className="request-info">
                    <h3>{req.sender_name}</h3>
                    <p className="amount">Rs. {parseFloat(req.amount).toLocaleString('en-IN')}</p>
                    {req.description && <p className="description">{req.description}</p>}
                    <p className="date">{new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="request-actions">
                    <button
                      className="btn-success"
                      onClick={() => window.location.href = req.checkout_url}
                    >
                      Pay Now
                    </button>
                    <button
                      className="btn-tertiary"
                      onClick={() => setShowQRModal(req)}
                    >
                      QR Code
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
