import { asc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { enquiries, enquiryItems, products } from "../db/schema/index.js";

type QueryExecutor = Pick<typeof db, "select" | "insert">;

export const insertEnquiry = async (executor: QueryExecutor, input: typeof enquiries.$inferInsert) => {
  const [enquiry] = await executor.insert(enquiries).values(input).returning();
  return enquiry;
};

export const insertEnquiryItems = async (executor: QueryExecutor, input: (typeof enquiryItems.$inferInsert)[]) => {
  return executor.insert(enquiryItems).values(input).returning();
};

export const findEnquiryByNumber = async (enquiryNumber: string) => {
  const [enquiry] = await db.select().from(enquiries).where(eq(enquiries.enquiryNumber, enquiryNumber)).limit(1);
  return enquiry;
};

export const findEnquiryById = async (id: string) => {
  const [enquiry] = await db.select().from(enquiries).where(eq(enquiries.id, id)).limit(1);
  return enquiry;
};

export const listEnquiries = async () => {
  return db.select().from(enquiries).orderBy(asc(enquiries.enquiryDate), asc(enquiries.enquiryNumber));
};

export const listEnquiryItems = async (enquiryId: string) => {
  return db
    .select({
      id: enquiryItems.id,
      productId: enquiryItems.productId,
      productCode: products.productCode,
      productName: products.productName,
      quantity: enquiryItems.quantity,
    })
    .from(enquiryItems)
    .innerJoin(products, eq(enquiryItems.productId, products.id))
    .where(eq(enquiryItems.enquiryId, enquiryId));
};

export const findExistingProducts = async (productIds: string[]) => {
  return db
    .select({ id: products.id, isActive: products.isActive })
    .from(products)
    .where(inArray(products.id, productIds));
};
