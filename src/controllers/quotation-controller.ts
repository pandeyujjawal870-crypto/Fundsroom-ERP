import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error.js";
import { findCustomerById } from "../repositories/customer-repository.js";
import { findEnquiryById } from "../repositories/enquiry-repository.js";
import { findQuotationById, listQuotationItems, listQuotations } from "../repositories/quotation-repository.js";
import { createQuotationSchema, quotationIdSchema, updateQuotationStatusSchema } from "../schemas/quotation-schemas.js";
import { changeQuotationStatus, createQuotation } from "../services/quotation-service.js";

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

export const create = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  const input = createQuotationSchema.parse(request.body);
  const result = await createQuotation(input, request.user.id);
  response.status(201).json({ success: true, data: result });
};

const withDetails = async (quotation: NonNullable<Awaited<ReturnType<typeof findQuotationById>>>) => {
  const [customer, enquiry, items] = await Promise.all([
    findCustomerById(quotation.customerId),
    findEnquiryById(quotation.enquiryId),
    listQuotationItems(quotation.id),
  ]);
  return {
    quotation: {
      id: quotation.id,
      quotationNumber: quotation.quotationNumber,
      validUntil: quotation.validUntil,
      status: quotation.status,
      subtotal: quotation.subtotal,
      discountTotal: quotation.discountTotal,
      gstTotal: quotation.gstTotal,
      grandTotal: quotation.grandTotal,
      createdAt: quotation.createdAt,
      updatedAt: quotation.updatedAt,
    },
    customer: customer ? publicCustomer(customer) : null,
    enquiry: enquiry ? publicEnquiry(enquiry) : null,
    items,
  };
};

export const list = async (_request: Request, response: Response) => {
  const quotations = await listQuotations();
  response.json({ success: true, data: { quotations: await Promise.all(quotations.map(withDetails)) } });
};

export const getById = async (request: Request, response: Response) => {
  const id = quotationIdSchema.parse(request.params.id);
  const quotation = await findQuotationById(id);
  if (!quotation) throw new ApiError(404, "QUOTATION_NOT_FOUND", "Quotation not found.");
  response.json({ success: true, data: await withDetails(quotation) });
};

export const updateStatus = async (request: Request, response: Response) => {
  const id = quotationIdSchema.parse(request.params.id);
  const { status } = updateQuotationStatusSchema.parse(request.body);
  const quotation = await changeQuotationStatus(id, status);
  response.json({ success: true, data: { quotation } });
};
