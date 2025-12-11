import { useEffect, useState } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";

import Customers from "./pages/Customers.jsx";
import Transactions from "./pages/Transactions.jsx";

function App() {
  const [backendStatus, setBackendStatus] = useState("Checking backend...");

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/api/customers/")
      .then((res) => {
        setBackendStatus("Backend Connected ✔");
      })
      .catch(() => {
        setBackendStatus("Backend Not Reachable ✘");
      });
  }, []);

  return (
    <BrowserRouter>
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Udharo Guru</h1>
        <h3>{backendStatus}</h3>

        <nav style={{ marginTop: "20px" }}>
          <Link to="/customers" style={{ marginRight: "15px" }}>
            Customers
          </Link>
          <Link to="/transactions" style={{ marginRight: "15px" }}>
            Transactions
          </Link>
        </nav>

        <div style={{ marginTop: "40px" }}>
          <Routes>
            <Route path="/customers" element={<Customers />} />
            <Route path="/transactions" element={<Transactions />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}

export default App;
