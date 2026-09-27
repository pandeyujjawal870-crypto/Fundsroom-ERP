import { sql } from "drizzle-orm";
import { pool } from "./client.js";
import { db } from "./index.js";

try {
  await db.execute(sql`select 1 as database_connection_ok`);
  console.log("PostgreSQL connection verified.");
} finally {
  await pool.end();
}
