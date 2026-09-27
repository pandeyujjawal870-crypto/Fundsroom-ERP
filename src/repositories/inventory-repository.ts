import { asc, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { inventory, products } from "../db/schema/index.js";

type QueryExecutor = Pick<typeof db, "select" | "update" | "execute">;

export const listInventoryAvailability = async () => {
  return db
    .select({
      product: {
        id: products.id,
        productCode: products.productCode,
        productName: products.productName,
        category: products.category,
        unit: products.unit,
        basePrice: products.basePrice,
      },
      physicalQuantity: inventory.physicalQuantity,
      reservedQuantity: inventory.reservedQuantity,
    })
    .from(inventory)
    .innerJoin(products, eq(inventory.productId, products.id))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.productName));
};

export type LockedInventoryRow = {
  productId: string;
  productName: string;
  physicalQuantity: string;
  reservedQuantity: string;
};

export const lockInventoryRows = async (executor: QueryExecutor, productIds: string[]) => {
  const ids = sql.join(productIds.map((productId) => sql`${productId}::uuid`), sql`, `);
  const result = await executor.execute(sql`
        SELECT i.product_id AS "productId", p.product_name AS "productName",
          i.physical_quantity AS "physicalQuantity", i.reserved_quantity AS "reservedQuantity"
        FROM inventory i
        INNER JOIN products p ON p.id = i.product_id
        WHERE i.product_id IN (${ids})
        ORDER BY i.product_id
    FOR UPDATE
  `);
  return result.rows as LockedInventoryRow[];
};

export const updateReservedQuantity = async (executor: QueryExecutor, productId: string, reservedQuantity: string, updatedBy: string) => {
  const [row] = await executor
    .update(inventory)
    .set({ reservedQuantity, updatedBy, updatedAt: new Date() })
    .where(inArray(inventory.productId, [productId]))
    .returning();
  return row;
};

export const updateInventoryQuantities = async (
  executor: QueryExecutor,
  productId: string,
  physicalQuantity: string,
  reservedQuantity: string,
  updatedBy: string,
) => {
  const [row] = await executor
    .update(inventory)
    .set({ physicalQuantity, reservedQuantity, updatedBy, updatedAt: new Date() })
    .where(eq(inventory.productId, productId))
    .returning();
  return row;
};

export const updatePhysicalQuantity = async (executor: QueryExecutor, productId: string, physicalQuantity: string, updatedBy: string) => {
  const [row] = await executor
    .update(inventory)
    .set({ physicalQuantity, updatedBy, updatedAt: new Date() })
    .where(eq(inventory.productId, productId))
    .returning();
  return row;
};
