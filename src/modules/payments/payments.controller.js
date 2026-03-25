import {
  createPurchase,
  submitOtp,
  checkStatus,
  getTransactionById,
} from "./payments.service.js";
import { authDataSchema, statusQuerySchema } from "./payments.schema.js";
import { buildAuthData } from "./authdata.service.js";
import { getAccessToken } from "./interswitch.service.js";

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
    if (!transactionId) {
      return res.status(422).json({
        success: false,
        message: "transactionId or paymentId is required for OTP verification",
      });
    }
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
    const responseData = err?.response?.data;
    console.error("Payments: otp verify error", {
      message: err?.message,
      status: err?.response?.status,
      data: responseData,
      dataRaw: responseData ? JSON.stringify(responseData, null, 2) : null,
    });
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
    });
    const authData = buildAuthData({
      ...parsed.data,
      modulusHex,
      exponentHex,
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
