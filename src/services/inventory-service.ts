import DecimalModule from "decimal.js";
import { db } from "../db/index.js";
import { ApiError } from "../errors/api-error.js";
import {
  lockSalesOrderForConfirmation,
  listSalesOrderItemsForExecutor,
  updateSalesOrderConfirmation,
} from "../repositories/sales-order-repository.js";
import { lockInventoryRows, updateReservedQuantity } from "../repositories/inventory-repository.js";

type DecimalValue = {
  add(value: DecimalValue | string | number): DecimalValue;
  sub(value: DecimalValue | string | number): DecimalValue;
  lt(value: DecimalValue | string | number): boolean;
  toFixed(decimalPlaces: number): string;
};

type DecimalConstructor = new (value: string | number) => DecimalValue;
const Decimal = DecimalModule as unknown as DecimalConstructor;

export const confirmSalesOrder = async (salesOrderId: string, confirmedBy: string) => {
  return db.transaction(async (transaction) => {
    const order = await lockSalesOrderForConfirmation(transaction, salesOrderId);
    if (!order) throw new ApiError(404, "SALES_ORDER_NOT_FOUND", "Sales Order not found.");
    if (order.status !== "PENDING") {
      throw new ApiError(409, "SALES_ORDER_NOT_PENDING", "Only a pending Sales Order can be confirmed.");
    }

    const orderItems = await listSalesOrderItemsForExecutor(transaction, order.id);
    if (orderItems.length === 0) throw new ApiError(422, "SALES_ORDER_HAS_NO_ITEMS", "The Sales Order has no items to confirm.");

    const productIds = [...new Set(orderItems.map((item) => item.productId))].sort();
    const inventoryRows = await lockInventoryRows(transaction, productIds);
    const inventoryByProduct = new Map(inventoryRows.map((row) => [row.productId, row]));
    const requiredByProduct = new Map<string, DecimalValue>();

    for (const item of orderItems) {
      const current = requiredByProduct.get(item.productId) ?? new Decimal("0");
      requiredByProduct.set(item.productId, current.add(item.quantity));
    }

    for (const productId of productIds) {
      const inventory = inventoryByProduct.get(productId);
      if (!inventory) throw new ApiError(404, "INVENTORY_NOT_FOUND", `Inventory record not found for product ${productId}.`);

      const required = requiredByProduct.get(productId) ?? new Decimal("0");
      const available = new Decimal(inventory.physicalQuantity).sub(inventory.reservedQuantity);
      if (available.lt(required)) {
        throw new ApiError(409, "INSUFFICIENT_INVENTORY", `Insufficient inventory for product ${inventory.productName}. Available: ${available.toFixed(2)}, Required: ${required.toFixed(2)}.`);
      }
    }

    const reservations = [];
    for (const productId of productIds) {
      const inventory = inventoryByProduct.get(productId);
      const required = requiredByProduct.get(productId) ?? new Decimal("0");
      const reserved = new Decimal(inventory!.reservedQuantity).add(required).toFixed(2);
      reservations.push(await updateReservedQuantity(transaction, productId, reserved, confirmedBy));
    }

    const confirmedOrder = await updateSalesOrderConfirmation(transaction, order.id, confirmedBy);
    if (!confirmedOrder) throw new ApiError(500, "SALES_ORDER_CONFIRM_FAILED", "The Sales Order could not be confirmed.");
    return { order: confirmedOrder, reservations };
  });
};
