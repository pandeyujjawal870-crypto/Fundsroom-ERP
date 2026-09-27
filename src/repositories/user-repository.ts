import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { users } from "../db/schema/index.js";

export const findUserByEmail = async (email: string) => {
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return user;
};

export const findUserById = async (id: string) => {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user;
};
