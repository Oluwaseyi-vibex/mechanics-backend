import { getMeterByNumber, listMeters } from "./meters.service.js";
import { verifyMeter } from "./vtpass.service.js";
import prisma from "../../config/prisma.js";

const DISCO_SERVICE_IDS = {
  ikedc: "ikeja-electric",
  ekedc: "eko-electric",
  aedc: "abuja-electric",
  kedco: "kano-electric",
  jed: "jos-electric",
  kaedco: "kaduna-electric",
  eedc: "enugu-electric",
  ibedc: "ibadan-electric",
  bedc: "benin-electric",
  phed: "portharcourt-electric",
  abedc: "aba-electric",
};

const isValidMeterNumber = (value) => /^\d{11}(\d{2})?$/.test(value);

export const getMeters = async (req, res) => {
  try {
    const meters = await listMeters(req.userId);
    res.json({ success: true, data: meters });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const getMeter = async (req, res) => {
  const { meterNumber } = req.params;
  if (!isValidMeterNumber(meterNumber)) {
    return res.status(422).json({
      success: false,
      message: "Invalid meterNumber format (11 or 13 digits required)",
    });
  }

  try {
    const meter = await getMeterByNumber(req.userId, meterNumber);
    if (!meter) {
      return res
        .status(404)
        .json({ success: false, message: "Meter not found" });
    }
    res.json({ success: true, data: meter });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const updateMeterConfig = async (req, res) => {
  const { meterNumber } = req.params;
  if (!isValidMeterNumber(meterNumber)) {
    return res.status(422).json({
      success: false,
      message: "Invalid meterNumber format (11 or 13 digits required)",
    });
  }

  try {
    const meter = await prisma.meter.findFirst({
      where: { meterNumber, userId: req.userId },
    });
    if (!meter) {
      return res
        .status(404)
        .json({ success: false, message: "Meter not found" });
    }

    const updated = await prisma.meter.update({
      where: { id: meter.id },
      data: {
        ...(req.body?.billerCode ? { billerCode: req.body.billerCode } : {}),
        ...(req.body?.paymentCode ? { paymentCode: req.body.paymentCode } : {}),
        ...(req.body?.threshold !== undefined
          ? { threshold: req.body.threshold }
          : {}),
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const applyQaElectricityTestData = async (req, res) => {
  const { meterNumber } = req.params;
  if (!isValidMeterNumber(meterNumber)) {
    return res.status(422).json({
      success: false,
      message: "Invalid meterNumber format (11 or 13 digits required)",
    });
  }

  try {
    const meter = await prisma.meter.findFirst({
      where: { meterNumber, userId: req.userId },
    });
    if (!meter) {
      return res
        .status(404)
        .json({ success: false, message: "Meter not found" });
    }

    const updated = await prisma.meter.update({
      where: { id: meter.id },
      data: {
        meterNumber: "12345678910",
        billerCode: "051758901",
        paymentCode: "051758901",
      },
    });
    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

const resolveServiceId = (input) => {
  if (!input) return null;
  const key = input.toLowerCase();
  if (DISCO_SERVICE_IDS[key]) return DISCO_SERVICE_IDS[key];
  const values = Object.values(DISCO_SERVICE_IDS);
  if (values.includes(input)) return input;
  return null;
};

export const validateMeter = async (req, res) => {
  const { meterNumber, disco, type } = req.body;
  const serviceID = resolveServiceId(disco);

  if (!serviceID) {
    return res.status(422).json({
      success: false,
      message:
        "Invalid disco. Use a known code (ikedc, ekedc, aedc, kedco, jed, kaedco, eedc, ibedc, bedc, phed, abedc) or a VTpass serviceID.",
    });
  }

  try {
    const response = await verifyMeter({
      billersCode: meterNumber,
      serviceID,
      type,
    });
    const code = response?.data?.code;
    const wrongBillersCode =
      response?.data?.content?.WrongBillersCode === true;
    const contentError = response?.data?.content?.error;
    if ((code && code !== "000") || wrongBillersCode || contentError) {
      return res.status(400).json({
        success: false,
        message:
          contentError ||
          response?.data?.content?.errors?.[0]?.message ||
          "Meter validation failed",
        data: response.data,
        serviceID,
      });
    }
    res.json({ success: true, data: response.data, serviceID });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

export const validateIkedcMeter = async (req, res) => {
  const { meterNumber, type } = req.body;
  try {
    const response = await verifyMeter({
      billersCode: meterNumber,
      serviceID: "ikeja-electric",
      type,
    });
    const code = response?.data?.code;
    const wrongBillersCode =
      response?.data?.content?.WrongBillersCode === true;
    const contentError = response?.data?.content?.error;
    if ((code && code !== "000") || wrongBillersCode || contentError) {
      return res.status(400).json({
        success: false,
        message:
          contentError ||
          response?.data?.content?.errors?.[0]?.message ||
          "Meter validation failed",
        data: response.data,
        serviceID: "ikeja-electric",
      });
    }
    res.json({ success: true, data: response.data, serviceID: "ikeja-electric" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
