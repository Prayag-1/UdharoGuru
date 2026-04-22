# Quick Integration Guide - Payment Request System

## Add Payment Request Button to Private Dashboard

**Location:** `frontend/src/pages/private/PrivateDashboard.jsx`

```jsx
import { useNavigate } from 'react-router-dom';

export default function PrivateDashboard() {
  const navigate = useNavigate();
  
  return (
    <div className="dashboard-container">
      {/* Header with button */}
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <button 
          className="btn-primary"
          onClick={() => navigate('/private/payment-request')}
        >
          💬 Request Payment
        </button>
      </div>
      
      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

---

## Add Payment Request to Business Dashboard

**Location:** `frontend/src/pages/business/BusinessDashboard.jsx`

```jsx
import { useNavigate } from 'react-router-dom';

export default function BusinessDashboard() {
  const navigate = useNavigate();
  
  return (
    <div className="dashboard-container">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>Business overview and key metrics</p>
        </div>
        <div className="button-group">
          <button 
            className="dashboard-btn-primary"
            onClick={() => navigate('/business/credit-sales/create')}
          >
            New Credit Sale
          </button>
          <button 
            className="dashboard-btn-secondary"
            onClick={() => navigate('/business/payment-request')}
          >
            📤 Send Payment Request
          </button>
        </div>
      </div>
      
      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

---

## Setup Routes in App.jsx

```jsx
import PrivatePaymentRequest from './pages/private/PrivatePaymentRequest';
import BusinessPaymentRequest from './pages/business/BusinessPaymentRequest';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ... existing routes ... */}
        
        {/* Private Routes */}
        <Route 
          path="/private/payment-request" 
          element={<PrivatePaymentRequest />} 
        />
        
        {/* Business Routes */}
        <Route 
          path="/business/payment-request" 
          element={<BusinessPaymentRequest />} 
        />
        
        {/* ... rest of routes ... */}
      </Routes>
    </BrowserRouter>
  );
}
```

---

## Add Quick Access Card to Dashboard

**Optional: Add a card showing pending payment requests**

```jsx
// In BusinessDashboard.jsx - add to main dashboard

import { listPendingCustomerRequests } from '../../api/paymentRequest';

export default function BusinessDashboard() {
  const [pendingRequests, setPendingRequests] = useState(0);
  
  useEffect(() => {
    const loadPendingRequests = async () => {
      try {
        const response = await listPendingCustomerRequests();
        setPendingRequests(response.data.length);
      } catch (err) {
        console.error('Failed to load pending requests:', err);
      }
    };
    
    loadPendingRequests();
  }, []);
  
  return (
    <div className="dashboard-container">
      {/* ... existing header ... */}
      
      {/* Quick Stats */}
      <div className="quick-cards">
        {/* ... existing cards ... */}
        
        <div className="quick-card pending-requests">
          <div className="card-icon">📤</div>
          <div className="card-content">
            <p className="card-label">Pending Requests</p>
            <p className="card-value">{pendingRequests}</p>
            <button 
              className="card-link"
              onClick={() => navigate('/business/payment-request')}
            >
              View All →
            </button>
          </div>
        </div>
      </div>
      
      {/* ... rest of dashboard ... */}
    </div>
  );
}
```

---

## Database Migrations

Before running the app:

```bash
cd backend
python manage.py makemigrations core
python manage.py migrate
```

---

## Stripe Webhook Configuration

Ensure webhook is set up in Stripe Dashboard:

1. Go to Stripe Dashboard → Webhooks
2. Add endpoint: `https://yourdomain.com/api/accounts/webhook/`
3. Events: `checkout.session.completed`
4. Copy signing secret to `.env` as `STRIPE_WEBHOOK_SECRET`

---

## Testing Locally

### Test Stripe Checkout

1. Use test card: `4242 4242 4242 4242`
2. Future expiration date
3. Any CVC
4. Click "Pay"

### Test Webhook Locally

```bash
# Install stripe-cli
stripe listen --forward-to localhost:8000/api/accounts/webhook/

# In another terminal, trigger test event
stripe trigger checkout.session.completed

# Check webhook logs
stripe logs tail
```

---

## Environment Variables

Ensure these are set in `backend/.env`:

```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

---

## API Response Examples

### Create Payment Request

**Request:**
```json
{
  "request_type": "BUSINESS",
  "customer_id": 5,
  "amount": 5000,
  "description": "Invoice #INV-001",
  "credit_sale_id": 12
}
```

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "sender": 1,
  "sender_email": "business@example.com",
  "receiver": null,
  "customer": 5,
  "customer_name": "John Doe",
  "amount": "5000.00",
  "description": "Invoice #INV-001",
  "request_type": "BUSINESS",
  "status": "PENDING",
  "checkout_url": "https://checkout.stripe.com/pay/cs_test_...",
  "qr_code_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "created_at": "2024-04-04T10:30:00Z",
  "paid_at": null,
  "expires_at": null,
  "is_expired": false
}
```

---

## Troubleshooting

### Issue: "Payment request not found" error

**Solution:** Ensure UUID is valid and payment request exists in database

### Issue: QR code not generating

**Solution:** Install `qrcode` package:
```bash
pip install qrcode[pil]
```

### Issue: Webhook not triggering payment status update

**Solution:**
1. Check webhook signature verification
2. Verify `payment_request_id` is in metadata
3. Check Django logs for errors
4. Ensure database migration ran

### Issue: Stripe checkout fails

**Solution:**
1. Verify Stripe credentials in `.env`
2. Check internet connection
3. Ensure amount is > 0
4. Review Stripe API logs

---

## Performance Notes

- QR codes are generated in-memory (no storage)
- Payment requests use UUID indexes for fast lookups
- Webhook processes immediately (no queue needed)
- No external dependencies except qrcode library

---

## Security Considerations

✅ **Implemented:**
- Stripe webhook signature verification
- User authentication required
- Business ownership verification
- UUID-based request IDs
- Customer access control

⚠️ **Recommended:**
- Rate limiting on payment request creation
- HTTPS enforced in production
- Webhook retry logic
- Payment request expiration
- Audit logging

---

## Summary

The payment request system is now fully integrated into both Private and Business accounts with:

✅ Stripe checkout integration
✅ QR code generation and display
✅ Database models and migrations
✅ API endpoints and webhooks
✅ Frontend components and UI
✅ Responsive design
✅ Demo-ready implementation

**Status:** Ready for production with test Stripe account
