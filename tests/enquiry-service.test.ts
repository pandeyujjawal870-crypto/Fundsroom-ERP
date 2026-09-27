import { describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../src/db/index.js", () => ({ db: { transaction } }));
vi.mock("../src/repositories/customer-repository.js", () => ({ findCustomerById: vi.fn() }));
vi.mock("../src/repositories/enquiry-repository.js", () => ({
  findEnquiryByNumber: vi.fn(),
  findExistingProducts: vi.fn(),
  insertEnquiry: vi.fn(),
  insertEnquiryItems: vi.fn(),
}));

import { findCustomerById } from "../src/repositories/customer-repository.js";
import { findEnquiryByNumber, findExistingProducts, insertEnquiry, insertEnquiryItems } from "../src/repositories/enquiry-repository.js";
import { createEnquiry } from "../src/services/enquiry-service.js";

const customerId = "22222222-2222-4222-8222-222222222222";
const productA = "44444444-4444-4444-8444-444444444444";
const productB = "55555555-5555-4555-8555-555555555555";
const base = {
  enquiryNumber: "ENQ-0001",
  customerId,
  enquiryDate: "2026-09-27",
  requiredDate: "2026-10-01",
  items: [{ productId: productA, quantity: 100 }, { productId: productB, quantity: 40 }],
};

const prepareValidLookups = () => {
  vi.mocked(findCustomerById).mockResolvedValue({ id: customerId } as never);
  vi.mocked(findEnquiryByNumber).mockResolvedValue(undefined);
  vi.mocked(findExistingProducts).mockResolvedValue([{ id: productA, isActive: true }, { id: productB, isActive: true }] as never);
};

it("creates a NEW enquiry with multiple items", async () => {
  prepareValidLookups();
  vi.mocked(insertEnquiry).mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" } as never);
  vi.mocked(insertEnquiryItems).mockResolvedValue([{ id: "item-1" }, { id: "item-2" }] as never);
  transaction.mockImplementation(async (callback) => callback({}));
  const result = await createEnquiry(base, "11111111-1111-4111-8111-111111111111");
  expect(result.items).toHaveLength(2);
  expect(insertEnquiry).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: "NEW" }));
});

it("rejects a missing customer", async () => {
  vi.mocked(findCustomerById).mockResolvedValue(undefined);
  await expect(createEnquiry(base, "user-id")).rejects.toMatchObject({ statusCode: 404, code: "CUSTOMER_NOT_FOUND" });
  expect(transaction).not.toHaveBeenCalled();
});

it("rejects a missing product", async () => {
  vi.mocked(findCustomerById).mockResolvedValue({ id: customerId } as never);
  vi.mocked(findEnquiryByNumber).mockResolvedValue(undefined);
  vi.mocked(findExistingProducts).mockResolvedValue([{ id: productA, isActive: true }] as never);
  await expect(createEnquiry(base, "user-id")).rejects.toMatchObject({ statusCode: 404, code: "PRODUCT_NOT_FOUND" });
});

it("rejects zero or negative quantity and duplicate products", async () => {
  await expect(createEnquiry({ ...base, items: [{ productId: productA, quantity: 0 }] }, "user-id")).rejects.toMatchObject({ code: "INVALID_QUANTITY" });
  await expect(createEnquiry({ ...base, items: [{ productId: productA, quantity: 1 }, { productId: productA, quantity: 2 }] }, "user-id")).rejects.toMatchObject({ code: "DUPLICATE_PRODUCT" });
});

it("rejects a required date before the enquiry date", async () => {
  await expect(createEnquiry({ ...base, requiredDate: "2026-09-01" }, "user-id")).rejects.toMatchObject({ code: "INVALID_REQUIRED_DATE" });
});

it("rejects a duplicate enquiry number", async () => {
  vi.mocked(findCustomerById).mockResolvedValue({ id: customerId } as never);
  vi.mocked(findEnquiryByNumber).mockResolvedValue({ id: "existing" } as never);
  vi.mocked(findExistingProducts).mockResolvedValue([]);
  await expect(createEnquiry(base, "user-id")).rejects.toMatchObject({ statusCode: 409, code: "DUPLICATE_ENQUIRY_NUMBER" });
});

it("rolls back when item insertion fails", async () => {
  prepareValidLookups();
  vi.mocked(insertEnquiry).mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" } as never);
  vi.mocked(insertEnquiryItems).mockRejectedValue(new Error("item insert failed"));
  let rolledBack = false;
  transaction.mockImplementation(async (callback) => {
    try {
      return await callback({});
    } catch (error) {
      rolledBack = true;
      throw error;
    }
  });
  await expect(createEnquiry(base, "user-id")).rejects.toThrow("item insert failed");
  expect(rolledBack).toBe(true);
});
