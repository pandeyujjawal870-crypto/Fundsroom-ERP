import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { dispatchItems, dispatches } from "../db/schema/index.js";

type QueryExecutor = Pick<typeof db, "select" | "insert">;

export const findDispatchBySalesOrderId = async (executor: QueryExecutor, salesOrderId: string) => {
  const [dispatch] = await executor.select().from(dispatches).where(eq(dispatches.salesOrderId, salesOrderId)).limit(1);
  return dispatch;
};

export const insertDispatch = async (executor: QueryExecutor, input: typeof dispatches.$inferInsert) => {
  const [dispatch] = await executor.insert(dispatches).values(input).returning();
  return dispatch;
};

export const insertDispatchItems = async (executor: QueryExecutor, input: (typeof dispatchItems.$inferInsert)[]) => {
  return executor.insert(dispatchItems).values(input).returning();
};
