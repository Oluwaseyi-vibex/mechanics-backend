import { z } from "zod";

export const validateMeterSchema = z.object({
  meterNumber: z
    .string()
    .regex(/^\d{11,13}$/, "meterNumber must be 11 to 13 digits"),
  disco: z.string().min(3),
  type: z.enum(["prepaid", "postpaid"]),
});
