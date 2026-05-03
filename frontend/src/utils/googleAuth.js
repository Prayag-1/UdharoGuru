/**
 * Google OAuth helper utilities
 * Handles token verification and API communication
 */

import api from "../api/apiClient";

/**
 * Verify and authenticate with Google token
 * @param {string} token - Google ID token from Google OAuth flow
 * @param {string} accountType - 'PRIVATE' or 'BUSINESS'
 * @returns {Promise} Response with user and tokens
 */
export const authenticateWithGoogle = async (token, accountType = "PRIVATE") => {
  try {
    const response = await api.post("auth/google/login/", {
      token,
      account_type: accountType,
    });
    return response.data;
  } catch (error) {
    const message =
      error.response?.data?.detail || "Google authentication failed. Please try again.";
    throw new Error(message);
  }
};

/**
 * Get Google Client ID from environment
 * @returns {string} Google Client ID
 */
export const getGoogleClientId = () => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    throw new Error(
      "Google Client ID not configured. Set VITE_GOOGLE_CLIENT_ID in .env"
    );
  }
  return clientId;
};

/**
 * Format error message for display
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export const formatGoogleError = (error) => {
  if (error.message === "popup_closed_by_user") {
    return "Google sign-in cancelled.";
  }
  if (error.message === "access_denied") {
    return "Google sign-in access denied.";
  }
  return error.message || "Google sign-in failed. Please try again.";
};
