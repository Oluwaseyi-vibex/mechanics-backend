import prisma from "../../config/prisma.js";
import {
  purchase as purchaseRequest,
  authorizeOtp,
  getTransactionStatus,
} from "./interswitch.service.js";

const mapResponseToStatus = (code) => {
  if (code === "00") return "SUCCESS";
  if (code === "T0") return "OTP_REQUIRED";
  if (code === "S0") return "THREE_D_SECURE";
  if (!code) return "PENDING";
  return "FAILED";
};

export const createPurchase = async ({
  userId,
  meterNumber,
  amount,
  currency,
  authData,
  transactionRef,
  customerId,
  merchantCode,
}) => {
  console.log("Payments: createPurchase start", {
    userId,
    meterNumber,
    amount,
    currency,
    transactionRef,
    customerId,
  });
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { wallet: true },
  });
  if (!user?.wallet) throw new Error("Wallet not found");

  const meter = await prisma.meter.findFirst({
    where: { meterNumber, userId },
  });
  if (!meter) throw new Error("Meter not found");

  const transaction = await prisma.topupTransaction.create({
    data: {
      meterId: meter.id,
      walletId: user.wallet.id,
      amount,
      status: "INITIATED",
      interswitchRef: transactionRef || null,
    },
  });

  const buildTransactionRef = (base) => `${base}-${Date.now()}`;

  const existingRef = transactionRef
    ? await prisma.topupTransaction.findFirst({
        where: { interswitchRef: transactionRef },
      })
    : null;

  let effectiveRef = transactionRef || transaction.id;
  if (transactionRef && existingRef) {
    effectiveRef = buildTransactionRef(transaction.id);
  }

  const payload = {
    customerId: customerId || user.id,
    amount,
    currency: currency || "NGN",
    authData,
    transactionRef: effectiveRef,
    merchantCode: merchantCode || process.env.MERCHANT_CODE,
  };

  let response;
  try {
    response = await purchaseRequest(payload);
  } catch (err) {
    const errorCode = err?.response?.data?.errors?.[0]?.code;
    if (errorCode === "10409") {
      const retryRef = buildTransactionRef(transaction.id);
      const retryPayload = {
        ...payload,
        transactionRef: retryRef,
      };
      response = await purchaseRequest(retryPayload);
      effectiveRef = retryRef;
    } else {
      throw err;
    }
  }
  const responseCode = response?.data?.responseCode;
  console.log("Payments: purchase response", {
    responseCode,
    interswitchRef:
      response?.data?.transactionRef || response?.data?.paymentId || null,
  });

  const interswitchRef =
    response?.data?.transactionRef ||
    response?.data?.paymentId ||
    transactionRef ||
    transaction.id;

  const status = mapResponseToStatus(responseCode);

  const updated = await prisma.topupTransaction.update({
    where: { id: transaction.id },
    data: {
      status,
      interswitchRef: interswitchRef || effectiveRef,
    },
  });

  return { transaction: updated, meter, interswitch: response.data };
};

export const submitOtp = async ({
  userId,
  paymentId,
  otp,
  transactionId,
  eciFlag,
  topupId,
  transactionRef,
}) => {
  const payload = {
    paymentId,
    otp,
    transactionId,
    ...(eciFlag ? { eciFlag } : {}),
  };

  const response = await authorizeOtp(payload);
  const provider = response?.data || {};

  let updatedTransaction = null;

  if (topupId || transactionRef) {
    const target = await prisma.topupTransaction.findFirst({
      where: {
        ...(topupId ? { id: topupId } : {}),
        ...(transactionRef ? { interswitchRef: transactionRef } : {}),
        wallet: { userId },
      },
    });

    if (target) {
      const status = mapResponseToStatus(provider?.responseCode);
      updatedTransaction = await prisma.topupTransaction.update({
        where: { id: target.id },
        data: {
          status,
          responseCode: provider?.responseCode || null,
          token: provider?.token || null,
          tokenExpiry: provider?.tokenExpiryDate || null,
          transactionId: provider?.transactionIdentifier || null,
          retrievalRef: provider?.retrievalReferenceNumber || null,
          stan: provider?.stan || null,
          terminalId: provider?.terminalId || null,
          bankCode: provider?.bankCode || null,
          cardType: provider?.cardType || null,
        },
      });
    }
  }

  return { provider, transaction: updatedTransaction };
};

export const checkStatus = async ({
  userId,
  transactionreference,
  amount,
}) => {
  const params = {
    merchantcode: process.env.MERCHANT_CODE,
    transactionreference,
    amount,
  };

  const response = await getTransactionStatus(params);
  const responseCode = response?.data?.ResponseCode;
  const status = mapResponseToStatus(responseCode);

  const target = await prisma.topupTransaction.findFirst({
    where: {
      interswitchRef: transactionreference,
      wallet: { userId },
    },
  });

  if (target) {
    await prisma.topupTransaction.update({
      where: { id: target.id },
      data: { status },
    });
  }

  return response.data;
};

export const getTransactionById = async ({ userId, id }) => {
  const transaction = await prisma.topupTransaction.findFirst({
    where: { id, wallet: { userId } },
  });
  if (!transaction) throw new Error("Transaction not found");
  return transaction;
};
