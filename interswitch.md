# Interswitch Card Payments API – Node.js (Express) Backend Guide

## Overview

This guide defines how to implement a Node.js (Express) backend that integrates with the Interswitch Card Payments API.

The backend should:

- Generate and use access tokens
- Initiate card payments
- Handle OTP / 3D Secure authentication
- Verify transaction status

---

## Base URLs (Sandbox)

Purchase: https://qa.interswitchng.com/api/v3/purchases

OTP Auth: https://qa.interswitchng.com/api/v3/purchases/otps/auths

Transaction Status: https://qa.interswitchng.com/collections/api/v1/gettransaction

---

## Requirements

- Node.js
- Express
- Axios (for HTTP requests)
- dotenv (for environment variables)

---

## Environment Variables

INTERSWITCH_BASE_URL=https://qa.interswitchng.com

ACCESS_TOKEN=your_access_token
MERCHANT_CODE=your_merchant_code

---

## Project Structure

/project
├── controllers/
│ └── payment.controller.js
├── routes/
│ └── payment.routes.js
├── services/
│ └── interswitch.service.js
├── app.js
├── server.js
└── .env

---

## 1. Purchase Request

### Endpoint (Backend)

POST /api/payments/purchase

### Request Body

```json
{
  "customerId": "12345",
  "amount": 10000,
  "authData": "encrypted_card_data",
  "transactionRef": "unique_ref"
}
Service Logic
Send POST request to /api/v3/purchases
Add header:
Authorization: Bearer <access_token>
Expected Response
{
  "transactionRef": "fhfgrgte",
  "paymentId": "474552283",
  "message": "Enter OTP",
  "amount": "10000.00",
  "responseCode": "T0"
}
2. Handle Authentication
Scenario A: Immediate Authorization
If transaction is successful → proceed to verification
Scenario B: OTP Required (T0)
Endpoint
POST /api/payments/otp
Request Body
{
  "paymentId": "474552283",
  "otp": "123456",
  "transactionId": "transaction_id",
  "eciFlag": "07"
}
Service Call
POST /api/v3/purchases/otps/auths
Success Response
{
  "responseCode": "00",
  "message": "Approved by Financial Institution"
}
Scenario C: 3D Secure (S0)
Redirect user to authentication URL (handled on frontend)
After completion → call authorization endpoint
3. Verify Transaction Status
Endpoint (Backend)
GET /api/payments/status
Query Params
?transactionreference=xxx&amount=10000
Service Call
GET /collections/api/v1/gettransaction
Required Params
merchantcode
transactionreference
amount
Response
{
  "ResponseCode": "00",
  "ResponseDescription": "Approved by Financial Institution"
}
4. Express Route Example
import express from "express";
import {
  makePayment,
  verifyOtp,
  checkStatus
} from "../controllers/payment.controller.js";

const router = express.Router();

router.post("/purchase", makePayment);
router.post("/otp", verifyOtp);
router.get("/status", checkStatus);

export default router;
5. Axios Service Example
import axios from "axios";

const api = axios.create({
  baseURL: process.env.INTERSWITCH_BASE_URL,
  headers: {
    Authorization: `Bearer ${process.env.ACCESS_TOKEN}`,
    "Content-Type": "application/json"
  }
});

export default api;
6. Controller Example
import api from "../services/interswitch.service.js";

export const makePayment = async (req, res) => {
  try {
    const response = await api.post("/api/v3/purchases", req.body);
    res.json(response.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
Flow Summary
Generate access token
Make purchase request
Handle:
Success → Verify
T0 → OTP verification
S0 → 3D Secure
Confirm transaction status
Notes
responseCode = "00" → success
responseCode = "T0" → OTP required
responseCode = "S0" → 3D Secure required
Always verify transaction after payment
Security
Never expose access token on frontend
Encrypt card details before sending (authData)
Ensure PCI DSS compliance
Optional Features
Resend OTP endpoint
Logging transactions
Webhook handling (if available)
End

---

If you want, I can next:
- Generate the **full working backend code (copy-paste ready)**
- Or connect this to your **Opulent Trade / fundraising system payments** 🚀
```
