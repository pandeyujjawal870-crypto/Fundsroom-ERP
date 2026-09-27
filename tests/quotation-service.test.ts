import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../src/db/index.js", () => ({ db: { transaction } }));
vi.mock("../src/repositories/customer-repository.js", () => ({ findCustomerById: vi.fn() }));
vi.mock("../src/repositories/enquiry-repository.js", () => ({ findEnquiryById: vi.fn(), listEnquiryItems: vi.fn() }));
vi.mock("../src/repositories/quotation-repository.js", () => ({
  findProductsByIds: vi.fn(),
  findQuotationByIdForUpdate: vi.fn(),
  findQuotationByNumber: vi.fn(),
  insertQuotation: vi.fn(),
  insertQuotationItems: vi.fn(),
  updateEnquiryStatus: vi.fn(),
  updateQuotationStatus: vi.fn(),
}));

import { findCustomerById } from "../src/repositories/customer-repository.js";
import { findEnquiryById, listEnquiryItems } from "../src/repositories/enquiry-repository.js";
import {
  findProductsByIds,
  findQuotationByIdForUpdate,
  findQuotationByNumber,
  insertQuotation,
  insertQuotationItems,
  updateEnquiryStatus,
  updateQuotationStatus,
} from "../src/repositories/quotation-repository.js";
import { changeQuotationStatus, createQuotation } from "../src/services/quotation-service.js";
import { calculateQuotation } from "../src/utils/quotation-calculator.js";

const enquiryId = "22222222-2222-4222-8222-222222222222";
const customerId = "33333333-3333-4333-8333-333333333333";
const productA = "44444444-4444-4444-8444-444444444444";
const productB = "55555555-5555-4555-8555-555555555555";
const enquiry = { id: enquiryId, customerId, status: "NEW" as const };
const base = {
  quotationNumber: "QUO-0001",
  enquiryId,
  validUntil: "2026-10-31",
  items: [
    { productId: productA, quantity: "10", unitPrice: "500", discountPercent: "10", gstPercent: "18" },
    { productId: productB, quantity: "2", unitPrice: "1000", discountPercent: "0", gstPercent: "0" },
  ],
};

const prepareValid = () => {
  vi.mocked(findEnquiryById).mockResolvedValue(enquiry as never);
  vi.mocked(findCustomerById).mockResolvedValue({ id: customerId } as never);
  vi.mocked(listEnquiryItems).mockResolvedValue([{ productId: productA }, { productId: productB }] as never);
  vi.mocked(findProductsByIds).mockResolvedValue([{ id: productA, isActive: true }, { id: productB, isActive: true }] as never);
  vi.mocked(findQuotationByNumber).mockResolvedValue(undefined);
  vi.mocked(insertQuotation).mockResolvedValue({ id: "66666666-6666-4666-8666-666666666666", status: "DRAFT", enquiryId } as never);
  vi.mocked(insertQuotationItems).mockResolvedValue([{ id: "item-a" }, { id: "item-b" }] as never);
  vi.mocked(updateEnquiryStatus).mockResolvedValue(enquiry as never);
  transaction.mockImplementation(async (callback) => callback({}));
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("quotation calculations", () => {
  it("calculates the case-study example exactly", () => {
    const result = calculateQuotation([{ productId: productA, quantity: "10", unitPrice: "500", discountPercent: "10", gstPercent: "18" }]);
    expect(result.items[0]).toMatchObject({ baseAmount: "5000.00", discountAmount: "500.00", gstAmount: "810.00", lineAmount: "5310.00" });
    expect(result.grandTotal).toBe("5310.00");
  });

  it("ignores an incorrect client grand total", async () => {
    prepareValid();
    const result = await createQuotation({ ...base, grandTotal: "1.00" }, "user-id");
    expect(result.quotation).toEqual(expect.objectContaining({ status: "DRAFT" }));
    expect(insertQuotation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ grandTotal: "7310.00" }));
  });

  it("creates multiple quotation items with a DRAFT status", async () => {
    prepareValid();
    const result = await createQuotation(base, "user-id");
    expect(result.items).toHaveLength(2);
    expect(insertQuotation).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "DRAFT", enquiryId }));
  });

  it.each([
    ["zero quantity", { quantity: "0" }, "INVALID_QUANTITY"],
    ["negative quantity", { quantity: "-1" }, "INVALID_QUANTITY"],
    ["invalid discount", { discountPercent: "101" }, "INVALID_DISCOUNT"],
    ["invalid GST", { gstPercent: "-1" }, "INVALID_GST"],
  ])("rejects %s", async (_label, change, code) => {
    prepareValid();
    const items = [{ ...base.items[0], ...change }, base.items[1]];
    await expect(createQuotation({ ...base, items }, "user-id")).rejects.toMatchObject({ code });
  });

  it("rejects duplicate products", async () => {
    prepareValid();
    await expect(createQuotation({ ...base, items: [base.items[0], { ...base.items[1], productId: productA }] }, "user-id")).rejects.toMatchObject({ code: "DUPLICATE_PRODUCT" });
  });
});

