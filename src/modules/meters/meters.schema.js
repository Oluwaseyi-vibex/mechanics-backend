import { z } from "zod";

export const validateMeterSchema = z.object({
  meterNumber: z
    .string()
    .regex(/^\d{11}(\d{2})?$/, "meterNumber must be 11 or 13 digits"),
  disco: z.string().min(3),
  type: z.enum(["prepaid", "postpaid"]),
});

export const updateMeterConfigSchema = z.object({
  billerCode: z.string().min(3).optional(),
  paymentCode: z.string().min(3).optional(),
  threshold: z.preprocess(
    (value) => (value === "" || value === null ? value : Number(value)),
    z.number().positive().optional(),
  ),
});
