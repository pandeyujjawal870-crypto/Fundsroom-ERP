import { apiRequest } from "./client";
import type { Customer, EnquiryDetail, InventoryRow, InventorySnapshot, Quotation, SalesOrder, User } from "../types";

export const authApi = {
  login: (email: string, password: string) => apiRequest<{ user: User; token: string }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => apiRequest<{ user: User }>("/auth/me"),
};

export const customerApi = {
  list: () => apiRequest<{ customers: Customer[] }>("/customers"),
  create: (input: Omit<Customer, "id" | "customerCode">) => apiRequest<{ customer: Customer }>("/customers", { method: "POST", body: JSON.stringify(input) }),
};

export const enquiryApi = {
  list: async () => { const data = await apiRequest<{ enquiries: EnquiryDetail[] }>("/enquiries"); return { enquiries: data.enquiries.map((entry) => ({ ...entry, enquiry: { ...entry.enquiry, items: entry.items } })) }; },
  create: (input: unknown) => apiRequest<{ enquiry: unknown; items: unknown[] }>("/enquiries", { method: "POST", body: JSON.stringify(input) }),
};

export const quotationApi = {
  list: async () => {
    const data = await apiRequest<{
      quotations: Array<{
        quotation: Omit<Quotation, "customer" | "enquiry" | "items">;
        customer: Customer | null;
        enquiry: EnquiryDetail["enquiry"] | null;
        items: Quotation["items"];
      }>;
    }>("/quotations");
    return {
      quotations: data.quotations.map(({ quotation, customer, enquiry, items }) => ({
        ...quotation,
        customer,
        enquiry,
        items,
      })),
    };
  },
  create: (input: unknown) => apiRequest<{ quotation: Quotation; items: unknown[] }>("/quotations", { method: "POST", body: JSON.stringify(input) }),
  updateStatus: (id: string, status: "SENT" | "ACCEPTED" | "REJECTED") => apiRequest<{ quotation: Quotation }>(`/quotations/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  convert: (id: string) => apiRequest<{ order: SalesOrder; items: unknown[] }>(`/quotations/${id}/convert`, { method: "POST" }),
};

export const salesOrderApi = {
  list: async () => {
    const data = await apiRequest<{
      salesOrders: Array<{
        order: Omit<SalesOrder, "customer" | "enquiry" | "quotation" | "items">;
        customer: Customer | null;
        enquiry: EnquiryDetail["enquiry"] | null;
        quotation: SalesOrder["quotation"];
        items: SalesOrder["items"];
      }>;
    }>("/sales-orders");
    return {
      salesOrders: data.salesOrders.map(({ order, customer, enquiry, quotation, items }) => ({
        ...order,
        customer,
        enquiry,
        quotation,
        items,
      })),
    };
  },
  confirm: (id: string) => apiRequest<{ order: SalesOrder }>(`/sales-orders/${id}/confirm`, { method: "POST" }),
  dispatch: (id: string, input: { vehicleNumber: string; driverName: string }) => apiRequest<{ order: SalesOrder }>(`/sales-orders/${id}/dispatch`, { method: "POST", body: JSON.stringify(input) }),
};

export const inventoryApi = {
  list: () => apiRequest<{ inventory: InventoryRow[] }>("/inventory/availability"),
  adjust: (productId: string, input: { adjustmentType: "RECEIVE" | "CORRECTION"; quantity: string; reason: string }) => apiRequest<{ inventory: InventorySnapshot }>(`/inventory/${productId}/adjust`, { method: "PATCH", body: JSON.stringify(input) }),
};
