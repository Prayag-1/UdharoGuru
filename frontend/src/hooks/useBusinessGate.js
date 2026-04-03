import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { resolveHomeRoute, useAuth } from "../context/AuthContext";

const targetForStatus = (status) => {
  switch (status) {
    case "APPROVED":
      return null;
    case "REJECTED":
      return "/business/rejected";
    case "UNDER_REVIEW":
      return "/business/pending";
    case "KYC_PENDING":
      return "/business/kyc";
    case "PAYMENT_PENDING":
    default:
      return "/business/payment";
  }
};

const approvedRedirectPaths = new Set([
  "/business/payment",
  "/business/kyc",
  "/business/pending",
  "/business/rejected",
]);

export const useBusinessGate = (currentPath) => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState({ business_status: null, payment: null, kyc: null, rejection_reason: null });
  const [loading, setLoading] = useState(true);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Only check once per user session, not on every route change
    if (hasCheckedRef.current) {
      setLoading(false);
      return;
    }

    if (!user) {
      setLoading(false);
      return;
    }
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
      setLoading(false);
      return;
    }

    hasCheckedRef.current = true;
    let cancelled = false;
    setLoading(true);

    const run = async () => {
      try {
        const profile = await refreshUser();
        if (cancelled) return;
        const target = targetForStatus(profile?.business_status);
        if (profile) {
          setData({
            business_status: profile.business_status,
            payment: null,
            kyc: { is_approved: profile.kyc_status === "APPROVED" },
            rejection_reason: null,
            kyc_status: profile.kyc_status,
          });
        }
        if (profile?.business_status === "APPROVED" && approvedRedirectPaths.has(currentPath)) {
          navigate("/business/dashboard", { replace: true });
          return;
        }
        if (target && target !== currentPath) {
          navigate(target, { replace: true });
        }
      } catch {
        if (cancelled) return;
        navigate(resolveHomeRoute(user), { replace: true });
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [user?.id]); // Only re-run when user.id changes, not on route changes

  return { ...data, loading };
};
