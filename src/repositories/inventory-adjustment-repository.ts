import { db } from "../db/index.js";
import { inventoryAdjustments } from "../db/schema/index.js";

type QueryExecutor = Pick<typeof db, "insert">;

export const insertInventoryAdjustment = async (executor: QueryExecutor, input: typeof inventoryAdjustments.$inferInsert) => {
  const [adjustment] = await executor.insert(inventoryAdjustments).values(input).returning();
  return adjustment;
};