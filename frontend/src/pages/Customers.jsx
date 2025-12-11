import React, { useEffect, useState } from "react";
import { getCustomers, createCustomer, deleteCustomer } from "../api/customers";

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
  });

  const loadCustomers = async () => {
    const res = await getCustomers();
    setCustomers(res.data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await createCustomer(form);
    setForm({ name: "", phone: "", email: "" });
    loadCustomers();
  };

  const handleDelete = async (id) => {
    await deleteCustomer(id);
    loadCustomers();
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>Customers</h1>

      <form onSubmit={handleSubmit} style={{ marginBottom: 20 }}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <input
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
        />
        <input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <button type="submit">Add Customer</button>
      </form>

      <ul>
        {customers.map((c) => (
          <li key={c.id}>
            {c.name} ({c.phone})
            <button onClick={() => handleDelete(c.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Customers;
