import prisma from "../../config/prisma.js";
import {
  purchase as purchaseRequest,
  authorizeOtp,
  getTransactionStatus,
} from "./interswitch.service.js";
import { sendEmail } from "../notifications/email.service.js";
import { validateCustomer, vendPrepaid } from "./interswitch.bills.service.js";

const isAmountAllowed = (paidAmount, expectedAmount, amountType) => {
  const paid = Number(paidAmount);
  const expected = Number(expectedAmount);
  if (!Number.isFinite(paid)) return false;
  if (!Number.isFinite(expected) || expected === 0) return true;
  switch (Number(amountType)) {
    case 1: // Minimum
      return paid >= expected;
    case 2: // Greater than Minimum
      return paid > expected;
    case 3: // Maximum
      return paid <= expected;
    case 4: // Less than Maximum
      return paid < expected;
    case 5: // Exact
      return paid === expected;
    case 0: // Any
    default:
      return true;
  }
};

const mapResponseToStatus = (code) => {
  if (code === "00") return "SUCCESS";
  if (code === "T0") return "OTP_REQUIRED";
  if (code === "S0") return "THREE_D_SECURE";
  if (!code) return "PENDING";
  return "FAILED";
};

const isTimeoutError = (err) => {
  const code = String(err?.code || "").toUpperCase();
  const message = String(err?.message || "").toLowerCase();
  return (
    code === "ECONNABORTED" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKETTIMEDOUT" ||
    message.includes("timeout") ||
    message.includes("socket hang up") ||
    message.includes("socket timeout")
  );
};

const extractProviderMeta = (err) => {
  const data = err?.response?.data || {};
  const firstError = Array.isArray(data?.errors) ? data.errors[0] : null;
  return {
    responseCode:
      data?.responseCode ||
      data?.ResponseCode ||
      firstError?.code ||
      firstError?.errorCode ||
      null,
    interswitchRef: data?.transactionRef || data?.paymentId || null,
    paymentId: data?.paymentId || null,
  };
};

