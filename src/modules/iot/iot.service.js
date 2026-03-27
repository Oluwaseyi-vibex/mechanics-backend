import prisma from "../../config/prisma.js";
import { createPurchase } from "../payments/payments.service.js";
import { sendEmail } from "../notifications/email.service.js";

const isPendingStatus = (status) =>
  ["INITIATED", "OTP_REQUIRED", "THREE_D_SECURE"].includes(status);

export const handleCreditUpdate = async ({ meterNumber, creditLevel }) => {
  const meter = await prisma.meter.findUnique({ where: { meterNumber } });
  if (!meter) throw new Error("Meter not found");

  await prisma.meter.update({
    where: { id: meter.id },
    data: { currentCredit: creditLevel },
  });

  const event = await prisma.iotEvent.create({
    data: {
      meterId: meter.id,
      creditLevel,
    },
  });

  let autoTopup = null;
  let autoTopupMeta = null;
  const thresholdReached = Number(creditLevel) <= Number(meter.threshold);
  console.log("IoT: credit update", {
    meterNumber,
    creditLevel,
    threshold: meter.threshold,
    thresholdReached,
    isActive: meter.isActive,
  });
  if (thresholdReached && meter.isActive) {
    const user = await prisma.user.findUnique({
      where: { id: meter.userId },
      include: { wallet: true },
    });

    if (user) {
      console.log("IoT: user settings", {
        userId: user.id,
        hasAuthData: Boolean(user.authData),
        topupAmount: user.topupAmount?.toString?.() || user.topupAmount,
      });
      const pending = await prisma.topupTransaction.findFirst({
        where: {
          walletId: user.wallet?.id,
          status: { in: ["INITIATED", "OTP_REQUIRED", "THREE_D_SECURE"] },
        },
        orderBy: { createdAt: "desc" },
      });

      if (!pending || !isPendingStatus(pending.status)) {
        if (pending) {
          console.log("IoT: pending topup exists", {
            id: pending.id,
            status: pending.status,
          });
        }
        if (!user.authData) {
          throw new Error("User authData not set for auto top-up");
        }
        if (!user.topupAmount || Number(user.topupAmount) <= 0) {
          throw new Error("User topup amount not set for auto top-up");
        }
        try {
          autoTopup = await createPurchase({
            userId: user.id,
            meterNumber,
            amount: Number(user.topupAmount),
            currency: "NGN",
            authData: user.authData,
            customerId: user.email,
          });
          autoTopupMeta = {
            paymentId: autoTopup?.interswitch?.paymentId || null,
            transactionRef: autoTopup?.interswitch?.transactionRef || null,
            responseCode: autoTopup?.interswitch?.responseCode || null,
            message: autoTopup?.interswitch?.message || null,
          };
        } catch (err) {
          const provider = err?.response?.data;
          console.error("IoT: auto topup failed", {
            message: err?.message,
            status: err?.response?.status,
            data: provider,
          });
          return {
            event,
            meter,
            autoTopup: null,
            autoTopupMeta: null,
            autoTopupError: {
              message: err?.message,
              status: err?.response?.status,
              provider,
            },
            thresholdReached,
          };
        }
        if (user.email) {
          try {
            await sendEmail({
              to: user.email,
              subject: "Auto Top-up Triggered",
              text: `Auto top-up triggered for meter ${meterNumber}. Amount: ${user.topupAmount}.`,
              html: `<p>Auto top-up triggered for meter <strong>${meterNumber}</strong>.</p><p><strong>Amount:</strong> ${user.topupAmount}</p>`,
            });
          } catch (err) {
            console.error("IoT: auto topup email failed", {
              message: err?.message,
              status: err?.response?.status,
              data: err?.response?.data,
            });
          }
        }
      }
    }
  }

  return { event, meter, autoTopup, autoTopupMeta, thresholdReached };
};
