import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { enquiries, products, quotationItems, quotations } from "../db/schema/index.js";

type QueryExecutor = Pick<typeof db, "select" | "insert" | "update">;

export const insertQuotation = async (executor: QueryExecutor, input: typeof quotations.$inferInsert) => {
  const [quotation] = await executor.insert(quotations).values(input).returning();
  return quotation;
};

export const insertQuotationItems = async (executor: QueryExecutor, input: (typeof quotationItems.$inferInsert)[]) => {
  return executor.insert(quotationItems).values(input).returning();
};

export const findQuotationByNumber = async (quotationNumber: string) => {
  const [quotation] = await db.select().from(quotations).where(eq(quotations.quotationNumber, quotationNumber)).limit(1);
  return quotation;
};

export const findQuotationById = async (id: string) => {
  const [quotation] = await db.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  return quotation;
};

export const findQuotationByIdForUpdate = async (executor: QueryExecutor, id: string) => {
  const [quotation] = await executor.select().from(quotations).where(eq(quotations.id, id)).limit(1);
  return quotation;
};

export const listQuotations = async () => {
  return db.select().from(quotations).orderBy(asc(quotations.createdAt), asc(quotations.quotationNumber));
};

export const listQuotationItems = async (quotationId: string) => {
  return db
    .select({
      id: quotationItems.id,
      productId: quotationItems.productId,
      productCode: products.productCode,
      productName: products.productName,
      quantity: quotationItems.quantity,
      unitPrice: quotationItems.unitPrice,
      discountPercent: quotationItems.discountPercent,
      gstPercent: quotationItems.gstPercent,
      baseAmount: quotationItems.baseAmount,
      discountAmount: quotationItems.discountAmount,
      gstAmount: quotationItems.gstAmount,
      lineAmount: quotationItems.lineAmount,
    })
    .from(quotationItems)
    .innerJoin(products, eq(quotationItems.productId, products.id))
    .where(eq(quotationItems.quotationId, quotationId));
};

export const findProductsByIds = async (productIds: string[]) => {
  return db
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(inArray(products.id, productIds));
};

export const updateQuotationStatus = async (executor: QueryExecutor, id: string, status: "SENT" | "ACCEPTED" | "REJECTED") => {
  const [quotation] = await executor.update(quotations).set({ status, updatedAt: new Date() }).where(eq(quotations.id, id)).returning();
  return quotation;
};

export const updateEnquiryStatus = async (executor: QueryExecutor, id: string, status: "QUOTED" | "WON" | "LOST") => {
  const [enquiry] = await executor.update(enquiries).set({ status, updatedAt: new Date() }).where(eq(enquiries.id, id)).returning();
  return enquiry;
};
