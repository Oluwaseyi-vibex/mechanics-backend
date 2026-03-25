import { z } from "zod";

export const registerSchema = z.object({
  businessName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(10).max(15),
  password: z.string().min(8),
  meterNumber: z.string().regex(/^\d{11}$/, "meterNumber must be 11 digits"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
