import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { getBusinessStatus } from "../api/business";
import { resolveHomeRoute, useAuth } from "../context/AuthContext";

const targetForStatus = (status) => {
  switch (status) {
    case "PENDING_PAYMENT":
    default:
      return "/business/payment";
    case "PAYMENT_SUBMITTED":
      return "/business/kyc";
    case "KYC_SUBMITTED":
      return "/business/pending";
    case "APPROVED":
      return "/business/dashboard";
    case "REJECTED":
      return "/business/rejected";
  }
};

export const useBusinessGate = (currentPath) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState({ business_status: null, payment: null, kyc: null, rejection_reason: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      if (!user) {
        setLoading(false);
        return;
      }
      if (user.account_type !== "BUSINESS") {
        navigate(resolveHomeRoute(user), { replace: true });
        setLoading(false);
        return;
      }
      try {
        const { data: status } = await getBusinessStatus();
        setData(status);
        const target = targetForStatus(status.business_status);
        if (target !== currentPath && location.pathname !== target) {
          navigate(target, { replace: true });
        }
      } catch {
        navigate(resolveHomeRoute(user), { replace: true });
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [user, currentPath, navigate, location.pathname]);

  return { ...data, loading };
};
