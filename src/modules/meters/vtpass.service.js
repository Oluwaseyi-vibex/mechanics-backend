import axios from "axios";

const api = axios.create({
  baseURL: process.env.VTPASS_BASE_URL || "https://sandbox.vtpass.com",
  headers: {
    "Content-Type": "application/json",
    "api-key": process.env.VTPASS_API_KEY,
    "secret-key": process.env.VTPASS_SECRET_KEY,
  },
});

export const verifyMeter = (payload) =>
  api.post("/api/merchant-verify", payload);

export default api;
