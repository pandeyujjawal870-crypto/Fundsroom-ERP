import { z } from "zod";

const decimalValue = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z.string().regex(/^-?\d+(\.\d+)?$/, "Quantity must be a valid decimal number."),
);

export const inventoryAdjustmentSchema = z
  .object({
    adjustmentType: z.enum(["RECEIVE", "CORRECTION"]),
    quantity: decimalValue,
    reason: z.string().trim().min(1).max(1000),
  })
  .strict();

export const inventoryProductIdSchema = z.string().uuid();
