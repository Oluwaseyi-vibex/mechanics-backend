import { z } from "zod";

const creditSchema = z.preprocess(
  (value) => (value === "" || value === null ? value : Number(value)),
  z.number().nonnegative(),
);

export const creditUpdateSchema = z.object({
  meterNumber: z.string().regex(/^\d{11}(\d{2})?$/),
  creditLevel: creditSchema,
});
