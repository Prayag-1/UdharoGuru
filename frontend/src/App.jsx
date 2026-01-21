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
import OcrList from "./pages/business/OcrList";
import OcrDetail from "./pages/business/OcrDetail";
import PrivateLayout from "./pages/private/PrivateLayout";
import DashboardView from "./pages/private/DashboardView";
import ExpensesView from "./pages/private/ExpensesView";
import FriendsView from "./pages/private/FriendsView";
import ActivityView from "./pages/private/ActivityView";
import GroupsView from "./pages/private/GroupsView";

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
          <Route path="/business/ocr" element={<OcrList />} />
          <Route path="/business/ocr/:id" element={<OcrDetail />} />

          <Route path="/private" element={<Navigate to="/private/dashboard" replace />} />
          <Route path="/private/*" element={<PrivateLayout />}>
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="expenses" element={<ExpensesView />} />
            <Route path="friends" element={<FriendsView />} />
            <Route path="groups" element={<GroupsView />} />
            <Route path="activity" element={<ActivityView />} />
            <Route path="*" element={<Navigate to="/private/dashboard" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
