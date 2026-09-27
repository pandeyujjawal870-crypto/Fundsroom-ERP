import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { customerApi, enquiryApi, inventoryApi } from "../api/resources";
import { ErrorNotice, EmptyState, Field, LoadingState, PageHeader, StatusBadge, SuccessNotice } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { Customer, EnquiryDetail, InventoryRow } from "../types";

const today = new Date().toISOString().slice(0, 10);
const makeNumber = () => `ENQ-${Date.now().toString().slice(-8)}`;

export const Enquiries = () => {
  const { user } = useAuth();
  const canCreate = user?.role === "SALES";
  const [enquiries, setEnquiries] = useState<EnquiryDetail[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showCustomer, setShowCustomer] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ enquiryNumber: makeNumber(), customerId: "", enquiryDate: today, requiredDate: today, notes: "" });
  const [items, setItems] = useState([{ productId: "", quantity: "" }]);
  const [customerForm, setCustomerForm] = useState({ companyName: "", contactPerson: "", mobile: "", email: "", city: "" });

  const load = async () => {
    setLoading(true); setError("");
    try { const [enquiryData, customerData, inventoryData] = await Promise.all([enquiryApi.list(), customerApi.list(), inventoryApi.list()]); setEnquiries(enquiryData.enquiries); setCustomers(customerData.customers); setProducts(inventoryData.inventory); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Unable to load enquiries. Please try again."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const updateItem = (index: number, key: "productId" | "quantity", value: string) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  const submitCustomer = async () => { setSaving(true); setError(""); try { const result = await customerApi.create(customerForm); setCustomers((current) => [...current, result.customer]); setForm((current) => ({ ...current, customerId: result.customer.id })); setCustomerForm({ companyName: "", contactPerson: "", mobile: "", email: "", city: "" }); setShowCustomer(false); setSuccess("Customer created and selected."); } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to create customer."); } finally { setSaving(false); } };
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setSaving(true); setError(""); setSuccess(""); try { await enquiryApi.create({ ...form, notes: form.notes || null, items: items.map((item) => ({ productId: item.productId, quantity: Number(item.quantity) })) }); setSuccess("Enquiry created successfully."); setShowForm(false); setForm({ enquiryNumber: makeNumber(), customerId: "", enquiryDate: today, requiredDate: today, notes: "" }); setItems([{ productId: "", quantity: "" }]); await load(); } catch (err) { setError(err instanceof ApiError ? err.message : "Unable to create enquiry."); } finally { setSaving(false); } };
  const selectedProducts = new Set(items.map((item) => item.productId).filter(Boolean));
  return <section className="page"><PageHeader eyebrow="Pipeline / 01" title="Enquiries" description="Capture demand before it becomes a commitment." action={canCreate ? <button className="button button-primary" onClick={() => setShowForm(true)}>New enquiry <span>＋</span></button> : undefined} />
    {error && <ErrorNotice message={error} />}{success && <SuccessNotice message={success} />}
    {showForm && <div className="form-panel"><div className="panel-heading"><div><span className="eyebrow">New record</span><h2>Build an enquiry</h2></div><button className="icon-button" onClick={() => setShowForm(false)} aria-label="Close form">×</button></div><form onSubmit={submit}>
      <div className="form-grid"><Field label="Enquiry number" required><input value={form.enquiryNumber} onChange={(e) => setForm({ ...form, enquiryNumber: e.target.value })} required /></Field><Field label="Customer" required><select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.companyName}</option>)}</select></Field></div>
      <button type="button" className="text-button" onClick={() => setShowCustomer(!showCustomer)}>{showCustomer ? "Close customer form" : "+ Create customer"}</button>
      {showCustomer && <div className="nested-form"><h3>Customer details</h3><div className="form-grid three"><Field label="Company name" required><input value={customerForm.companyName} onChange={(e) => setCustomerForm({ ...customerForm, companyName: e.target.value })} required /></Field><Field label="Contact person" required><input value={customerForm.contactPerson} onChange={(e) => setCustomerForm({ ...customerForm, contactPerson: e.target.value })} required /></Field><Field label="City" required><input value={customerForm.city} onChange={(e) => setCustomerForm({ ...customerForm, city: e.target.value })} required /></Field><Field label="Mobile" required><input value={customerForm.mobile} onChange={(e) => setCustomerForm({ ...customerForm, mobile: e.target.value })} required /></Field><Field label="Email" required><input type="email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} required /></Field></div><button type="button" className="button button-secondary" onClick={() => void submitCustomer()} disabled={saving}>{saving ? "Saving..." : "Save customer"}</button></div>}
      <div className="section-heading"><div><h3>Products</h3><p>Add one or more products to this request.</p></div><button type="button" className="button button-secondary" onClick={() => setItems([...items, { productId: "", quantity: "" }])}>Add product</button></div>
      <div className="line-items">{items.map((item, index) => <div className="line-row" key={index}><select value={item.productId} onChange={(e) => updateItem(index, "productId", e.target.value)} required><option value="">Select product</option>{products.map((row) => <option key={row.product.id} value={row.product.id} disabled={selectedProducts.has(row.product.id) && row.product.id !== item.productId}>{row.product.productName}</option>)}</select><input type="number" min="0.01" step="0.01" placeholder="Quantity" value={item.quantity} onChange={(e) => updateItem(index, "quantity", e.target.value)} required />{items.length > 1 && <button type="button" className="icon-button" onClick={() => setItems(items.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remove product">×</button>}</div>)}</div>
      <div className="form-grid"><Field label="Enquiry date" required><input type="date" value={form.enquiryDate} onChange={(e) => setForm({ ...form, enquiryDate: e.target.value })} required /></Field><Field label="Required date" required><input type="date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} required /></Field></div><Field label="Notes"><textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Context for the sales team" /></Field><div className="form-actions"><button type="button" className="button button-secondary" onClick={() => setShowForm(false)}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Creating..." : "Create enquiry"}</button></div>
    </form></div>}
    <div className="table-card">{loading ? <LoadingState label="Loading enquiries..." /> : enquiries.length === 0 ? <EmptyState title="No enquiries found." action={canCreate ? <button className="text-button" onClick={() => setShowForm(true)}>Create the first enquiry</button> : undefined} /> : <div className="table-scroll"><table><thead><tr><th>Enquiry</th><th>Customer</th><th>Received</th><th>Required</th><th>Products</th><th>Status</th></tr></thead><tbody>{enquiries.map(({ enquiry, items: enquiryItems }) => <tr key={enquiry.id}><td><strong>{enquiry.enquiryNumber}</strong><small>{enquiry.notes || "No notes"}</small></td><td>{customers.find((customer) => customer.id === enquiry.customerId)?.companyName ?? "Customer unavailable"}</td><td>{enquiry.enquiryDate}</td><td>{enquiry.requiredDate}</td><td><span className="count-pill">{enquiryItems.length} {enquiryItems.length === 1 ? "product" : "products"}</span></td><td><StatusBadge status={enquiry.status} /></td></tr>)}</tbody></table></div>}</div>
  </section>;
};
