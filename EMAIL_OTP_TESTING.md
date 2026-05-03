# EMAIL OTP SYSTEM - TESTING GUIDE

## ✅ IMPLEMENTATION COMPLETE

All three flows now fully implemented and integrated:
1. **LOGIN 2FA** - Enable 2FA, login with OTP
2. **EMAIL VERIFICATION** - Verify email on signup
3. **FORGOT PASSWORD** - Reset password with email OTP

---

## 🧪 MANUAL TESTING STEPS

### PART A: TEST SMTP EMAIL DELIVERY

**Goal:** Verify that Gmail SMTP is working correctly

```bash
cd c:\Projects\FYP\udharo_guru\backend
python manage.py shell
```

In the Django shell:
```python
from django.core.mail import send_mail
from django.conf import settings

result = send_mail(
    subject="Test Email from UdharoGuru",
    message="This is a test email to verify SMTP configuration.",
    from_email=settings.DEFAULT_FROM_EMAIL,
    recipient_list=["your-test-email@gmail.com"],  # Change this to your email
    fail_silently=False,
)
print(f"Email sent: {result}")
```

**Expected Result:**
- ✅ Returns `1` (success)
- ✅ Email appears in your inbox within 30 seconds
- ❌ If it fails, check `.env` file EMAIL_* settings

---

### PART B: TEST USER REGISTRATION WITH EMAIL VERIFICATION

**Flow:** Register → Receive OTP → Verify Email → Access Dashboard

**Step 1: Register New User**
1. Go to `http://localhost:5173/auth/signup`
2. Click "Personal" or "Business" tab
3. Fill in:
   - Full Name: "Test User"
   - Email: `testuser+1@example.com` (use unique email)
   - Password: `TestPassword123`
4. Click "Sign up"

**Expected Result:**
- ✅ Page redirects to `/auth/verify-email`
- ✅ Shows message "Verification code sent to your email"
- ✅ Email field pre-filled with registration email
- ✅ No JWT tokens stored yet (check localStorage)

**Step 2: Check Email for OTP**
- ✅ Email received with subject "Email Verification Code"
- ✅ Contains 6-digit OTP code
- ✅ Code expires in 10 minutes (default setting)

**Step 3: Enter OTP**
1. Copy the 6-digit OTP from email
2. Paste it into the verification page OTP field
3. Click "Verify email"

**Expected Result:**
- ✅ Shows success message
- ✅ Redirects to dashboard (PRIVATE or BUSINESS based on account type)
- ✅ JWT tokens now stored in localStorage
- ✅ User is fully logged in

**Test Resend:**
1. Go back to signup, create another user
2. On verify-email page, click "Didn't receive code? Resend"

**Expected Result:**
- ✅ New OTP sent
- ✅ Message: "Verification code sent to your email"
- ✅ Shows cooldown if clicked within 60 seconds: "Please wait XX seconds before requesting another OTP"

---

### PART C: TEST LOGIN WITH 2FA (TWO-FACTOR AUTHENTICATION)

**Prerequisites:**
- Have a user account already created and verified

**Step 1: Enable 2FA on Account**
1. Login to your dashboard
2. Go to Account tab (if available) or use API
3. Enable 2FA toggle

**API Alternative (using Postman):**
```
PATCH http://localhost:8000/api/auth/2fa/toggle/
Body: { "enabled": true }
Authorization: Bearer <access_token>
```

**Step 2: Logout and Login with 2FA**
1. Logout
2. Go to `http://localhost:5173/auth/login`
3. Enter email and password
4. Click "Sign in"

**Expected Result:**
- ✅ Shows "Verify your identity" screen
- ✅ Message: "We sent a 6-digit code to your email"
- ✅ NO JWT tokens stored yet
- ✅ Resend button available

**Step 3: Enter 2FA OTP**
1. Check email for OTP with subject "Your UdharoGuru login OTP"
2. Copy 6-digit code
3. Paste into Login page OTP field
4. Click "Verify"

**Expected Result:**
- ✅ Login succeeds
- ✅ Redirects to dashboard
- ✅ JWT tokens stored
- ✅ User is logged in

