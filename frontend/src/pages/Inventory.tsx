import { useEffect, useState } from "react";
import { ApiError } from "../api/client";
import { inventoryApi } from "../api/resources";
import { EmptyState, ErrorNotice, Field, LoadingState, PageHeader, SuccessNotice } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { InventoryRow } from "../types";

export const Inventory = () => {
  const { user } = useAuth();
  const canAdjust = user?.role === "ADMIN";
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [productId, setProductId] = useState("");
  const [adjustmentType, setAdjustmentType] = useState<"RECEIVE" | "CORRECTION">("RECEIVE");
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await inventoryApi.list();
      setRows(data.inventory);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to load inventory. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const selectedRow = rows.find((row) => row.product.id === productId);
  const resetForm = () => {
    setProductId("");
    setAdjustmentType("RECEIVE");
    setQuantity("");
    setReason("");
    setShowForm(false);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await inventoryApi.adjust(productId, { adjustmentType, quantity, reason });
      setSuccess("Inventory adjustment saved successfully.");
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to adjust inventory.");
    } finally {
      setSaving(false);
    }
  };

  return <section className="page">
    <PageHeader eyebrow="Control / 04" title="Inventory" description="A read-only view of physical, reserved, and available stock." action={canAdjust ? <button className="button button-primary" onClick={() => setShowForm(true)}>Adjust stock <span>＋</span></button> : undefined} />
    {error && <ErrorNotice message={error} />}
    {success && <SuccessNotice message={success} />}
    {showForm && <div className="form-panel compact-panel">
      <div className="panel-heading"><div><span className="eyebrow">Stock control</span><h2>Adjust stock</h2></div><button className="icon-button" onClick={resetForm} aria-label="Close form">×</button></div>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Product" required><select value={productId} onChange={(event) => setProductId(event.target.value)} required><option value="">Select product</option>{rows.map((row) => <option key={row.product.id} value={row.product.id}>{row.product.productName}</option>)}</select></Field>
          <Field label="Adjustment type" required><select value={adjustmentType} onChange={(event) => setAdjustmentType(event.target.value as "RECEIVE" | "CORRECTION")}><option value="RECEIVE">RECEIVE</option><option value="CORRECTION">CORRECTION</option></select></Field>
          <Field label={adjustmentType === "RECEIVE" ? "Quantity received" : "Quantity change"} required><input type="number" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder={adjustmentType === "CORRECTION" ? "Use negative value to reduce" : "0.00"} required /></Field>
          <Field label="Current physical quantity"><input value={selectedRow?.physicalQuantity ?? "—"} readOnly /></Field>
          <Field label="Current available quantity"><input value={selectedRow?.availableQuantity ?? "—"} readOnly /></Field>
        </div>
        <Field label="Reason" required><textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Supplier receipt, cycle count, or correction reason" required /></Field>
        <div className="form-actions"><button type="button" className="button button-secondary" onClick={resetForm}>Cancel</button><button className="button button-primary" disabled={saving}>{saving ? "Saving..." : "Save adjustment"}</button></div>
      </form>
    </div>}
    <div className="inventory-banner"><div><span className="eyebrow">Availability formula</span><strong>Available = Physical − Reserved</strong></div><span>Reservations and adjustments are controlled by the backend.</span></div>
    <div className="table-card">{loading ? <LoadingState label="Loading inventory..." /> : rows.length === 0 ? <EmptyState title="No inventory records found." /> : <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Unit</th><th>Physical</th><th>Reserved</th><th>Available</th></tr></thead><tbody>{rows.map((row) => <tr key={row.product.id}><td><strong>{row.product.productName}</strong><small>{row.product.productCode}</small></td><td>{row.product.category}</td><td>{row.product.unit}</td><td>{row.physicalQuantity}</td><td>{row.reservedQuantity}</td><td><strong className="available-value">{row.availableQuantity}</strong></td></tr>)}</tbody></table></div>}</div>
  </section>;
};
