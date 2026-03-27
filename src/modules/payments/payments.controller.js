import {
  createPurchase,
  submitOtp,
  checkStatus,
  getAllTransactions,
  getTransactionById,
  markTransactionFailed,
  markTransactionFailedByRef,
} from "./payments.service.js";
import {
  authDataSchema,
  statusQuerySchema,
  storeAuthDataSchema,
  topupAmountSchema,
} from "./payments.schema.js";
import { buildAuthData } from "./authdata.service.js";
import { getAccessToken } from "./interswitch.service.js";
import prisma from "../../config/prisma.js";

export const makePayment = async (req, res) => {
  try {
    console.log("Payments: purchase request", {
      userId: req.userId,
      meterNumber: req.body?.meterNumber,
      amount: req.body?.amount,
      currency: req.body?.currency,
      transactionRef: req.body?.transactionRef,
      hasAuthData: Boolean(req.body?.authData),
    });
    const result = await createPurchase({
      userId: req.userId,
      ...req.body,
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const responseData = err?.response?.data;
    const errorCode = responseData?.errors?.[0]?.code;
    const errorMessage = responseData?.errors?.[0]?.message;

    console.error("Payments: purchase error", {
      message: err?.message,
      status: err?.response?.status,
      data: responseData,
      dataRaw: responseData ? JSON.stringify(responseData, null, 2) : null,
    });

    if (errorCode === "10403" || errorMessage === "CANNOT_GENERATE_OTP") {
      return res.status(400).json({
        success: false,
        code: errorCode,
        message:
          "OTP could not be generated. Use a QA test card that supports OTP/3DS or contact Interswitch for valid QA test card details.",
        provider: responseData,
      });
    }

    res.status(400).json({
      success: false,
      message: err.message,
      provider: responseData,
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const transactionId = req.body?.transactionId || req.body?.paymentId;
    console.log("Payments: otp verify request", {
      userId: req.userId,
      paymentId: req.body?.paymentId,
      transactionId,
      topupId: req.body?.topupId,
      transactionRef: req.body?.transactionRef,
      hasEciFlag: Boolean(req.body?.eciFlag),
    });
    const data = await submitOtp({
      userId: req.userId,
      ...req.body,
      transactionId,
    });
    res.json({ success: true, ...data });
  } catch (err) {
    const responseData = JSON.stringify(err?.response?.data, null, 2);
    const errorCode = responseData?.errors?.[0]?.code;
    console.error("Payments: otp verify error", {
      message: err?.message,
      status: err?.response?.status,
      data: responseData,
      dataRaw: responseData ? responseData : null,
      // JSON.stringify(responseData, null, 2)
    });
    if (errorCode === "06") {
      await markTransactionFailedByRef({
        userId: req.userId,
        interswitchRef: req.body?.transactionRef,
        reason: "OTP_MAX_FAILED",
      });
      return res.status(409).json({
        success: false,
        code: "06",
        message:
          "OTP max failed attempts exceeded. Transaction marked as FAILED. Please start a new payment.",
        provider: responseData,
      });
    }
    if (err?.response?.status === 401) {
      return res.status(401).json({
        success: false,
        message:
          "Bills Payment authorization failed. Check Bills client credentials, terminal ID, and whitelisting.",
        provider: responseData,
      });
    }
    res.status(400).json({ success: false, message: err.message });
  }
};

export const checkTransactionStatus = async (req, res) => {
  const parsed = statusQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    console.log("Payments: status check", {
      userId: req.userId,
      transactionreference: parsed.data.transactionreference,
      amount: parsed.data.amount,
    });
    const data = await checkStatus({
      userId: req.userId,
      ...parsed.data,
    });
    res.json({ success: true, data });
  } catch (err) {
    console.error("Payments: status check error", {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
    });
    res.status(400).json({ success: false, message: err.message });
  }
};

export const generateAuthData = async (req, res) => {
  const parsed = authDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  if (!req.userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  const modulusHex = process.env.INTERSWITCH_PUBLIC_MODULUS;
  const exponentHex = process.env.INTERSWITCH_PUBLIC_EXPONENT;
  if (!modulusHex || !exponentHex) {
    return res.status(500).json({
      success: false,
      message: "Missing Interswitch public key in env",
    });
  }

  try {
    console.log("Payments: auth-data generate", {
      userId: req.userId,
      panLast4: parsed.data.pan?.slice(-4),
      expiryYYMM: parsed.data.expiryYYMM,
      hasPin: Boolean(parsed.data.pin),
    });
    const authData = buildAuthData({
      ...parsed.data,
      modulusHex,
      exponentHex,
    });
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
    });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    await prisma.user.update({
      where: { id: req.userId },
      data: { authData },
    });
    res.json({ success: true, authData });
  } catch (err) {
    console.error("Payments: auth-data error", {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
    });
    res.status(400).json({ success: false, message: err.message });
  }
};
export const generateAccessToken = async (req, res) => {
  try {
    console.log("Payments: access token generate", { userId: req.userId });
    const token = await getAccessToken(true);
    if (!token) {
      return res.status(500).json({
        success: false,
        message: "Failed to generate access token",
      });
    }
    res.json({ success: true, access_token: token });
  } catch (err) {
    console.error("Payments: access token error", {
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
    });
    res.status(400).json({ success: false, message: err.message });
  }
};

export const storeAuthData = async (req, res) => {
  const parsed = storeAuthDataSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const updated = await prisma.user.updateMany({
      where: { id: req.userId },
      data: { authData: parsed.data.authData },
    });
    if (updated.count === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.json({ success: true, message: "Auth data stored" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const setTopupAmount = async (req, res) => {
  const parsed = topupAmountSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(422).json({
      success: false,
      message: "Validation error",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  try {
    const updated = await prisma.user.updateMany({
      where: { id: req.userId },
      data: { topupAmount: parsed.data.amount },
    });
    if (updated.count === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    res.json({ success: true, topupAmount: parsed.data.amount });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getPaymentById = async (req, res) => {
  try {
    const transaction = await getTransactionById({
      userId: req.userId,
      id: req.params.id,
    });
    res.json({ success: true, transaction });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};

export const getPayments = async (req, res) => {
  try {
    const transactions = await getAllTransactions({
      userId: req.userId,
    });
    res.json({ success: true, transactions });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const markFailed = async (req, res) => {
  try {
    const transaction = await markTransactionFailed({
      userId: req.userId,
      id: req.params.id,
      reason: "MANUAL_FAIL",
    });
    res.json({ success: true, transaction });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
};
