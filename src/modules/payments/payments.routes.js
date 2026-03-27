import { Router } from "express";
import {
  makePayment,
  verifyOtp,
  checkTransactionStatus,
  generateAuthData,
  generateAccessToken,
  getPayments,
  getPaymentById,
  storeAuthData,
  setTopupAmount,
  markFailed,
} from "./payments.controller.js";
import { authenticate } from "../auth/auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import {
  purchaseSchema,
  otpSchema,
  authDataSchema,
  storeAuthDataSchema,
  topupAmountSchema,
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
router.post(
  "/auth-data/store",
  authenticate,
  validateBody(storeAuthDataSchema),
  storeAuthData,
);
router.post(
  "/topup-amount",
  authenticate,
  validateBody(topupAmountSchema),
  setTopupAmount,
);
router.post("/token", authenticate, generateAccessToken);
router.get("/", authenticate, getPayments);
router.get("/:id", authenticate, getPaymentById);
router.post("/:id/mark-failed", authenticate, markFailed);

export default router;
