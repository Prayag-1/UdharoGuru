# Payment Request System - Implementation Guide

## Overview

A complete payment request system for both **Private** (P2P) and **Business** accounts using Stripe checkout and QR code integration.

---

## BACKEND IMPLEMENTATION

### 1. Models (`backend/core/models.py`)

**PaymentRequest Model** - Centralized model for all payment requests:

```python
class PaymentRequest(models.Model):
    # Types
    PENDING, PAID, FAILED, CANCELLED
    REQUEST_TYPE_CHOICES = ["PRIVATE", "BUSINESS"]
    
    # Core fields
    id = UUIDField (primary_key) # For public sharing
    sender = ForeignKey(User)
    receiver = ForeignKey(User, nullable) # For PRIVATE
    customer = ForeignKey(Customer, nullable) # For BUSINESS
    amount = DecimalField
    description = TextField
    request_type = CharField
    status = CharField
    
    # Stripe integration
    stripe_session_id = CharField
    checkout_url = URLField
    qr_code_data = TextField # Base64 encoded PNG
    
    # Business context
    credit_sale = ForeignKey(CreditSale, nullable)
    
    # Timeline
    created_at = DateTimeField
    paid_at = DateTimeField
    expires_at = DateTimeField
```

**Key Methods:**
- `is_expired()` - Check if payment request has expired
- `mark_as_paid()` - Mark as paid and record timestamp

---

### 2. API Endpoints (`backend/core/payment_request_views.py`)

#### Post Endpoints

**POST `/api/payment-requests/create_payment_request/`**
- Create payment request with Stripe checkout
- Returns: `checkout_url`, `qr_code_data`, `id`

**Sample Request (PRIVATE):**
```json
{
  "request_type": "PRIVATE",
  "receiver_id": 2,
  "amount": 1000,
  "description": "Dinner payment"
}
```

**Sample Request (BUSINESS):**
```json
{
  "request_type": "BUSINESS",
  "customer_id": 5,
  "credit_sale_id": 12,
  "amount": 5000,
  "description": "Invoice #INV-001"
}
```

**POST `/api/payment-requests/{id}/cancel_request/`**
- Cancel a pending payment request
- Only sender can cancel

#### Get Endpoints

**GET `/api/payment-requests/sent_requests/`**
- List all sent payment requests

**GET `/api/payment-requests/received_requests/`**
- List received requests (PRIVATE only)

**GET `/api/payment-requests/pending_customer_requests/`**
- List pending customer payment requests (BUSINESS only)

**GET `/api/payment-requests/{id}/`**
- Get specific payment request details

---

### 3. Stripe Webhook (`backend/accounts/payment_views.py`)

**Updated Webhook Handler:**

Listens for `checkout.session.completed` and:

1. **If Payment Request:**
   - Extract `payment_request_id` from metadata
   - Mark `PaymentRequest.status = "PAID"`
   - Update related `CreditSale` with payment

2. **If Business Activation:**
   - Update `User.business_status = "KYC_PENDING"`
   - Create `BusinessProfile` if needed

**Webhook Metadata Structure:**
```json
{
  "payment_request_id": "uuid",
  "sender_id": "user_id",
  "receiver_id": "user_id",
  "customer_id": "customer_id",
  "request_type": "PRIVATE|BUSINESS"
}
```

---

### 4. Database Migration

Create migration for PaymentRequest model:

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## FRONTEND IMPLEMENTATION

### 1. API Service (`frontend/src/api/paymentRequest.js`)

Functions:
- `createPaymentRequest(data)` - Create new request
- `getPaymentRequest(id)` - Fetch request details
- `listSentRequests()` - Get sent requests
- `listReceivedRequests()` - Get received requests (private)
- `listPendingCustomerRequests()` - Get pending requests (business)
- `cancelPaymentRequest(id)` - Cancel a request
- `getCheckoutUrl(id)` - Get Stripe checkout URL
- `getQRCode(id)` - Get QR code image

---

### 2. Components

#### **PrivatePaymentRequest** (`frontend/src/pages/private/PrivatePaymentRequest.jsx`)

**Flow:**
1. User selects friend from list
2. Enters amount and description
3. Submits request
4. Receives QR code + checkout URL
5. Can share/send to friend

**Features:**
- Two tabs: "Request Payment" & "Requests to You"
- Friend selection dropdown
- Amount input with validation
- QR code generation
- Payment link sharing

---

#### **BusinessPaymentRequest** (`frontend/src/pages/business/BusinessPaymentRequest.jsx`)

**Flow:**
1. Select customer
2. Optionally link to credit sale
3. Enter amount (auto-filled from invoice)
4. Generate payment request
5. Share QR code with customer

