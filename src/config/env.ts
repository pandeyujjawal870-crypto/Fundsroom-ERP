import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().min(1),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
});

export const env = environmentSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN,
  PORT: process.env.PORT,
  NODE_ENV: process.env.NODE_ENV,
  CORS_ORIGIN: process.env.CORS_ORIGIN,
});
