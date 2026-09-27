import { z } from "zod";

export const createCustomerSchema = z.object({
  companyName: z.string().trim().min(1).max(255),
  contactPerson: z.string().trim().min(1).max(150),
  mobile: z.string().trim().min(1).max(30),
  email: z.string().trim().email().max(255),
  city: z.string().trim().min(1).max(120),
}).strict();

export const customerIdSchema = z.string().uuid();
