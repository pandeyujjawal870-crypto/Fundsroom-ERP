import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../src/db/index.js", () => ({ db: { transaction } }));
vi.mock("../src/repositories/sales-order-repository.js", () => ({
  lockSalesOrderForDispatch: vi.fn(),
  listSalesOrderItemsForExecutor: vi.fn(),
  updateSalesOrderDispatch: vi.fn(),
}));
vi.mock("../src/repositories/inventory-repository.js", () => ({
  lockInventoryRows: vi.fn(),
  updateInventoryQuantities: vi.fn(),
}));
vi.mock("../src/repositories/dispatch-repository.js", () => ({
  findDispatchBySalesOrderId: vi.fn(),
  insertDispatch: vi.fn(),
  insertDispatchItems: vi.fn(),
}));

import { lockInventoryRows, updateInventoryQuantities } from "../src/repositories/inventory-repository.js";
import { findDispatchBySalesOrderId, insertDispatch, insertDispatchItems } from "../src/repositories/dispatch-repository.js";
import { lockSalesOrderForDispatch, listSalesOrderItemsForExecutor, updateSalesOrderDispatch } from "../src/repositories/sales-order-repository.js";
import { dispatchSalesOrder } from "../src/services/dispatch-service.js";

const orderId = "11111111-1111-4111-8111-111111111111";
const productA = "22222222-2222-4222-8222-222222222222";
const productB = "33333333-3333-4333-8333-333333333333";
const order = { id: orderId, status: "CONFIRMED" as const };
const oneItem = [{ salesOrderId: orderId, productId: productA, quantity: "20.00" }];
const oneInventory = [{ productId: productA, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "40.00" }];
const input = { vehicleNumber: "MH-12-AB-1234", driverName: "Ravi Kumar" };

const prepare = (items = oneItem, inventory = oneInventory) => {
  vi.mocked(lockSalesOrderForDispatch).mockResolvedValue(order as never);
  vi.mocked(listSalesOrderItemsForExecutor).mockResolvedValue(items as never);
  vi.mocked(lockInventoryRows).mockResolvedValue(inventory as never);
  vi.mocked(findDispatchBySalesOrderId).mockResolvedValue(undefined);
  vi.mocked(updateInventoryQuantities).mockResolvedValue({} as never);
  vi.mocked(insertDispatch).mockResolvedValue({ id: "44444444-4444-4444-8444-444444444444" } as never);
  vi.mocked(insertDispatchItems).mockResolvedValue([{ id: "55555555-5555-4555-8555-555555555555" }] as never);
  vi.mocked(updateSalesOrderDispatch).mockResolvedValue({ ...order, status: "DISPATCHED" } as never);
  transaction.mockImplementation(async (callback) => callback({}));
};

beforeEach(() => vi.clearAllMocks());

describe("dispatch workflow", () => {
  it("dispatches a confirmed order and creates a dispatch record", async () => {
    prepare();
    const result = await dispatchSalesOrder(orderId, "admin-id", input);
    expect(result.order.status).toBe("DISPATCHED");
    expect(insertDispatch).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ salesOrderId: orderId, vehicleNumber: input.vehicleNumber, driverName: input.driverName }));
    expect(insertDispatchItems).toHaveBeenCalled();
  });

  it("decreases physical and reserved quantities while preserving availability", async () => {
    prepare();
    await dispatchSalesOrder(orderId, "admin-id", input);
    expect(updateInventoryQuantities).toHaveBeenCalledWith(expect.anything(), productA, "80.00", "20.00", "admin-id");
    expect(100 - 40).toBe(80 - 20);
  });

  it("dispatches multiple products atomically", async () => {
    prepare(
      [{ salesOrderId: orderId, productId: productA, quantity: "20.00" }, { salesOrderId: orderId, productId: productB, quantity: "10.00" }],
      [
        { productId: productB, productName: "Product B", physicalQuantity: "50.00", reservedQuantity: "15.00" },
        { productId: productA, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "40.00" },
      ],
    );
    await dispatchSalesOrder(orderId, "admin-id", input);
    expect(updateInventoryQuantities).toHaveBeenNthCalledWith(1, expect.anything(), productA, "80.00", "20.00", "admin-id");
    expect(updateInventoryQuantities).toHaveBeenNthCalledWith(2, expect.anything(), productB, "40.00", "5.00", "admin-id");
    expect(insertDispatchItems).toHaveBeenCalledWith(expect.anything(), expect.arrayContaining([
      expect.objectContaining({ productId: productA, quantity: "20.00" }),
      expect.objectContaining({ productId: productB, quantity: "10.00" }),
    ]));
  });

  it.each(["PENDING", "DISPATCHED", "CANCELLED"] as const)("rejects %s orders", async (status) => {
    vi.mocked(lockSalesOrderForDispatch).mockResolvedValue({ ...order, status } as never);
    transaction.mockImplementation(async (callback) => callback({}));
    await expect(dispatchSalesOrder(orderId, "admin-id", input)).rejects.toMatchObject({ statusCode: 409, code: "SALES_ORDER_NOT_CONFIRMED" });
    expect(lockInventoryRows).not.toHaveBeenCalled();
  });

  it("rejects an existing dispatch and does not change inventory", async () => {
    prepare();
    vi.mocked(findDispatchBySalesOrderId).mockResolvedValue({ id: "existing-dispatch" } as never);
    await expect(dispatchSalesOrder(orderId, "admin-id", input)).rejects.toMatchObject({ statusCode: 409, code: "DISPATCH_ALREADY_EXISTS" });
    expect(updateInventoryQuantities).not.toHaveBeenCalled();
  });

  it("rejects insufficient reserved quantity", async () => {
    prepare(oneItem, [{ productId: productA, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "10.00" }]);
    await expect(dispatchSalesOrder(orderId, "admin-id", input)).rejects.toMatchObject({ statusCode: 409, code: "INSUFFICIENT_RESERVED_INVENTORY" });
    expect(updateInventoryQuantities).not.toHaveBeenCalled();
  });

  it("never writes negative physical or reserved quantities", async () => {
    prepare(oneItem, [{ productId: productA, productName: "Product A", physicalQuantity: "10.00", reservedQuantity: "5.00" }]);
    await expect(dispatchSalesOrder(orderId, "admin-id", input)).rejects.toMatchObject({ statusCode: 409 });
    expect(updateInventoryQuantities).not.toHaveBeenCalled();
  });

  it("rolls back inventory and order state if dispatch creation fails", async () => {
    prepare();
    vi.mocked(insertDispatch).mockRejectedValue(new Error("dispatch insert failed"));
    let rolledBack = false;
    transaction.mockImplementation(async (callback) => {
      try {
        return await callback({});
      } catch (error) {
        rolledBack = true;
        throw error;
      }
    });
    await expect(dispatchSalesOrder(orderId, "admin-id", input)).rejects.toThrow("dispatch insert failed");
    expect(rolledBack).toBe(true);
    expect(updateSalesOrderDispatch).not.toHaveBeenCalled();
  });

  it("allows only one of two concurrent dispatch attempts", async () => {
    prepare();
    let committed = false;
    vi.mocked(insertDispatch).mockImplementation(async () => {
      if (committed) throw new Error("dispatches_sales_order_id_unique");
      committed = true;
      return { id: "44444444-4444-4444-8444-444444444444" } as never;
    });
    const results = await Promise.allSettled([
      dispatchSalesOrder(orderId, "admin-a", input),
      dispatchSalesOrder(orderId, "admin-b", input),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });
});