**Test Resend 2FA OTP:**
1. Go back to login with 2FA
2. Enter credentials, wait for OTP screen
3. Click "Didn't receive code? Resend"

**Expected Result:**
- ✅ New OTP sent
- ✅ Shows cooldown (60 seconds) if clicked too soon

**Test Wrong OTP:**
1. Enter wrong 6-digit code
2. Click "Verify"

**Expected Result:**
- ✅ Shows error: "Invalid OTP"
- ✅ Can retry
- ✅ After 5 attempts: "Maximum OTP attempts exceeded"

**Test OTP Expiry:**
1. Request OTP for login with 2FA
2. Wait 11+ minutes (default expiry is 10 minutes)
3. Try to use the old OTP

**Expected Result:**
- ✅ Shows error: "OTP has expired"

---

### PART D: TEST FORGOT PASSWORD FLOW

**Flow:** Request OTP → Verify OTP → Enter New Password → Login with New Password

**Step 1: Request Password Reset**
1. Go to `http://localhost:5173/auth/login`
2. Click "Forgot password?" link
3. Enter your registered email
4. Click "Send verification code"

**Expected Result:**
- ✅ Page shows: "If an account exists, a verification code has been sent"
- ✅ Moves to OTP verification screen
- ✅ Email received with subject "Password Reset Code"

**Step 2: Verify OTP**
1. Copy OTP from email
2. Paste into verification form
3. Click "Verify code"

**Expected Result:**
- ✅ Shows: "OTP verified. You can now reset your password"
- ✅ Moves to password reset screen

**Step 3: Reset Password**
1. Enter new password: `NewPassword456`
2. Confirm password: `NewPassword456`
3. Click "Reset password"

**Expected Result:**
- ✅ Shows: "Password reset successful! Redirecting to login..."
- ✅ Auto-redirects to login page after 2 seconds

**Step 4: Login with New Password**
1. On login page, enter:
   - Email: your registered email
   - Password: `NewPassword456` (your new password)
2. Click "Sign in"

**Expected Result:**
- ✅ Logs in successfully
- ✅ Redirects to dashboard
- ✅ Old password no longer works

**Test Email Non-Existence:**
1. Go to forgot password
2. Enter email that doesn't exist: `nonexistent@example.com`
3. Click "Send verification code"

