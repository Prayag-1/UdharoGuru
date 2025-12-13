import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import AuthShell from "./pages/auth/AuthShell.jsx";
import PrivateDashboard from "./pages/private/PrivateDashboard.jsx";
import Customers from "./pages/Customers.jsx";
import Transactions from "./pages/Transactions.jsx";

import KycForm from "./pages/business/KycForm.jsx";
import PendingVerification from "./pages/business/PendingVerification.jsx";
import BusinessDashboard from "./pages/business/BusinessDashboard.jsx";

function RequireAuth({ children }) {
  const token = localStorage.getItem("access_token");
  return token ? children : <Navigate to="/auth" replace />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />

        {/* AUTH */}
        <Route path="/auth" element={<AuthShell />} />

        {/* PRIVATE ACCOUNT */}
        <Route
          path="/private/dashboard"
          element={
            <RequireAuth>
              <PrivateDashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/customers"
          element={
            <RequireAuth>
              <Customers />
            </RequireAuth>
          }
        />
        <Route
          path="/transactions"
          element={
            <RequireAuth>
              <Transactions />
            </RequireAuth>
          }
        />

        {/* BUSINESS ACCOUNT */}
        <Route
          path="/business/kyc"
          element={
            <RequireAuth>
              <KycForm />
            </RequireAuth>
          }
        />
        <Route
          path="/business/pending"
          element={
            <RequireAuth>
              <PendingVerification />
            </RequireAuth>
          }
        />
        <Route
          path="/business/dashboard"
          element={
            <RequireAuth>
              <BusinessDashboard />
            </RequireAuth>
          }
        />

        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;