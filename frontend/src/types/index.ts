export type Role = "ADMIN" | "SALES";
export type User = { id: string; fullName: string; email: string; role: Role; isActive: boolean };

export type Customer = {
  id: string;
  customerCode: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  city: string;
};

export type Product = { id: string; productCode: string; productName: string; category: string; unit: string; basePrice: string };
export type InventoryRow = { product: Product; physicalQuantity: string; reservedQuantity: string; availableQuantity: string };
export type InventorySnapshot = { productId: string; physicalQuantity: string; reservedQuantity: string; availableQuantity: string };
export type Enquiry = { id: string; enquiryNumber: string; customerId: string; enquiryDate: string; requiredDate: string; notes: string | null; status: string; items?: EnquiryItem[] };
export type EnquiryItem = { id: string; productId: string; productCode: string; productName: string; quantity: string };
export type EnquiryDetail = { enquiry: Enquiry; items: EnquiryItem[] };

export type Quotation = { id: string; quotationNumber: string; validUntil: string; status: string; subtotal: string; discountTotal: string; gstTotal: string; grandTotal: string; customer: Customer | null; enquiry: Enquiry | null; items: QuotationItem[] };
export type QuotationItem = { id: string; productId: string; productCode: string; productName: string; quantity: string; unitPrice: string; discountPercent: string; gstPercent: string; baseAmount: string; discountAmount: string; gstAmount: string; lineAmount: string };
export type QuotationSummary = Pick<Quotation, "id" | "quotationNumber" | "validUntil" | "status" | "subtotal" | "discountTotal" | "gstTotal" | "grandTotal">;
export type SalesOrder = { id: string; salesOrderNumber: string; quotationId: string; enquiryId: string; customerId: string; orderDate: string; totalAmount: string; status: string; customer: Customer | null; enquiry: Enquiry | null; quotation: QuotationSummary | null; items: SalesOrderItem[] };
export type SalesOrderItem = QuotationItem;
