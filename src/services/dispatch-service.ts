import DecimalModule from "decimal.js";
import { randomUUID } from "node:crypto";
import { db } from "../db/index.js";
import { ApiError } from "../errors/api-error.js";
import { lockInventoryRows, updateInventoryQuantities } from "../repositories/inventory-repository.js";
import { findDispatchBySalesOrderId, insertDispatch, insertDispatchItems } from "../repositories/dispatch-repository.js";
import {
  listSalesOrderItemsForExecutor,
  lockSalesOrderForDispatch,
  updateSalesOrderDispatch,
} from "../repositories/sales-order-repository.js";

type DecimalValue = {
  add(value: DecimalValue | string | number): DecimalValue;
  sub(value: DecimalValue | string | number): DecimalValue;
  lt(value: DecimalValue | string | number): boolean;
  toFixed(decimalPlaces: number): string;
};

type DecimalConstructor = new (value: string | number) => DecimalValue;
const Decimal = DecimalModule as unknown as DecimalConstructor;

type DispatchInput = {
  vehicleNumber: string;
  driverName: string;
};

export const dispatchSalesOrder = async (salesOrderId: string, dispatchedBy: string, input: DispatchInput) => {
  return db.transaction(async (transaction) => {
    const order = await lockSalesOrderForDispatch(transaction, salesOrderId);
    if (!order) throw new ApiError(404, "SALES_ORDER_NOT_FOUND", "Sales Order not found.");
    if (order.status !== "CONFIRMED") {
      throw new ApiError(409, "SALES_ORDER_NOT_CONFIRMED", "Only a confirmed Sales Order can be dispatched.");
    }

    const existingDispatch = await findDispatchBySalesOrderId(transaction, order.id);
    if (existingDispatch) throw new ApiError(409, "DISPATCH_ALREADY_EXISTS", "This Sales Order has already been dispatched.");

    const orderItems = await listSalesOrderItemsForExecutor(transaction, order.id);
    if (orderItems.length === 0) throw new ApiError(422, "SALES_ORDER_HAS_NO_ITEMS", "The Sales Order has no items to dispatch.");

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
      const reserved = new Decimal(inventory.reservedQuantity);
      const physical = new Decimal(inventory.physicalQuantity);
      if (reserved.lt(required)) {
        throw new ApiError(409, "INSUFFICIENT_RESERVED_INVENTORY", `Insufficient reserved inventory for product ${inventory.productName}. Reserved: ${reserved.toFixed(2)}, Required: ${required.toFixed(2)}.`);
      }
      if (physical.lt(required)) {
        throw new ApiError(409, "INSUFFICIENT_PHYSICAL_INVENTORY", `Insufficient physical inventory for product ${inventory.productName}. Physical: ${physical.toFixed(2)}, Required: ${required.toFixed(2)}.`);
      }
    }

    const inventoryChanges = [];
    for (const productId of productIds) {
      const inventory = inventoryByProduct.get(productId)!;
      const required = requiredByProduct.get(productId) ?? new Decimal("0");
      inventoryChanges.push(
        await updateInventoryQuantities(
          transaction,
          productId,
          new Decimal(inventory.physicalQuantity).sub(required).toFixed(2),
          new Decimal(inventory.reservedQuantity).sub(required).toFixed(2),
          dispatchedBy,
        ),
      );
    }

    const dispatch = await insertDispatch(transaction, {
      dispatchNumber: `DSP-${randomUUID()}`,
      salesOrderId: order.id,
      dispatchDate: new Date().toISOString().slice(0, 10),
      vehicleNumber: input.vehicleNumber,
      driverName: input.driverName,
      dispatchedBy,
    });
    if (!dispatch) throw new ApiError(500, "DISPATCH_CREATE_FAILED", "The dispatch could not be created.");

    const dispatchItems = await insertDispatchItems(
      transaction,
      orderItems.map((item) => ({ dispatchId: dispatch.id, productId: item.productId, quantity: item.quantity })),
    );
    const dispatchedOrder = await updateSalesOrderDispatch(transaction, order.id);
    if (!dispatchedOrder) throw new ApiError(500, "DISPATCH_STATUS_UPDATE_FAILED", "The Sales Order could not be marked as dispatched.");

    return { dispatch, dispatchItems, order: dispatchedOrder, inventory: inventoryChanges };
  });
};
