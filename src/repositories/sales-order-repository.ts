import { asc, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { customers, enquiries, products, quotationItems, quotations, salesOrderItems, salesOrders } from "../db/schema/index.js";

type QueryExecutor = Pick<typeof db, "select" | "insert" | "update">;

export const lockQuotationForConversion = async (executor: QueryExecutor, quotationId: string) => {
  // A no-op update acquires PostgreSQL's row lock and returns the current quotation.
  const [quotation] = await executor
    .update(quotations)
    .set({ updatedAt: sql`${quotations.updatedAt}` })
    .where(eq(quotations.id, quotationId))
    .returning();
  return quotation;
};

export const findSalesOrderByQuotationId = async (executor: QueryExecutor, quotationId: string) => {
  const [order] = await executor.select().from(salesOrders).where(eq(salesOrders.quotationId, quotationId)).limit(1);
  return order;
};

export const lockSalesOrderForConfirmation = async (executor: QueryExecutor, salesOrderId: string) => {
  const [order] = await executor
    .update(salesOrders)
    .set({ updatedAt: sql`${salesOrders.updatedAt}` })
    .where(eq(salesOrders.id, salesOrderId))
    .returning();
  return order;
};

export const lockSalesOrderForDispatch = lockSalesOrderForConfirmation;

export const listSalesOrderItemsForExecutor = async (executor: QueryExecutor, salesOrderId: string) => {
  return executor.select().from(salesOrderItems).where(eq(salesOrderItems.salesOrderId, salesOrderId));
};

export const updateSalesOrderConfirmation = async (executor: QueryExecutor, salesOrderId: string, confirmedBy: string) => {
  const [order] = await executor
    .update(salesOrders)
    .set({ status: "CONFIRMED", confirmedBy, confirmedAt: new Date(), updatedAt: new Date() })
    .where(eq(salesOrders.id, salesOrderId))
    .returning();
  return order;
};

export const updateSalesOrderDispatch = async (executor: QueryExecutor, salesOrderId: string) => {
  const [order] = await executor
    .update(salesOrders)
    .set({ status: "DISPATCHED", updatedAt: new Date() })
    .where(eq(salesOrders.id, salesOrderId))
    .returning();
  return order;
};

export const insertSalesOrder = async (executor: QueryExecutor, input: typeof salesOrders.$inferInsert) => {
  const [order] = await executor.insert(salesOrders).values(input).returning();
  return order;
};

export const insertSalesOrderItems = async (executor: QueryExecutor, input: (typeof salesOrderItems.$inferInsert)[]) => {
  return executor.insert(salesOrderItems).values(input).returning();
};

export const findSalesOrderById = async (id: string) => {
  const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id)).limit(1);
  return order;
};

export const listSalesOrders = async () => {
  return db.select().from(salesOrders).orderBy(asc(salesOrders.createdAt), asc(salesOrders.salesOrderNumber));
};

export const listSalesOrderItems = async (salesOrderId: string) => {
  return db
    .select({
      id: salesOrderItems.id,
      productId: salesOrderItems.productId,
      productCode: products.productCode,
      productName: products.productName,
      quantity: salesOrderItems.quantity,
      unitPrice: salesOrderItems.unitPrice,
      discountPercent: salesOrderItems.discountPercent,
      gstPercent: salesOrderItems.gstPercent,
      baseAmount: salesOrderItems.baseAmount,
      discountAmount: salesOrderItems.discountAmount,
      gstAmount: salesOrderItems.gstAmount,
      lineAmount: salesOrderItems.lineAmount,
    })
    .from(salesOrderItems)
    .innerJoin(products, eq(salesOrderItems.productId, products.id))
    .where(eq(salesOrderItems.salesOrderId, salesOrderId));
};

export const findQuotationForExecutor = async (executor: QueryExecutor, quotationId: string) => {
  const [quotation] = await executor.select().from(quotations).where(eq(quotations.id, quotationId)).limit(1);
  return quotation;
};

export const findEnquiryForExecutor = async (executor: QueryExecutor, enquiryId: string) => {
  const [enquiry] = await executor.select().from(enquiries).where(eq(enquiries.id, enquiryId)).limit(1);
  return enquiry;
};

export const findCustomerForExecutor = async (executor: QueryExecutor, customerId: string) => {
  const [customer] = await executor.select().from(customers).where(eq(customers.id, customerId)).limit(1);
  return customer;
};

export const listQuotationItemsForExecutor = async (executor: QueryExecutor, quotationId: string) => {
  return executor.select().from(quotationItems).where(eq(quotationItems.quotationId, quotationId));
};
