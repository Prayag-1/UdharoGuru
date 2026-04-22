import { Navigate, Route, Routes, BrowserRouter } from "react-router-dom";

import "./App.css";
import { AuthProvider } from "./context/AuthContext";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import VerifyEmail from "./pages/auth/VerifyEmail";
import BusinessLayout from "./pages/business/BusinessLayout";
import BusinessDashboard from "./pages/business/BusinessDashboard";
import Payment from "./pages/business/Payment";
import KycForm from "./pages/business/KycForm";
import BusinessProfileSetup from "./pages/business/BusinessProfileSetup";
import CustomersPage from "./pages/business/CustomersPage";
import CustomerProfile from "./pages/business/CustomerProfile";
import ProductsPage from "./pages/business/ProductsPage";
import CreditSalesPage from "./pages/business/CreditSalesPage";
import CreateCreditSale from "./pages/business/CreateCreditSale";
import CreditSaleDetail from "./pages/business/CreditSaleDetail";
import IncomePage from "./pages/business/IncomePage";
import OCRUpload from "./pages/business/OCRUpload";
import PaymentsPage from "./pages/business/PaymentsPage";
import PendingVerification from "./pages/business/PendingVerification";
import Rejected from "./pages/business/Rejected";
import OcrList from "./pages/business/OcrList";
import OcrDetail from "./pages/business/OcrDetail";
import PaymentSuccess from "./pages/business/PaymentSuccess";
import PaymentCancel from "./pages/business/PaymentCancel";
import BusinessPaymentRequest from "./pages/business/BusinessPaymentRequest";
import PrivateLayout from "./pages/private/PrivateLayout";
import DashboardView from "./pages/private/DashboardView";
import FriendsView from "./pages/private/FriendsView";
import FriendDetailView from "./pages/private/FriendDetailView";
import ActivityView from "./pages/private/ActivityView";
import GroupsView from "./pages/private/GroupsView";
import PrivatePaymentRequest from "./pages/private/PrivatePaymentRequest";
import AccountView from "./pages/private/AccountView";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/auth/login" replace />} />

          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/signup" element={<Signup />} />
          <Route path="/auth/verify-email" element={<VerifyEmail />} />

          <Route path="/business/*" element={<BusinessLayout />}>
            <Route path="dashboard" element={<BusinessDashboard />} />
            <Route path="payment" element={<Payment />} />
            <Route path="payment-request" element={<BusinessPaymentRequest />} />
            <Route path="profile" element={<BusinessProfileSetup />} />
            <Route path="customers" element={<CustomersPage />} />
            <Route path="customers/:id" element={<CustomerProfile />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="credit-sales" element={<CreditSalesPage />} />
            <Route path="credit-sales/create" element={<CreateCreditSale />} />
            <Route path="credit-sales/:id" element={<CreditSaleDetail />} />
            <Route path="income" element={<IncomePage />} />
            <Route path="ocr/upload" element={<OCRUpload />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="kyc" element={<KycForm />} />
            <Route path="kyc/review" element={<KycForm />} />
            <Route path="pending" element={<PendingVerification />} />
            <Route path="rejected" element={<Rejected />} />
            <Route path="ocr" element={<OcrList />} />
            <Route path="ocr/:id" element={<OcrDetail />} />
            <Route path="*" element={<Navigate to="/business/dashboard" replace />} />
          </Route>

          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/payment-cancel" element={<PaymentCancel />} />

          <Route path="/private" element={<Navigate to="/private/friends" replace />} />
          <Route path="/private/*" element={<PrivateLayout />}>
            <Route path="dashboard" element={<DashboardView />} />
            <Route path="payment-request" element={<PrivatePaymentRequest />} />
            <Route path="friends" element={<FriendsView />} />
            <Route path="friends/:id" element={<FriendDetailView />} />
            <Route path="groups" element={<GroupsView />} />
            <Route path="activity" element={<ActivityView />} />
            <Route path="account" element={<AccountView />} />
            <Route path="*" element={<Navigate to="/private/friends" replace />} />
          </Route>

          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