const markTopupFailedInternal = async ({ transactionId, fallbackRef, err }) => {
  const meta = extractProviderMeta(err);
  await prisma.topupTransaction.update({
    where: { id: transactionId },
    data: {
      status: "FAILED",
      responseCode: meta.responseCode || "ERROR",
      interswitchRef: meta.interswitchRef || fallbackRef || null,
      ...(meta.paymentId ? { paymentId: meta.paymentId } : {}),
    },
  });
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

  const effectiveAuthData = authData || user.authData;
  if (!effectiveAuthData) {
    throw new Error("Auth data not set for user");
  }

  const payload = {
    customerId: customerId || user.email,
    amount,
    currency: "NGN",
    authData: effectiveAuthData,
    transactionRef: effectiveRef || user.id,
    merchantCode: process.env.MERCHANT_CODE || merchantCode,
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
      try {
        response = await purchaseRequest(retryPayload);
        effectiveRef = retryRef;
      } catch (retryErr) {
        if (isTimeoutError(retryErr)) {
          await prisma.topupTransaction.update({
            where: { id: transaction.id },
            data: { status: "FAILED", responseCode: "TIMEOUT" },
          });
          throw new Error("Connection timeout");
        }
        await markTopupFailedInternal({
          transactionId: transaction.id,
          fallbackRef: retryRef,
          err: retryErr,
        });
        throw retryErr;
      }
    } else if (isTimeoutError(err)) {
      await prisma.topupTransaction.update({
        where: { id: transaction.id },
        data: { status: "FAILED", responseCode: "TIMEOUT" },
      });
      throw new Error("Connection timeout");
    } else {
      await markTopupFailedInternal({
        transactionId: transaction.id,
        fallbackRef: effectiveRef,
        err,
      });
      throw err;
    }
  }
  const responseCode = response?.data?.responseCode;
  console.log("Payments: purchase response", {
    responseCode,
    interswitchRef:
      response?.data?.transactionRef || response?.data?.paymentId || null,
  });

  const paymentId = response?.data?.paymentId || null;
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
      paymentId,
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
  let resolvedPaymentId = paymentId;
  let target = null;

  if (!resolvedPaymentId) {
    if (topupId || transactionRef) {
      target = await prisma.topupTransaction.findFirst({
        where: {
          ...(topupId ? { id: topupId } : {}),
          ...(transactionRef ? { interswitchRef: transactionRef } : {}),
          wallet: { userId },
        },
      });
      resolvedPaymentId = target?.paymentId || null;
    } else {
      target = await prisma.topupTransaction.findFirst({
        where: {
          wallet: { userId },
          status: { in: ["INITIATED", "OTP_REQUIRED", "THREE_D_SECURE"] },
        },
        orderBy: { createdAt: "desc" },
      });
      resolvedPaymentId = target?.paymentId || null;
    }
  }

  if (!resolvedPaymentId) {
    throw new Error("paymentId is required for OTP verification");
  }

  const payload = {
    paymentId: resolvedPaymentId,
    otp,
    transactionId,
    ...(eciFlag ? { eciFlag } : {}),
  };

  const response = await authorizeOtp(payload);
  const provider = response?.data || {};

  let updatedTransaction = null;

  if (topupId || transactionRef || target) {
    if (!target) {
      target = await prisma.topupTransaction.findFirst({
        where: {
          ...(topupId ? { id: topupId } : {}),
          ...(transactionRef ? { interswitchRef: transactionRef } : {}),
          wallet: { userId },
        },
      });
    }

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

      if (provider?.responseCode === "00") {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        const meter = await prisma.meter.findUnique({
          where: { id: target.meterId },
        });

        if (meter?.paymentCode) {
          const requestReference = `${target.id}-${Date.now()}`;

          try {
            const validationResponse = await validateCustomer({
              paymentCode: meter.paymentCode,
              customerId: meter.meterNumber,
            });
            const validationData = validationResponse?.data || {};
            const customer =
              validationData?.Customers?.[0] || validationData?.customers?.[0];
            const responseCode =
              customer?.ResponseCode || validationData?.ResponseCode;
            const grouping =
              validationData?.ResponseCodeGrouping ||
              validationData?.responseCodeGrouping;
            const amountType =
              customer?.AmountType ?? customer?.amountType ?? 0;
            const expectedAmount = customer?.Amount ?? customer?.amount ?? 0;
            updatedTransaction = await prisma.topupTransaction.update({
              where: { id: target.id },
              data: {
                vendResponseCode: responseCode || null,
                vendResponseMessage:
                  validationData?.ResponseCodeGrouping ||
                  validationData?.responseCodeGrouping ||
                  null,
                vendUnits:
                  expectedAmount !== null && expectedAmount !== undefined
                    ? String(expectedAmount)
                    : null,
              },
            });
            console.log("Bills: customer validation ok", {
              paymentCode: meter.paymentCode,
              meterNumber: meter.meterNumber,
              responseCode,
              grouping,
              amountType,
              expectedAmount,
            });
            if (
              responseCode &&
              responseCode !== "90000" &&
              responseCode !== "00"
            ) {
              throw new Error("Customer validation failed");
            }
            if (grouping && String(grouping).toUpperCase() !== "SUCCESSFUL") {
              throw new Error("Customer validation failed");
            }
            const billsAmountUnit = (
              process.env.INTERSWITCH_BILLS_AMOUNT_UNIT || "KOBO"
            ).toUpperCase();
            console.log("Bills: amount check", {
              amountRaw: target.amount,
              amountUnit: billsAmountUnit,
              expectedAmount,
              amountType,
            });
            if (!isAmountAllowed(target.amount, expectedAmount, amountType)) {
              throw new Error(
                "Amount does not meet biller validation requirements",
              );
            }
            console.log("Bills: customer validation ok", {
              paymentCode: meter.paymentCode,
              meterNumber: meter.meterNumber,
            });
          } catch (err) {
            // validation is recommended but not always required to proceed
            console.error("Bills: customer validation failed", {
              message: err?.message,
              status: err?.response?.status,
              data: err?.response?.data,
            });
          }

          let vendResponse;
          try {
            vendResponse = await vendPrepaid({
              paymentCode: meter.paymentCode,
              customerId: meter.meterNumber,
              amount: target.amount,
              customerMobile: user?.phone,
              customerEmail: user?.email,
              requestReference,
            });
            console.log("Bills: vend response", vendResponse?.data || null);
          } catch (err) {
            console.error("Bills: vend failed", {
              message: err?.message,
              status: err?.response?.status,
              data: err?.response?.data,
            });
            throw err;
          }

          const vendData = vendResponse?.data || {};

          updatedTransaction = await prisma.topupTransaction.update({
            where: { id: target.id },
            data: {
              vendToken:
                vendData?.token ||
                vendData?.Token ||
                vendData?.content?.token ||
                null,
              vendUnits:
                vendData?.units ||
                vendData?.Units ||
                vendData?.content?.units ||
                null,
              vendRequestRef:
                vendData?.requestReference || requestReference || null,
              vendResponseCode:
                vendData?.responseCode ||
                vendData?.ResponseCode ||
                vendData?.content?.responseCode ||
                null,
              vendResponseMessage:
                vendData?.responseDescription ||
                vendData?.ResponseDescription ||
                vendData?.content?.responseDescription ||
                vendData?.message ||
                null,
            },
          });

          if (user?.email && updatedTransaction?.vendToken) {
            await sendEmail({
              to: user.email,
              subject: "Energy Top-up Successful",
              text: `Your top-up was successful. Token: ${updatedTransaction.vendToken}.`,
              html: `<p>Your top-up was successful.</p><p><strong>Token:</strong> ${updatedTransaction.vendToken}</p>`,
            });
          }
        }
      }
    }
  }

  return { provider, transaction: updatedTransaction };
};

export const checkStatus = async ({ userId, transactionreference, amount }) => {
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

export const getAllTransactions = async ({ userId }) =>
  prisma.topupTransaction.findMany({
    where: { wallet: { userId } },
    orderBy: { createdAt: "desc" },
  });

export const markTransactionFailed = async ({ userId, id, reason }) => {
  const transaction = await prisma.topupTransaction.findFirst({
    where: { id, wallet: { userId } },
  });
  if (!transaction) throw new Error("Transaction not found");

  const updated = await prisma.topupTransaction.update({
    where: { id: transaction.id },
    data: {
      status: "FAILED",
      responseCode: reason || transaction.responseCode,
    },
  });
  return updated;
};

export const markTransactionFailedByRef = async ({
  userId,
  interswitchRef,
  reason,
}) => {
  if (!interswitchRef) return null;
  const transaction = await prisma.topupTransaction.findFirst({
    where: { interswitchRef, wallet: { userId } },
  });
  if (!transaction) return null;

  return prisma.topupTransaction.update({
    where: { id: transaction.id },
    data: {
      status: "FAILED",
      responseCode: reason || transaction.responseCode,
    },
  });
};
