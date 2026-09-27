import { migrate } from "drizzle-orm/node-postgres/migrator";
import { pool } from "./client.js";
import { db } from "./index.js";

try {
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Database migrations completed successfully.");
} finally {
  await pool.end();
}
