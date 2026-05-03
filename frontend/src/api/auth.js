import api from "./apiClient";

export const login = (credentials) => api.post("auth/login/", credentials);
export const register = (payload) => api.post("auth/register/", payload);
export const getMe = () => api.get("auth/me/");
export const googleLogin = (token, accountType = "PRIVATE") =>
  api.post("auth/google/login/", { token, account_type: accountType });
export const updatePhone = (phoneNumber) =>
  api.patch("auth/phone/update/", { phone_number: phoneNumber });

// 2FA endpoints
export const verifyTwoFactor = ({ email, otp }) =>
  api.post("auth/2fa/verify/", { email, otp });
export const resendTwoFactor = (email) => api.post("auth/2fa/resend/", { email });
export const toggleTwoFactor = (enabled) =>
  api.patch("auth/2fa/toggle/", { enabled });

// Email verification endpoints
export const verifyEmail = ({ email, otp }) =>
  api.post("auth/email/verify/", { email, otp });
export const resendEmailVerification = (email) =>
  api.post("auth/email/resend/", { email });

// Password reset endpoints
export const forgotPasswordRequest = (email) =>
  api.post("auth/password/forgot/", { email });
export const verifyPasswordResetOTP = ({ email, otp }) =>
  api.post("auth/password/verify-otp/", { email, otp });
export const resendPasswordResetOTP = (email) =>
  api.post("auth/password/resend/", { email });
export const resetPassword = ({ email, reset_token, new_password }) =>
  api.post("auth/password/reset/", { email, reset_token, new_password });
