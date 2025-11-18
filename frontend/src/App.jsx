import { useEffect, useState } from "react";
import axios from "axios";

function App() {
  const [msg, setMsg] = useState("Loading...");

  useEffect(() => {
    axios
      .get("http://127.0.0.1:8000/api/hello/")
      .then((res) => setMsg(res.data.message))
      .catch(() => setMsg("Backend not reachable"));
  }, []);

  return (
    <div style={{ textAlign: "center", marginTop: "100px" }}>
      <h1>Udharo Guru </h1>
      <h3>{msg}</h3>
    </div>
  );
}

export default App;
