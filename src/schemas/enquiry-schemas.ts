import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Date must be a real calendar date.");

export const createEnquirySchema = z
  .object({
    enquiryNumber: z.string().trim().min(1).max(40),
    customerId: z.string().uuid(),
    enquiryDate: isoDate,
    requiredDate: isoDate,
    items: z
      .array(
        z.object({
          productId: z.string().uuid(),
          quantity: z.number().finite(),
        }).strict(),
      )
      .min(1),
    notes: z.string().trim().max(5000).nullable().optional(),
  })
  .strict();

export const enquiryIdSchema = z.string().uuid();