describe("quotation references and transactions", () => {
  it("rejects a missing enquiry", async () => {
    vi.mocked(findEnquiryById).mockResolvedValue(undefined);
    await expect(createQuotation(base, "user-id")).rejects.toMatchObject({ statusCode: 404, code: "ENQUIRY_NOT_FOUND" });
    expect(transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing product", async () => {
    prepareValid();
    vi.mocked(findProductsByIds).mockResolvedValue([{ id: productA, isActive: true }] as never);
    await expect(createQuotation(base, "user-id")).rejects.toMatchObject({ statusCode: 404, code: "PRODUCT_NOT_FOUND" });
  });

  it("rejects a duplicate quotation number", async () => {
    prepareValid();
    vi.mocked(findQuotationByNumber).mockResolvedValue({ id: "existing" } as never);
    await expect(createQuotation(base, "user-id")).rejects.toMatchObject({ statusCode: 409, code: "DUPLICATE_QUOTATION_NUMBER" });
  });

  it("rolls back when quotation item insertion fails", async () => {
    prepareValid();
    vi.mocked(insertQuotationItems).mockRejectedValue(new Error("item insert failed"));
    let rolledBack = false;
    transaction.mockImplementation(async (callback) => {
      try {
        return await callback({});
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    });
    await expect(createQuotation(base, "user-id")).rejects.toThrow("item insert failed");
    expect(rolledBack).toBe(true);
  });
});

describe("quotation status transitions", () => {
  const quotation = { id: "66666666-6666-4666-8666-666666666666", enquiryId, status: "DRAFT" as const };

  it("allows DRAFT to SENT", async () => {
    vi.mocked(findQuotationByIdForUpdate).mockResolvedValue(quotation as never);
    vi.mocked(updateQuotationStatus).mockResolvedValue({ ...quotation, status: "SENT" } as never);
    transaction.mockImplementation(async (callback) => callback({}));
    const result = await changeQuotationStatus(quotation.id, "SENT");
    expect(result?.status).toBe("SENT");
  });

  it("allows SENT to ACCEPTED and updates the enquiry to WON", async () => {
    vi.mocked(findQuotationByIdForUpdate).mockResolvedValue({ ...quotation, status: "SENT" } as never);
    vi.mocked(updateQuotationStatus).mockResolvedValue({ ...quotation, status: "ACCEPTED" } as never);
    transaction.mockImplementation(async (callback) => callback({}));
    await changeQuotationStatus(quotation.id, "ACCEPTED");
    expect(updateEnquiryStatus).toHaveBeenCalledWith(expect.anything(), enquiryId, "WON");
  });

  it("allows SENT to REJECTED and updates the enquiry to LOST", async () => {
    vi.mocked(findQuotationByIdForUpdate).mockResolvedValue({ ...quotation, status: "SENT" } as never);
    vi.mocked(updateQuotationStatus).mockResolvedValue({ ...quotation, status: "REJECTED" } as never);
    transaction.mockImplementation(async (callback) => callback({}));
    await changeQuotationStatus(quotation.id, "REJECTED");
    expect(updateEnquiryStatus).toHaveBeenCalledWith(expect.anything(), enquiryId, "LOST");
  });

  it.each([
    ["DRAFT", "ACCEPTED"],
    ["DRAFT", "REJECTED"],
    ["REJECTED", "ACCEPTED"],
    ["ACCEPTED", "REJECTED"],
  ] as const)("rejects %s to %s", async (from, to) => {
    vi.mocked(findQuotationByIdForUpdate).mockResolvedValue({ ...quotation, status: from } as never);
    transaction.mockImplementation(async (callback) => callback({}));
    await expect(changeQuotationStatus(quotation.id, to)).rejects.toMatchObject({ statusCode: 409, code: "INVALID_STATUS_TRANSITION" });
  });
});
