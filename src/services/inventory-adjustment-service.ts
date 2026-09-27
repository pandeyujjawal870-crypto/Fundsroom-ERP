import DecimalModule from "decimal.js";
import { db } from "../db/index.js";
import { ApiError } from "../errors/api-error.js";
import { insertInventoryAdjustment } from "../repositories/inventory-adjustment-repository.js";
import { lockInventoryRows, updatePhysicalQuantity } from "../repositories/inventory-repository.js";

type DecimalValue = {
  add(value: DecimalValue | string | number): DecimalValue;
  sub(value: DecimalValue | string | number): DecimalValue;
  lt(value: DecimalValue | string | number): boolean;
  lte(value: DecimalValue | string | number): boolean;
  eq(value: DecimalValue | string | number): boolean;
  isFinite(): boolean;
  isZero(): boolean;
  toFixed(decimalPlaces: number): string;
};

type DecimalConstructor = new (value: string | number) => DecimalValue;
const Decimal = DecimalModule as unknown as DecimalConstructor;

type AdjustmentInput = {
  adjustmentType: "RECEIVE" | "CORRECTION";
  quantity: string;
  reason: string;
};

export const adjustInventory = async (productId: string, adjustedBy: string, input: AdjustmentInput) => {
  return db.transaction(async (transaction) => {
    const [inventory] = await lockInventoryRows(transaction, [productId]);
    if (!inventory) throw new ApiError(404, "INVENTORY_NOT_FOUND", "Inventory record not found for this product.");

    const delta = new Decimal(input.quantity);
    if (!delta.isFinite()) throw new ApiError(422, "INVALID_ADJUSTMENT_QUANTITY", "Quantity must be finite.");
    if (delta.isZero()) throw new ApiError(422, "INVALID_ADJUSTMENT_QUANTITY", "Adjustment quantity cannot be zero.");
    if (input.adjustmentType === "RECEIVE" && delta.lt(0)) {
      throw new ApiError(422, "INVALID_RECEIPT_QUANTITY", "Received quantity must be greater than zero.");
    }

    const physical = new Decimal(inventory.physicalQuantity);
    const reserved = new Decimal(inventory.reservedQuantity);
    const resultingPhysical = physical.add(delta);
    if (resultingPhysical.lt(0)) {
      throw new ApiError(422, "NEGATIVE_PHYSICAL_QUANTITY", "Physical quantity cannot become negative.");
    }
    if (resultingPhysical.lt(reserved)) {
      throw new ApiError(422, "PHYSICAL_BELOW_RESERVED", "Physical quantity cannot be lower than reserved quantity.");
    }

    const updatedInventory = await updatePhysicalQuantity(transaction, productId, resultingPhysical.toFixed(2), adjustedBy);
    if (!updatedInventory) throw new ApiError(500, "INVENTORY_UPDATE_FAILED", "Inventory could not be updated.");
    const adjustment = await insertInventoryAdjustment(transaction, {
      productId,
      adjustmentType: input.adjustmentType,
      quantityDelta: delta.toFixed(2),
      reason: input.reason,
      adjustedBy,
    });
    if (!adjustment) throw new ApiError(500, "ADJUSTMENT_AUDIT_FAILED", "Inventory adjustment could not be recorded.");

    return {
      inventory: {
        ...updatedInventory,
        availableQuantity: new Decimal(updatedInventory.physicalQuantity).sub(updatedInventory.reservedQuantity).toFixed(2),
      },
      adjustment,
    };
  });
};
