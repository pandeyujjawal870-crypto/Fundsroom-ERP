import { z } from "zod";

export const dispatchRequestSchema = z
  .object({
    vehicleNumber: z.string().trim().min(1).max(50),
    driverName: z.string().trim().min(1).max(150),
  })
  .strict();