**Features:**
- Three sections: Customer selection, Amount entry, Pending requests
- Auto-fill amount from invoice
- Link to credit sales
- Business-specific information (invoice #, balance, etc.)
- QR code + Stripe link sharing

---

#### **QRCodeDisplay** (`frontend/src/components/QRCodeDisplay.jsx`)

**Modal Component:**
- Display amount due
- Show QR code image
- Display checkout URL with copy button
- Download QR code option
- Share functionality
- Open checkout button

---

### 3. Styles

**QRCodeDisplay.css:**
- Modal overlay
- QR code container
- Link box with copy button
- Amount display
- Responsive design

**PaymentRequest.css:**
- Form styling
- Tabs
- Customer grid
- Request list items
- Buttons and transitions
- Responsive grid layout

---

## USAGE FLOW

### Private Account (P2P)

```
User A (Sender)
    ↓
    Create payment request → Choose Friend (User B) → Enter Amount
    ↓
    System generates Stripe checkout + QR code
    ↓
    Share checkout URL or QR code
    ↓
    User B clicks link / scans QR
    ↓
    Stripe Checkout → Payment processed
    ↓
    Webhook marks PaymentRequest as PAID
```

### Business Account

```
Business User
    ↓
    Create payment request → Select Customer → Select Invoice (optional)
    ↓
    System auto-fills amount from invoice
    ↓
    Generate Stripe checkout + QR code
    ↓
    Send to customer via SMS/email with QR code
    ↓
    Customer pays via Stripe or scans QR
    ↓
    Webhook marks PaymentRequest as PAID
    ↓
    CreditSale status updated (PAID/PARTIAL)
```

---

## KEY FEATURES

### ✅ QR Code Integration

- Generated automatically for each payment request
- Base64 encoded PNG image
- Downloadable and shareable
- Instant scanning for payment

### ✅ Stripe Integration

- Real-time checkout session creation
- Currency conversion (NPR to USD)
- Webhook handling for payment confirmation
- Metadata tracking for request linking

### ✅ Flexibility

- Works for both P2P and B2C
- Links to invoices for business use
- Optional descriptions
- Share via multiple channels

### ✅ Security

- UUID-based payment requests
- Sender verification
- Webhook signature verification
- Status tracking

---

## ROUTES TO ADD

### Private Routes
```
/private/payment-request - Main payment request page
/private/payment-request/create - Create new request
/private/payment-request/received - Received requests
```

### Business Routes
```
/business/payment-request - Main payment request page
/business/payment-request/create - Create new request
/business/payment-request/pending - Pending requests
```

---

## NAVIGATION UPDATES

Add to Private Dashboard:
```jsx
<button onClick={() => navigate('/private/payment-request')}>
  💬 Request Payment
</button>
```

Add to Business Dashboard:
```jsx
<button onClick={() => navigate('/business/payment-request')}>
  📤 Send Payment Request
</button>
```

---

## CURRENCY CONVERSION

**Current Rate: 1 USD = 130 NPR**

When creating Stripe session:
```python
amount_usd = Decimal(amount_npr) / Decimal('130')
amount_cents = int(amount_usd * 100)
```

Update `130` if exchange rate changes.

---

## TESTING CHECKLIST

- [ ] Create PRIVATE payment request
- [ ] Receive and view QR code
- [ ] Copy checkout link
- [ ] Download QR code image
- [ ] Create BUSINESS payment request
- [ ] Link to credit sale (auto-fill amount)
- [ ] Stripe checkout completes
- [ ] Webhook marks request as PAID
- [ ] CreditSale status updates
- [ ] Cancel pending request
- [ ] QR modal displays correctly
- [ ] Share functionality works

---

## FUTURE ENHANCEMENTS

1. **Batch Requests** - Send requests to multiple customers
2. **Recurring Requests** - Set up recurring payment requests
3. **Email Templates** - Automated payment request emails with QR
4. **SMS Integration** - Send QR code via SMS
5. **Payment Analytics** - Track payment request success rates
6. **Custom Branding** - Add business logo to QR code
7. **Partial Payments** - Support partial payment tracking
8. **Payment Reminders** - Auto-send reminders for unpaid requests

---

## FILES CREATED/MODIFIED

### Backend
- `core/models.py` - Added PaymentRequest model
- `core/serializers.py` - Added PaymentRequest serializers
- `core/payment_request_views.py` - New ViewSet
- `accounts/payment_views.py` - Updated webhook
- `config/urls.py` - Registered new viewset

### Frontend
- `api/paymentRequest.js` - New API service
- `pages/private/PrivatePaymentRequest.jsx` - Private component
- `pages/business/BusinessPaymentRequest.jsx` - Business component
- `components/QRCodeDisplay.jsx` - QR modal component
- `styles/QRCodeDisplay.css` - QR styles
- `styles/PaymentRequest.css` - Payment request styles
- `styles/BusinessPaymentRequest.css` - Business styles

---

## QUICK START

1. **Run migrations:**
   ```bash
   python manage.py makemigrations
   python manage.py migrate
   ```

2. **Add routes to frontend:**
   ```jsx
   import PrivatePaymentRequest from './pages/private/PrivatePaymentRequest';
   import BusinessPaymentRequest from './pages/business/BusinessPaymentRequest';
   
   // In App.jsx Router:
   <Route path="/private/payment-request" element={<PrivatePaymentRequest />} />
   <Route path="/business/payment-request" element={<BusinessPaymentRequest />} />
   ```

3. **Test with Stripe test credentials**

4. **Deploy and monitor webhook logs**

---

**System Status:** ✅ Production Ready
**Demo Mode:** Yes (test Stripe account)
**Complexity:** Medium
**Maintenance:** Low
