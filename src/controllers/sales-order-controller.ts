import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error.js";
import { findCustomerById } from "../repositories/customer-repository.js";
import { findEnquiryById } from "../repositories/enquiry-repository.js";
import { findQuotationById } from "../repositories/quotation-repository.js";
import { findSalesOrderById, listSalesOrderItems, listSalesOrders } from "../repositories/sales-order-repository.js";
import { quotationIdSchema } from "../schemas/quotation-schemas.js";
import { dispatchRequestSchema } from "../schemas/dispatch-schemas.js";
import { dispatchSalesOrder } from "../services/dispatch-service.js";
import { confirmSalesOrder } from "../services/inventory-service.js";
import { convertAcceptedQuotation } from "../services/sales-order-service.js";

const publicCustomer = (customer: NonNullable<Awaited<ReturnType<typeof findCustomerById>>>) => ({
  id: customer.id,
  customerCode: customer.customerCode,
  companyName: customer.companyName,
  contactPerson: customer.contactPerson,
  mobile: customer.mobile,
  email: customer.email,
  city: customer.city,
});

const publicEnquiry = (enquiry: NonNullable<Awaited<ReturnType<typeof findEnquiryById>>>) => ({
  id: enquiry.id,
  enquiryNumber: enquiry.enquiryNumber,
  customerId: enquiry.customerId,
  enquiryDate: enquiry.enquiryDate,
  requiredDate: enquiry.requiredDate,
  notes: enquiry.notes,
  status: enquiry.status,
});

const publicQuotation = (quotation: NonNullable<Awaited<ReturnType<typeof findQuotationById>>>) => ({
  id: quotation.id,
  quotationNumber: quotation.quotationNumber,
  validUntil: quotation.validUntil,
  status: quotation.status,
  subtotal: quotation.subtotal,
  discountTotal: quotation.discountTotal,
  gstTotal: quotation.gstTotal,
  grandTotal: quotation.grandTotal,
});

const withDetails = async (order: NonNullable<Awaited<ReturnType<typeof findSalesOrderById>>>) => {
  const [customer, enquiry, quotation, items] = await Promise.all([
    findCustomerById(order.customerId),
    findEnquiryById(order.enquiryId),
    findQuotationById(order.quotationId),
    listSalesOrderItems(order.id),
  ]);
  return {
    order: {
      id: order.id,
      salesOrderNumber: order.salesOrderNumber,
      quotationId: order.quotationId,
      enquiryId: order.enquiryId,
      customerId: order.customerId,
      orderDate: order.orderDate,
      totalAmount: order.totalAmount,
      status: order.status,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    customer: customer ? publicCustomer(customer) : null,
    enquiry: enquiry ? publicEnquiry(enquiry) : null,
    quotation: quotation ? publicQuotation(quotation) : null,
    items,
  };
};

export const convert = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  const quotationId = quotationIdSchema.parse(request.params.id);
  const result = await convertAcceptedQuotation(quotationId, request.user.id);
  response.status(201).json({ success: true, data: result });
};

export const confirm = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  const orderId = quotationIdSchema.parse(request.params.id);
  const result = await confirmSalesOrder(orderId, request.user.id);
  response.json({ success: true, data: result });
};

export const dispatch = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  const orderId = quotationIdSchema.parse(request.params.id);
  const input = dispatchRequestSchema.parse(request.body);
  const result = await dispatchSalesOrder(orderId, request.user.id, input);
  response.json({ success: true, data: result });
};

export const list = async (_request: Request, response: Response) => {
  const orders = await listSalesOrders();
  response.json({ success: true, data: { salesOrders: await Promise.all(orders.map(withDetails)) } });
};

export const getById = async (request: Request, response: Response) => {
  const orderId = quotationIdSchema.parse(request.params.id);
  const order = await findSalesOrderById(orderId);
  if (!order) throw new ApiError(404, "SALES_ORDER_NOT_FOUND", "Sales Order not found.");
  response.json({ success: true, data: await withDetails(order) });
};
