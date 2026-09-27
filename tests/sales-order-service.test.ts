import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../src/db/index.js", () => ({ db: { transaction } }));
vi.mock("../src/repositories/sales-order-repository.js", () => ({
  findCustomerForExecutor: vi.fn(),
  findEnquiryForExecutor: vi.fn(),
  findSalesOrderByQuotationId: vi.fn(),
  insertSalesOrder: vi.fn(),
  insertSalesOrderItems: vi.fn(),
  listQuotationItemsForExecutor: vi.fn(),
  lockQuotationForConversion: vi.fn(),
}));

import {
  findCustomerForExecutor,
  findEnquiryForExecutor,
  findSalesOrderByQuotationId,
  insertSalesOrder,
  insertSalesOrderItems,
  listQuotationItemsForExecutor,
  lockQuotationForConversion,
} from "../src/repositories/sales-order-repository.js";
import { convertAcceptedQuotation } from "../src/services/sales-order-service.js";

const quotationId = "11111111-1111-4111-8111-111111111111";
const enquiryId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";
const productId = "44444444-4444-4444-8444-444444444444";
const quotation = {
  id: quotationId,
  enquiryId,
  customerId,
  status: "ACCEPTED" as const,
  grandTotal: "5310.00",
};
const quotationItems = [{
  id: "55555555-5555-4555-8555-555555555555",
  quotationId,
  productId,
  quantity: "10.00",
  unitPrice: "500.00",
  discountPercent: "10.00",
  gstPercent: "18.00",
  baseAmount: "5000.00",
  discountAmount: "500.00",
  gstAmount: "810.00",
  lineAmount: "5310.00",
}];

const prepareValid = () => {
  vi.mocked(lockQuotationForConversion).mockResolvedValue(quotation as never);
  vi.mocked(findSalesOrderByQuotationId).mockResolvedValue(undefined);
  vi.mocked(findEnquiryForExecutor).mockResolvedValue({ id: enquiryId, customerId } as never);
  vi.mocked(findCustomerForExecutor).mockResolvedValue({ id: customerId } as never);
  vi.mocked(listQuotationItemsForExecutor).mockResolvedValue(quotationItems as never);
  vi.mocked(insertSalesOrder).mockResolvedValue({ id: "66666666-6666-4666-8666-666666666666", status: "PENDING" } as never);
  vi.mocked(insertSalesOrderItems).mockResolvedValue([{ id: "77777777-7777-4777-8777-777777777777" }] as never);
  transaction.mockImplementation(async (callback) => callback({}));
};

beforeEach(() => vi.clearAllMocks());

describe("accepted quotation conversion", () => {
  it("creates a PENDING Sales Order with all traceability references", async () => {
    prepareValid();
    const result = await convertAcceptedQuotation(quotationId, "88888888-8888-4888-8888-888888888888");
    expect(result.order).toEqual(expect.objectContaining({ status: "PENDING" }));
    expect(insertSalesOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ quotationId, enquiryId, customerId, totalAmount: "5310.00", status: "PENDING" }));
  });

  it("copies historical pricing, discount, GST, and line amount into order items", async () => {
    prepareValid();
    await convertAcceptedQuotation(quotationId, "user-id");
    expect(insertSalesOrderItems).toHaveBeenCalledWith(expect.anything(), [expect.objectContaining({
      productId,
      quantity: "10.00",
      unitPrice: "500.00",
      discountPercent: "10.00",
      gstPercent: "18.00",
      lineAmount: "5310.00",
    })]);
  });

  it.each(["DRAFT", "SENT", "REJECTED"] as const)("rejects %s quotations", async (status) => {
    vi.mocked(lockQuotationForConversion).mockResolvedValue({ ...quotation, status } as never);
    await expect(convertAcceptedQuotation(quotationId, "user-id")).rejects.toMatchObject({ statusCode: 409, code: "QUOTATION_NOT_ACCEPTED" });
    expect(transaction).toHaveBeenCalled();
  });

  it("rejects a quotation that already has a Sales Order", async () => {
    prepareValid();
    vi.mocked(findSalesOrderByQuotationId).mockResolvedValue({ id: "existing-order" } as never);
    await expect(convertAcceptedQuotation(quotationId, "user-id")).rejects.toMatchObject({ statusCode: 409, code: "SALES_ORDER_ALREADY_EXISTS" });
  });

  it("rolls back when Sales Order item insertion fails", async () => {
    prepareValid();
    vi.mocked(insertSalesOrderItems).mockRejectedValue(new Error("item insert failed"));
    let rolledBack = false;
    transaction.mockImplementation(async (callback) => {
      try {
        return await callback({});
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    });
    await expect(convertAcceptedQuotation(quotationId, "user-id")).rejects.toThrow("item insert failed");
    expect(rolledBack).toBe(true);
  });

  it("allows only one of two simultaneous conversions", async () => {
    prepareValid();
    let orderCreated = false;
    vi.mocked(insertSalesOrder).mockImplementation(async () => {
      if (orderCreated) throw new Error("sales_orders_quotation_id_unique");
      orderCreated = true;
      return { id: "66666666-6666-4666-8666-666666666666", status: "PENDING" } as never;
    });
    const results = await Promise.allSettled([
      convertAcceptedQuotation(quotationId, "user-a"),
      convertAcceptedQuotation(quotationId, "user-b"),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
