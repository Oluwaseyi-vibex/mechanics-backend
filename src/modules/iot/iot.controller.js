import { handleCreditUpdate } from "./iot.service.js";

export const creditUpdate = async (req, res) => {
  try {
    const result = await handleCreditUpdate(req.body);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};
