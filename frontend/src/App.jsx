import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider, resolveHomeRoute, useAuth } from "./context/AuthContext";
import Login from "./pages/auth/Login.jsx";
import Signup from "./pages/auth/Signup.jsx";
import BusinessDashboard from "./pages/business/BusinessDashboard.jsx";
import KycForm from "./pages/business/KycForm.jsx";
import PendingVerification from "./pages/business/PendingVerification.jsx";
import Customers from "./pages/Customers.jsx";
import PrivateDashboard from "./pages/private/PrivateDashboard.jsx";
import Transactions from "./pages/Transactions.jsx";

const LoadingScreen = () => (
  <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "Inter, system-ui" }}>
    Loading...
  </div>
);

const ProtectedRoute = ({ children, allow }) => {
  const { user, loading } = useAuth();

  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/auth" replace />;

  if (allow) {
    const decision = allow(user);
    if (decision !== true) {
      return <Navigate to={decision} replace />;
    }
  }

  return children;
};

const AuthRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? <Navigate to={resolveHomeRoute(user)} replace /> : children;
};

const HomeRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={resolveHomeRoute(user)} replace />;
};

const ensurePrivate = (user) =>
  user.account_type === "PRIVATE" ? true : resolveHomeRoute(user);

const ensureBusiness = (user) =>
  user.account_type === "BUSINESS" ? true : resolveHomeRoute(user);

const ensureBusinessApproved = (user) => {
  if (user.account_type !== "BUSINESS") return resolveHomeRoute(user);
  return user.kyc_status === "APPROVED" ? true : "/business/kyc";
};

const ensureBusinessPending = (user) => {
  if (user.account_type !== "BUSINESS") return resolveHomeRoute(user);
  return user.kyc_status === "APPROVED" ? "/business/dashboard" : true;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomeRedirect />} />
          <Route path="/auth" element={<Navigate to="/auth/login" replace />} />
          <Route
            path="/auth/login"
            element={
              <AuthRoute>
                <Login />
              </AuthRoute>
            }
          />
          <Route
            path="/auth/signup"
            element={
              <AuthRoute>
                <Signup />
              </AuthRoute>
            }
          />
          
          <Route
            path="/private/dashboard"
            element={
              <ProtectedRoute allow={ensurePrivate}>
                <PrivateDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <ProtectedRoute>
                <Customers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/transactions"
            element={
              <ProtectedRoute>
                <Transactions />
              </ProtectedRoute>
            }
          />

          <Route
            path="/business/kyc"
            element={
              <ProtectedRoute allow={ensureBusinessPending}>
                <KycForm />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business/pending"
            element={
              <ProtectedRoute allow={ensureBusinessPending}>
                <PendingVerification />
              </ProtectedRoute>
            }
          />
          <Route
            path="/business/dashboard"
            element={
              <ProtectedRoute allow={ensureBusinessApproved}>
                <BusinessDashboard />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
