import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { ApiError } from "../errors/api-error.js";
import {
  findCustomerForExecutor,
  findEnquiryForExecutor,
  findSalesOrderByQuotationId,
  insertSalesOrder,
  insertSalesOrderItems,
  listQuotationItemsForExecutor,
  lockQuotationForConversion,
} from "../repositories/sales-order-repository.js";

export const convertAcceptedQuotation = async (quotationId: string, createdBy: string) => {
  return db.transaction(async (transaction) => {
    const quotation = await lockQuotationForConversion(transaction, quotationId);
    if (!quotation) throw new ApiError(404, "QUOTATION_NOT_FOUND", "Quotation not found.");
    if (quotation.status !== "ACCEPTED") {
      throw new ApiError(409, "QUOTATION_NOT_ACCEPTED", "Only an accepted quotation can be converted into a Sales Order.");
    }

    const existingOrder = await findSalesOrderByQuotationId(transaction, quotation.id);
    if (existingOrder) throw new ApiError(409, "SALES_ORDER_ALREADY_EXISTS", "A Sales Order already exists for this quotation.");

    const [enquiry, customer, quotationItems] = await Promise.all([
      findEnquiryForExecutor(transaction, quotation.enquiryId),
      findCustomerForExecutor(transaction, quotation.customerId),
      listQuotationItemsForExecutor(transaction, quotation.id),
    ]);
    if (!enquiry) throw new ApiError(404, "ENQUIRY_NOT_FOUND", "The quotation's enquiry was not found.");
    if (!customer) throw new ApiError(404, "CUSTOMER_NOT_FOUND", "The quotation's customer was not found.");
    if (quotationItems.length === 0) throw new ApiError(422, "QUOTATION_HAS_NO_ITEMS", "The quotation has no items to convert.");

    const order = await insertSalesOrder(transaction, {
      salesOrderNumber: `SO-${randomUUID()}`,
      quotationId: quotation.id,
      enquiryId: enquiry.id,
      customerId: customer.id,
      orderDate: new Date().toISOString().slice(0, 10),
      totalAmount: quotation.grandTotal,
      status: "PENDING",
      createdBy,
    });
    if (!order) throw new ApiError(500, "SALES_ORDER_CREATE_FAILED", "The Sales Order could not be created.");

    const items = await insertSalesOrderItems(
      transaction,
      quotationItems.map((item) => ({
        salesOrderId: order.id,
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

    return { order, items };
  });
};
