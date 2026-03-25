import { getMeterByNumber, listMeters } from "./meters.service.js";
import { verifyMeter } from "./vtpass.service.js";

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

const isValidMeterNumber = (value) => /^\d{11}$/.test(value);

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
      message: "Invalid meterNumber format (11 digits required)",
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
    res.json({ success: true, data: response.data, serviceID: "ikeja-electric" });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
