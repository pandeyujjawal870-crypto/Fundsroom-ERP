import type { Request, Response } from "express";
import { ApiError } from "../errors/api-error.js";
import { listInventoryAvailability } from "../repositories/inventory-repository.js";
import { inventoryAdjustmentSchema, inventoryProductIdSchema } from "../schemas/inventory-schemas.js";
import { adjustInventory } from "../services/inventory-adjustment-service.js";

export const availability = async (_request: Request, response: Response) => {
  const rows = await listInventoryAvailability();
  response.json({
    success: true,
    data: { inventory: rows.map((row) => ({ ...row, availableQuantity: (Number(row.physicalQuantity) - Number(row.reservedQuantity)).toFixed(2) })) },
  });
};

export const adjust = async (request: Request, response: Response) => {
  if (!request.user) throw new ApiError(401, "UNAUTHENTICATED", "Authentication is required.");
  const productId = inventoryProductIdSchema.parse(request.params.productId);
  const input = inventoryAdjustmentSchema.parse(request.body);
  const result = await adjustInventory(productId, request.user.id, input);
  response.json({ success: true, data: result });
};
