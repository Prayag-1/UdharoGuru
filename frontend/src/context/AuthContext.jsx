import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { clearTokens, setTokens } from "../api/apiClient";
import { getMe, login as loginApi, register as registerApi } from "../api/auth";

const AuthContext = createContext(null);

const ACCESS_KEY = "access_token";
const REFRESH_KEY = "refresh_token";

const removeTokens = () => {
  clearTokens();
  localStorage.removeItem(REFRESH_KEY);
};

export const resolveHomeRoute = (user) => {
  if (!user) return "/auth";
  if (user.account_type === "PRIVATE") return "/private/dashboard";
  if (user.account_type === "BUSINESS") {
    const status = user.business_status;
    if (status === "APPROVED") return "/business/dashboard";
    if (status === "REJECTED") return "/business/rejected";
    if (status === "UNDER_REVIEW") return "/business/pending";
    if (status === "KYC_PENDING") return "/business/kyc";
    return "/business/payment";
  }
  return "/auth";
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    try {
      const { data } = await getMe();
      setUser(data);
      return data;
    } catch (err) {
      setUser(null);
      removeTokens();
      throw err;
    }
  }, []);

  useEffect(() => {
    const hasTokens =
      localStorage.getItem(ACCESS_KEY) && localStorage.getItem(REFRESH_KEY);
    if (!hasTokens) {
      setLoading(false);
      return;
    }

    loadUser().finally(() => setLoading(false));
  }, [loadUser]);

  useEffect(() => {
    const handleClear = () => setUser(null);
    window.addEventListener("auth:cleared", handleClear);
    return () => window.removeEventListener("auth:cleared", handleClear);
  }, []);

  const extractMessage = (err, fallback) => {
    const data = err?.response?.data;
    const status = err?.response?.status;
    const fieldError =
      data &&
      Object.keys(data)
        .filter((k) => !["detail", "message", "non_field_errors", "error"].includes(k))
        .map((k) => (Array.isArray(data[k]) ? data[k][0] : data[k]))
        .find(Boolean);
    const msg =
      data?.detail ||
      data?.message ||
      data?.non_field_errors?.[0] ||
      data?.error ||
      fieldError;
    if (msg) return msg;
    if (status === 401) return "Unauthorized";
    if (status === 409) return "Conflict";
    return fallback;
  };

  const buildError = (err, fallback) => {
    const message = extractMessage(err, fallback);
    const wrapped = new Error(message);
    wrapped.status = err?.response?.status;
    wrapped.data = err?.response?.data;
    return wrapped;
  };

  const login = useCallback(
    async ({ email, password }) => {
      try {
        const { data } = await loginApi({ email, password });
        setTokens(data.access, data.refresh);
        const profile = await loadUser();
        return profile;
      } catch (err) {
        throw buildError(err, "Unable to login.");
      }
    },
    [loadUser]
  );

  const register = useCallback(
    async ({ email, password, full_name, account_type }) => {
      try {
        const { data } = await registerApi({
          email,
          password,
          full_name,
          account_type: (account_type || "").toUpperCase(),
        });
        if (data?.access && data?.refresh) {
          setTokens(data.access, data.refresh);
          const profile = await loadUser();
          return profile;
        }
        return null;
      } catch (err) {
        throw buildError(err, "Unable to register.");
      }
    },
    [loadUser]
  );

  const logout = useCallback(() => {
    removeTokens();
    setUser(null);
  }, []);

  const setUserState = useCallback((updater) => {
    setUser((prev) => (typeof updater === "function" ? updater(prev) : updater));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      refreshUser: loadUser,
      setUserState,
    }),
    [
      user,
      loading,
      login,
      register,
      logout,
      loadUser,
      setUserState,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
};
