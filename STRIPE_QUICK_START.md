# Stripe Integration - Quick Start

## 1️⃣ Install Stripe
```bash
cd backend
pip install stripe
```

## 2️⃣ Get Stripe Keys
- Go to https://dashboard.stripe.com/
- Developers > API Keys
- Copy: Publishable Key (pk_test_...) and Secret Key (sk_test_...)
- Developers > Webhooks > Create endpoint
- URL: `http://localhost:8000/api/accounts/stripe/webhook/`
- Events: `checkout.session.completed`
- Copy signing secret (whsec_...)

## 3️⃣ Set Environment Variables
Create `.env` file in `backend/` dir:
```
STRIPE_SECRET_KEY=sk_test_replace_with_your_secret_key
STRIPE_PUBLIC_KEY=pk_test_replace_with_your_public_key
STRIPE_WEBHOOK_SECRET=whsec_replace_with_your_webhook_secret
```

## 4️⃣ Start Servers
```bash
# Terminal 1 - Backend
cd backend
python manage.py runserver 8000

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## 5️⃣ Test Flow
1. Go to http://localhost:5173
2. Signup as BUSINESS account
3. Click "💳 Stripe Card" payment method
4. Click "Proceed to Stripe Checkout"
5. Use test card: `4242 4242 4242 4242` (Exp: 12/25, CVC: 123)
6. Complete payment
7. Auto-redirects to payment success page
8. Success page auto-redirects to KYC form

## ✅ Implementation Summary

### Backend Endpoints
```
POST /api/accounts/create-checkout-session/
- Creates Stripe session
- Returns checkout URL
- Adds user_id to metadata

POST /api/accounts/stripe/webhook/
- Receives payment confirmation
- Updates user.business_status → KYC_PENDING
- Creates BusinessProfile
- Signature verified

GET /api/accounts/profile-status/
- Returns current user status
- Used for polling after payment
```

### Frontend Pages
```
/business/payment
- Enhanced with Stripe option
- Toggle between Stripe & Mobile Banking
- Handles both payment methods

/payment-success
- Polls profile-status every 2 seconds
- Shows loading state
- Auto-redirects to /business/kyc
- Manual refresh fallback

/payment-cancel
- Friendly cancel message
- Retry and return buttons
```

### Data Flow
```
User clicks "Proceed to Stripe Checkout"
    ↓
Backend creates session (metadata: user_id, email)
    ↓
Frontend redirects to Stripe checkout
    ↓
User enters payment info
    ↓
Stripe processes payment
    ↓
Stripe sends webhook to backend
    ↓
Backend updates user.business_status = 'KYC_PENDING'
    ↓
Stripe redirects user to /payment-success
    ↓
Frontend polls /profile-status/
    ↓
Detects status change
    ↓
Auto-redirects to /business/kyc
```

## 🔒 Security Features
✅ Webhook signature verification (STRIPE_WEBHOOK_SECRET)
✅ User authentication required
✅ CSRF protection enabled
✅ User metadata in session (not stored in DB)
✅ Status validation on every endpoint

## 🚀 Production
Set environment variables in your hosting provider:
- Heroku: Settings > Config Vars
- AWS: Environment Variables
- Google Cloud: Cloud Run > Environment Variables
- Azure: App Service > Configuration

Update URLs in code:
- `payment_views.py`: success_url, cancel_url
- `PaymentButton.jsx`: API_URL
- Stripe Dashboard: Webhook URL

## 📝 Notes
- Amount is hardcoded to $5 USD (500 cents)
- Webhook signature verified for security
- BusinessProfile auto-created on payment
- No payment stored in DB (Stripe handles it)
- User status auto-updated (no manual approval)
- Polling fallback if webhook delayed
