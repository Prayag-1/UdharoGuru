import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { resolveHomeRoute, useAuth } from "../context/AuthContext";

const targetForStatus = (status) => {
  switch (status) {
    case "APPROVED":
      return "/business/dashboard";
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

export const useBusinessGate = (currentPath) => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const hasChecked = useRef(false);
  const [data, setData] = useState({ business_status: null, payment: null, kyc: null, rejection_reason: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (hasChecked.current) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (user.account_type !== "BUSINESS") {
      navigate(resolveHomeRoute(user), { replace: true });
      setLoading(false);
      hasChecked.current = true;
      return;
    }
    hasChecked.current = true;
    const run = async () => {
      try {
        const profile = await refreshUser();
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
        if (target && target !== currentPath) {
          navigate(target, { replace: true });
        }
      } catch {
        navigate(resolveHomeRoute(user), { replace: true });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user?.id, currentPath, navigate, refreshUser]);

  return { ...data, loading };
};
