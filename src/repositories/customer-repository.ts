import { eq, ilike, or } from "drizzle-orm";
import { db } from "../db/index.js";
import { customers } from "../db/schema/index.js";

export const createCustomer = async (input: typeof customers.$inferInsert) => {
  const [customer] = await db.insert(customers).values(input).returning();
  return customer;
};

export const listCustomers = async (search?: string) => {
  return db
    .select()
    .from(customers)
    .where(search ? or(ilike(customers.companyName, `%${search}%`), ilike(customers.customerCode, `%${search}%`)) : undefined)
    .orderBy(customers.companyName);
};

export const findCustomerById = async (id: string) => {
  const [customer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);
  return customer;
};
