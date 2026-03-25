import { Router } from "express";
import {
  makePayment,
  verifyOtp,
  checkTransactionStatus,
  generateAuthData,
  generateAccessToken,
  getPaymentById,
} from "./payments.controller.js";
import { authenticate } from "../auth/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  purchaseSchema,
  otpSchema,
  authDataSchema,
} from "./payments.schema.js";

const router = Router();

router.post(
  "/purchase",
  authenticate,
  validateBody(purchaseSchema),
  makePayment,
);
router.post("/otp", authenticate, validateBody(otpSchema), verifyOtp);
router.get("/status", authenticate, checkTransactionStatus);
router.post(
  "/auth-data",
  authenticate,
  validateBody(authDataSchema),
  generateAuthData,
);
router.post("/token", authenticate, generateAccessToken);
router.get("/:id", authenticate, getPaymentById);

export default router;
