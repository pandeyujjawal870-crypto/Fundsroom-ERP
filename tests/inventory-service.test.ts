import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../src/db/index.js", () => ({ db: { transaction } }));
vi.mock("../src/repositories/sales-order-repository.js", () => ({
  lockSalesOrderForConfirmation: vi.fn(),
  listSalesOrderItemsForExecutor: vi.fn(),
  updateSalesOrderConfirmation: vi.fn(),
}));
vi.mock("../src/repositories/inventory-repository.js", () => ({
  lockInventoryRows: vi.fn(),
  updateReservedQuantity: vi.fn(),
}));

import {
  lockSalesOrderForConfirmation,
  listSalesOrderItemsForExecutor,
  updateSalesOrderConfirmation,
} from "../src/repositories/sales-order-repository.js";
import { lockInventoryRows, updateReservedQuantity } from "../src/repositories/inventory-repository.js";
import { confirmSalesOrder } from "../src/services/inventory-service.js";

const orderId = "11111111-1111-4111-8111-111111111111";
const productA = "22222222-2222-4222-8222-222222222222";
const productB = "33333333-3333-4333-8333-333333333333";
const order = { id: orderId, status: "PENDING" as const };
const oneItem = [{ salesOrderId: orderId, productId: productA, quantity: "60.00" }];

const prepare = (items = oneItem, rows = [{ productId: productA, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "30.00" }]) => {
  vi.mocked(lockSalesOrderForConfirmation).mockResolvedValue(order as never);
  vi.mocked(listSalesOrderItemsForExecutor).mockResolvedValue(items as never);
  vi.mocked(lockInventoryRows).mockResolvedValue(rows as never);
  vi.mocked(updateReservedQuantity).mockResolvedValue(rows[0] as never);
  vi.mocked(updateSalesOrderConfirmation).mockResolvedValue({ ...order, status: "CONFIRMED" } as never);
  transaction.mockImplementation(async (callback) => callback({}));
};

beforeEach(() => vi.clearAllMocks());

describe("Sales Order confirmation", () => {
  it("confirms a pending order and reserves stock", async () => {
    prepare();
    const result = await confirmSalesOrder(orderId, "admin-id");
    expect(result.order.status).toBe("CONFIRMED");
    expect(updateReservedQuantity).toHaveBeenCalledWith(expect.anything(), productA, "90.00", "admin-id");
    expect(updateSalesOrderConfirmation).toHaveBeenCalled();
  });

  it("does not decrease physical quantity and available becomes 10", async () => {
    prepare();
    await confirmSalesOrder(orderId, "admin-id");
    expect(updateReservedQuantity).toHaveBeenCalledWith(expect.anything(), productA, "90.00", "admin-id");
    expect(updateReservedQuantity).not.toHaveBeenCalledWith(expect.anything(), productA, "40.00", expect.anything());
  });

  it("reserves all products in a multi-product order", async () => {
    prepare(
      [{ salesOrderId: orderId, productId: productA, quantity: "60.00" }, { salesOrderId: orderId, productId: productB, quantity: "20.00" }],
      [
        { productId: productB, productName: "Product B", physicalQuantity: "50.00", reservedQuantity: "5.00" },
        { productId: productA, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "30.00" },
      ],
    );
    await confirmSalesOrder(orderId, "admin-id");
    expect(updateReservedQuantity).toHaveBeenNthCalledWith(1, expect.anything(), productA, "90.00", "admin-id");
    expect(updateReservedQuantity).toHaveBeenNthCalledWith(2, expect.anything(), productB, "25.00", "admin-id");
  });

  it("rejects insufficient stock without partially reserving another product", async () => {
    prepare(
      [{ salesOrderId: orderId, productId: productA, quantity: "80.00" }, { salesOrderId: orderId, productId: productB, quantity: "50.00" }],
      [
        { productId: productA, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "0.00" },
        { productId: productB, productName: "Product B", physicalQuantity: "30.00", reservedQuantity: "0.00" },
      ],
    );
    await expect(confirmSalesOrder(orderId, "admin-id")).rejects.toMatchObject({ statusCode: 409, code: "INSUFFICIENT_INVENTORY" });
    expect(updateReservedQuantity).not.toHaveBeenCalled();
    expect(updateSalesOrderConfirmation).not.toHaveBeenCalled();
  });

  it.each(["CONFIRMED", "DISPATCHED", "CANCELLED"] as const)("rejects %s orders", async (status) => {
    vi.mocked(lockSalesOrderForConfirmation).mockResolvedValue({ ...order, status } as never);
    transaction.mockImplementation(async (callback) => callback({}));
    await expect(confirmSalesOrder(orderId, "admin-id")).rejects.toMatchObject({ statusCode: 409, code: "SALES_ORDER_NOT_PENDING" });
    expect(lockInventoryRows).not.toHaveBeenCalled();
  });

  it("rejects orders with invalid negative inventory state", async () => {
    prepare(oneItem, [{ productId: productA, productName: "Product A", physicalQuantity: "10.00", reservedQuantity: "11.00" }]);
    await expect(confirmSalesOrder(orderId, "admin-id")).rejects.toMatchObject({ code: "INSUFFICIENT_INVENTORY" });
    expect(updateReservedQuantity).not.toHaveBeenCalled();
  });

  it("does not double-reserve on repeated confirmation", async () => {
    vi.mocked(lockSalesOrderForConfirmation).mockResolvedValue({ ...order, status: "CONFIRMED" } as never);
    transaction.mockImplementation(async (callback) => callback({}));
    await expect(confirmSalesOrder(orderId, "admin-id")).rejects.toMatchObject({ code: "SALES_ORDER_NOT_PENDING" });
    expect(updateReservedQuantity).not.toHaveBeenCalled();
  });

  it("rolls back when a later inventory update fails", async () => {
    prepare(
      [{ salesOrderId: orderId, productId: productA, quantity: "10.00" }, { salesOrderId: orderId, productId: productB, quantity: "10.00" }],
      [
        { productId: productA, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "0.00" },
        { productId: productB, productName: "Product B", physicalQuantity: "100.00", reservedQuantity: "0.00" },
      ],
    );
    vi.mocked(updateReservedQuantity).mockResolvedValueOnce({} as never).mockRejectedValueOnce(new Error("reservation update failed"));
    let rolledBack = false;
    transaction.mockImplementation(async (callback) => {
      try {
        return await callback({});
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    });
    await expect(confirmSalesOrder(orderId, "admin-id")).rejects.toThrow("reservation update failed");
    expect(rolledBack).toBe(true);
    expect(updateSalesOrderConfirmation).not.toHaveBeenCalled();
  });

  it("allows only one of two concurrent reservations when combined demand exceeds stock", async () => {
    prepare();
    let committed = false;
    vi.mocked(updateReservedQuantity).mockImplementation(async () => {
      if (committed) throw new Error("inventory row lock prevented oversubscription");
      committed = true;
      return {} as never;
    });
    const results = await Promise.allSettled([confirmSalesOrder(orderId, "admin-a"), confirmSalesOrder(orderId, "admin-b")]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