**Expected Result:**
- ✅ Shows generic message: "If an account exists, a verification code has been sent"
- ✅ No email actually sent (for security - don't reveal account existence)

---

### PART E: TEST GOOGLE OAUTH (SHOULD STILL WORK)

**Goal:** Verify Google login doesn't break

**Step 1: Signup with Google**
1. Go to `http://localhost:5173/auth/signup`
2. Click Google signup button
3. Select your Google account
4. Choose "Personal" or "Business"

**Expected Result:**
- ✅ User created
- ✅ Email auto-verified (Google verified it)
- ✅ Logs in immediately
- ✅ Redirects to dashboard
- ✅ No email verification needed

**Step 2: Verify email_verified=True**

Using API (Postman):
```
GET http://localhost:8000/api/auth/me/
Authorization: Bearer <access_token>
```

**Expected Result:**
- ✅ Response includes `"is_email_verified": true` (even without verification)

---

### PART F: TEST ACCOUNT TYPE ROUTING

**Goal:** Verify Business and Private accounts route correctly

**Test Business Account:**
1. Signup as BUSINESS type
2. Verify email
3. Complete dashboard redirects correctly

**Expected Result:**
- ✅ Routes to `/business/payment` (needs payment first)
- ✅ Shows payment flow

**Test Private Account:**
1. Signup as PRIVATE type
2. Verify email
3. Complete dashboard redirects correctly

**Expected Result:**
- ✅ Routes to `/private/friends`
- ✅ Shows private dashboard

---

### PART G: TEST EDGE CASES & SECURITY

**Test 1: OTP Reuse Prevention**
1. Get OTP from email
2. Use it once successfully
3. Try to use the same OTP again

**Expected Result:**
- ✅ Error: "OTP has already been used"

**Test 2: Multiple OTPs - Only Latest Valid**
1. Request password reset OTP
2. Wait 60+ seconds
3. Request again
4. Try first OTP

**Expected Result:**
- ✅ First OTP is marked expired
- ✅ Only second OTP works

**Test 3: Cooldown Enforcement**
1. Request signup email verification OTP
2. Immediately request another resend (within 60 seconds)

**Expected Result:**
- ✅ Error: "Please wait XX seconds before requesting another OTP"
- ✅ Shows remaining seconds

**Test 4: No Tokens Before Verification**
1. Register user
2. Check browser localStorage before email verification

**Expected Result:**
- ✅ localStorage is empty (no access_token or refresh_token)
- ✅ Only after email verified should tokens appear

**Test 5: Cannot Access Dashboard Without Email Verification**
1. Create user account (registration but no verification)
2. Try to manually navigate to `/business/dashboard` or `/private/friends`

**Expected Result:**
- ✅ Cannot access (no token)
- ✅ Redirects to login

---

## 🔍 BACKEND VERIFICATION (OPTIONAL)

If you want to verify backend logic directly:

```bash
cd c:\Projects\FYP\udharo_guru\backend
python manage.py shell
```

**Check OTP was created:**
```python
from accounts.models import TwoFactorOTP

# Get latest EMAIL_VERIFICATION OTP
otp = TwoFactorOTP.objects.filter(purpose='EMAIL_VERIFICATION').latest('created_at')
print(f"Purpose: {otp.purpose}")
print(f"Email: {otp.email}")
print(f"Used: {otp.used_at}")
print(f"Expires: {otp.expires_at}")
```

**Check user is_email_verified:**
```python
from accounts.models import User

user = User.objects.get(email='testuser+1@example.com')
print(f"Email verified: {user.is_email_verified}")
print(f"2FA enabled: {user.two_factor_enabled}")
```

---

## 📋 FINAL CHECKLIST

- [ ] SMTP emails send successfully
- [ ] New user registration with email verification works
- [ ] OTP is 6 digits, numeric only
- [ ] OTP expires after 10 minutes
- [ ] OTP is single-use
- [ ] OTP is hashed (not stored plain text)
- [ ] Cooldown enforced (60 seconds between resends)
- [ ] Max 5 attempts before lockout
- [ ] Login with 2FA enabled works
- [ ] OTP resend works during login
- [ ] Forgot password complete flow works
- [ ] Password reset after OTP verification works
- [ ] Google OAuth still works without email verification needed
- [ ] Account type routing correct (BUSINESS vs PRIVATE)
- [ ] User cannot access dashboard before email verified
- [ ] Tokens not stored until email verified
- [ ] Generic message for non-existent emails (security)
- [ ] No JWT exposed before OTP verification

---

## 🆘 TROUBLESHOOTING

### Email not sending?
1. Check `.env` file has EMAIL_HOST_USER and EMAIL_HOST_PASSWORD
2. Gmail requires "App Password" not regular password
3. Check 2-Step verification is enabled on Gmail account
4. Try sending test email from Django shell (Part A)

### OTP always expires?
1. Check server time is correct
2. Verify OTP_EXPIRY_MINUTES in `.env` is set (default 10)
3. Check database for otp.expires_at timestamp

### User not verified after entering OTP?
1. Check database: `is_email_verified` field
2. Check OTP.used_at was updated
3. Check error response from API

### Tokens not stored?
1. Check browser localStorage
2. Verify setTokens() was called in AuthContext
3. Check API response has "access" and "refresh" fields

### Google login broken?
1. Verify GOOGLE_CLIENT_ID in `.env` is correct
2. Check OAuth provider is configured on frontend
3. Verify Google verified the email (should auto-verify)

---

## 📝 NOTES

- All OTPs are 6-digit numeric
- All OTPs expire after 10 minutes (configurable)
- 60-second cooldown between resends (configurable)
- 5 max attempts per OTP (configurable)
- Email addresses are case-insensitive
- Passwords require minimum 8 characters
- Google users don't need email verification
- Business and Private accounts follow separate flows
