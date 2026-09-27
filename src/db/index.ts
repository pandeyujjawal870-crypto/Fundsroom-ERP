import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./client.js";
import * as schema from "./schema/index.js";

export const db = drizzle(pool, { schema });
export type Database = typeof db;
