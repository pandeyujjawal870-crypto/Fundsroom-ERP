import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD format.")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Date must be a real calendar date.");

const decimalInput = z.preprocess(
  (value) => (typeof value === "number" ? String(value) : value),
  z.string().regex(/^-?\d+(\.\d+)?$/, "Value must be a valid decimal number."),
);

export const createQuotationSchema = z
  .object({
    quotationNumber: z.string().trim().min(1).max(40).optional(),
    enquiryId: z.string().uuid(),
    validUntil: isoDate,
    items: z
      .array(
        z
          .object({
            productId: z.string().uuid(),
            quantity: decimalInput,
            unitPrice: decimalInput,
            discountPercent: decimalInput,
            gstPercent: decimalInput,
          })
          .strict(),
      )
      .min(1),
    grandTotal: decimalInput.optional(),
  })
  .strict();

export const quotationIdSchema = z.string().uuid();

export const updateQuotationStatusSchema = z
  .object({
    status: z.enum(["SENT", "ACCEPTED", "REJECTED"]),
  })
  .strict();
