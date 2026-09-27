import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock("../src/db/index.js", () => ({ db: { transaction } }));
vi.mock("../src/repositories/inventory-repository.js", () => ({ lockInventoryRows: vi.fn(), updatePhysicalQuantity: vi.fn() }));
vi.mock("../src/repositories/inventory-adjustment-repository.js", () => ({ insertInventoryAdjustment: vi.fn() }));

import { insertInventoryAdjustment } from "../src/repositories/inventory-adjustment-repository.js";
import { lockInventoryRows, updatePhysicalQuantity } from "../src/repositories/inventory-repository.js";
import { adjustInventory } from "../src/services/inventory-adjustment-service.js";

const productId = "11111111-1111-4111-8111-111111111111";
const inventory = { productId, productName: "Product A", physicalQuantity: "100.00", reservedQuantity: "30.00" };
const prepare = () => {
  vi.mocked(lockInventoryRows).mockResolvedValue([inventory]);
  vi.mocked(updatePhysicalQuantity).mockResolvedValue({ ...inventory, physicalQuantity: "150.00" } as never);
  vi.mocked(insertInventoryAdjustment).mockResolvedValue({ id: "adjustment-1" } as never);
  transaction.mockImplementation(async (callback) => callback({}));
};

beforeEach(() => vi.clearAllMocks());

describe("inventory stock adjustments", () => {
  it("allows ADMIN receipt quantities and recalculates availability", async () => {
    prepare();
    const result = await adjustInventory(productId, "admin-id", { adjustmentType: "RECEIVE", quantity: "50", reason: "Goods received" });
    expect(updatePhysicalQuantity).toHaveBeenCalledWith(expect.anything(), productId, "150.00", "admin-id");
    expect(insertInventoryAdjustment).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ adjustmentType: "RECEIVE", quantityDelta: "50.00", reason: "Goods received", adjustedBy: "admin-id" }));
    expect(result.inventory.availableQuantity).toBe("120.00");
  });

  it("allows a correction that remains above reserved stock", async () => {
    prepare();
    vi.mocked(updatePhysicalQuantity).mockResolvedValue({ ...inventory, physicalQuantity: "80.00" } as never);
    await adjustInventory(productId, "admin-id", { adjustmentType: "CORRECTION", quantity: "-20", reason: "Cycle count" });
    expect(updatePhysicalQuantity).toHaveBeenCalledWith(expect.anything(), productId, "80.00", "admin-id");
  });

  it("rejects a RECEIVE adjustment with a negative delta", async () => {
    prepare();
    await expect(adjustInventory(productId, "admin-id", { adjustmentType: "RECEIVE", quantity: "-1", reason: "Invalid receipt" })).rejects.toMatchObject({ code: "INVALID_RECEIPT_QUANTITY" });
    expect(updatePhysicalQuantity).not.toHaveBeenCalled();
  });

  it("rejects negative physical quantity", async () => {
    prepare();
    await expect(adjustInventory(productId, "admin-id", { adjustmentType: "CORRECTION", quantity: "-101", reason: "Invalid correction" })).rejects.toMatchObject({ code: "NEGATIVE_PHYSICAL_QUANTITY" });
    expect(updatePhysicalQuantity).not.toHaveBeenCalled();
  });

  it("rejects physical quantity below reserved quantity", async () => {
    prepare();
    await expect(adjustInventory(productId, "admin-id", { adjustmentType: "CORRECTION", quantity: "-71", reason: "Invalid correction" })).rejects.toMatchObject({ code: "PHYSICAL_BELOW_RESERVED" });
    expect(updatePhysicalQuantity).not.toHaveBeenCalled();
  });

  it("rolls back inventory when the audit record fails", async () => {
    prepare();
    vi.mocked(insertInventoryAdjustment).mockRejectedValue(new Error("audit insert failed"));
    let rolledBack = false;
    transaction.mockImplementation(async (callback) => {
      try { return await callback({}); } catch (error) { rolledBack = true; throw error; }
    });
    await expect(adjustInventory(productId, "admin-id", { adjustmentType: "RECEIVE", quantity: "5", reason: "Goods received" })).rejects.toThrow("audit insert failed");
    expect(rolledBack).toBe(true);
  });
});
