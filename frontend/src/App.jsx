import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";

import "./App.css";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import VerifyEmail from "./pages/auth/VerifyEmail";
import BusinessDashboard from "./pages/business/BusinessDashboard";
import Payment from "./pages/business/Payment";
import KycForm from "./pages/business/KycForm";
import PendingVerification from "./pages/business/PendingVerification";
import Rejected from "./pages/business/Rejected";
import PrivateDashboard from "./pages/private/PrivateDashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth/login" replace />} />

          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />

          <Route path="/business/dashboard" element={<BusinessDashboard />} />
          <Route path="/business/payment" element={<Payment />} />
          <Route path="/business/kyc" element={<KycForm />} />
          <Route path="/business/kyc/review" element={<KycForm />} />
          <Route path="/business/pending" element={<PendingVerification />} />
          <Route path="/business/rejected" element={<Rejected />} />

          <Route path="/private/dashboard" element={<PrivateDashboard />} />

          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
