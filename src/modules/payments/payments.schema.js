import { z } from "zod";

const amountSchema = z.preprocess(
  (value) => (value === "" || value === null ? value : Number(value)),
  z.number().int().positive(),
);

export const purchaseSchema = z.object({
  meterNumber: z.string().regex(/^\d{11}$/, "meterNumber must be 11 digits"),
  amount: amountSchema,
  currency: z.literal("NGN").default("NGN"),
  authData: z.string().min(10),
  transactionRef: z.string().min(6).optional(),
  customerId: z.string().min(3).optional(),
  merchantCode: z.string().min(3).optional(),
});

export const otpSchema = z.object({
  paymentId: z.string().min(3),
  otp: z.string().min(4).max(8),
  transactionId: z.string().min(3).optional(),
  eciFlag: z.string().min(2).max(2).optional(),
  topupId: z.string().uuid().optional(),
  transactionRef: z.string().min(6).optional(),
});

export const statusQuerySchema = z.object({
  transactionreference: z.string().min(3),
  amount: amountSchema,
});

export const authDataSchema = z.object({
  pan: z.string().regex(/^\d{12,19}$/),
  pin: z.string().regex(/^\d{4}$/),
  expiryYYMM: z.string().regex(/^\d{4}$/),
  cvv2: z.string().regex(/^\d{3,4}$/),
});
