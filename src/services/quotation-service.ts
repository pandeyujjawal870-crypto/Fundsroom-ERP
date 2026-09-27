import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { ApiError } from "../errors/api-error.js";
import { findCustomerById } from "../repositories/customer-repository.js";
import { findEnquiryById, listEnquiryItems } from "../repositories/enquiry-repository.js";
import {
  findProductsByIds,
  findQuotationByIdForUpdate,
  findQuotationByNumber,
  insertQuotation,
  insertQuotationItems,
  updateEnquiryStatus,
  updateQuotationStatus,
} from "../repositories/quotation-repository.js";
import { calculateQuotation, type QuotationItemInput } from "../utils/quotation-calculator.js";

type CreateQuotationInput = {
  quotationNumber?: string;
  enquiryId: string;
  validUntil: string;
  grandTotal?: string;
  items: QuotationItemInput[];
};

type QuotationStatus = "SENT" | "ACCEPTED" | "REJECTED";

export const createQuotation = async (input: CreateQuotationInput, createdBy: string) => {
  const productIds = input.items.map((item) => item.productId);
  if (new Set(productIds).size !== productIds.length) {
    throw new ApiError(422, "DUPLICATE_PRODUCT", "A quotation cannot contain the same product more than once.");
  }

  const enquiry = await findEnquiryById(input.enquiryId);
  if (!enquiry) throw new ApiError(404, "ENQUIRY_NOT_FOUND", "Enquiry not found.");

  const [customer, enquiryItems, products] = await Promise.all([
    findCustomerById(enquiry.customerId),
    listEnquiryItems(input.enquiryId),
    findProductsByIds(productIds),
  ]);
  if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "Customer not found.");
  if (enquiry.status === "WON" || enquiry.status === "LOST") {
    throw new ApiError(409, "ENQUIRY_TERMINAL", "A terminal enquiry cannot receive a new quotation.");
  }

  const enquiryProductIds = new Set(enquiryItems.map((item) => item.productId));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const invalidProductId = productIds.find((productId) => !enquiryProductIds.has(productId) || !productMap.get(productId)?.isActive);
  if (invalidProductId) throw new ApiError(404, "PRODUCT_NOT_FOUND", `Product ${invalidProductId} is not available on the enquiry.`);

  const calculated = calculateQuotation(input.items);
  const quotationNumber = input.quotationNumber ?? `QUO-${randomUUID()}`;
  if (await findQuotationByNumber(quotationNumber)) {
    throw new ApiError(409, "DUPLICATE_QUOTATION_NUMBER", "Quotation number already exists.");
  }

  return db.transaction(async (transaction) => {
    const quotation = await insertQuotation(transaction, {
      quotationNumber,
      enquiryId: enquiry.id,
      customerId: customer.id,
      validUntil: input.validUntil,
      status: "DRAFT",
      subtotal: calculated.subtotal,
      discountTotal: calculated.discountTotal,
      gstTotal: calculated.gstTotal,
      grandTotal: calculated.grandTotal,
      createdBy,
    });
    if (!quotation) throw new ApiError(500, "QUOTATION_CREATE_FAILED", "The quotation could not be created.");

    const items = await insertQuotationItems(
      transaction,
      calculated.items.map((item) => ({
        quotationId: quotation.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.discountPercent,
        gstPercent: item.gstPercent,
        baseAmount: item.baseAmount,
        discountAmount: item.discountAmount,
        gstAmount: item.gstAmount,
        lineAmount: item.lineAmount,
      })),
    );
    await updateEnquiryStatus(transaction, enquiry.id, "QUOTED");
    return { quotation, items };
  });
};

const allowedTransitions: Record<string, QuotationStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
};

export const changeQuotationStatus = async (id: string, status: QuotationStatus) => {
  return db.transaction(async (transaction) => {
    const quotation = await findQuotationByIdForUpdate(transaction, id);
    if (!quotation) throw new ApiError(404, "QUOTATION_NOT_FOUND", "Quotation not found.");
    if (!allowedTransitions[quotation.status].includes(status)) {
      throw new ApiError(409, "INVALID_STATUS_TRANSITION", `Cannot change quotation status from ${quotation.status} to ${status}.`);
    }

    const updatedQuotation = await updateQuotationStatus(transaction, id, status);
    if (status === "ACCEPTED") await updateEnquiryStatus(transaction, quotation.enquiryId, "WON");
    if (status === "REJECTED") await updateEnquiryStatus(transaction, quotation.enquiryId, "LOST");
    return updatedQuotation;
  });
};
