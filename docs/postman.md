# Mechanics API – Postman Documentation

This document describes the Postman collection and all available endpoints.

Collection file:
`postman/mechanics-api.postman_collection.json`

## Import
1. Open Postman.
2. Click **Import**.
3. Choose **File** and select `postman/mechanics-api.postman_collection.json`.
4. Click **Import**.

## Collection Variables
- `baseUrl` (default `http://localhost:5000`)
- `token` (set automatically after Login)
- `interswitch_client_id` (for direct Interswitch token call)
- `interswitch_client_secret` (for direct Interswitch token call)
- `interswitch_access_token` (saved automatically after token call)

## Required Server Env
Set these in your `.env` for VTpass validation:
- `VTPASS_BASE_URL` (use `https://sandbox.vtpass.com` or `https://vtpass.com`)
- `VTPASS_API_KEY`
- `VTPASS_SECRET_KEY`

Set these in your `.env` for Interswitch payments:
- `INTERSWITCH_BASE_URL` (e.g., `https://qa.interswitchng.com`)
- `INTERSWITCH_TOKEN_URL` (e.g., `https://sandbox.interswitchng.com/passport/oauth/token`)
- `INTERSWITCH_CLIENT_ID`
- `INTERSWITCH_CLIENT_SECRET`
- `INTERSWITCH_PUBLIC_MODULUS`
- `INTERSWITCH_PUBLIC_EXPONENT`

## Auth
### Register
`POST /api/auth/register`

Body:
```json
{
  "businessName": "Demo Ventures",
  "email": "owner@example.com",
  "phone": "08012345678",
  "password": "password123",
  "meterNumber": "12345678901"
}
```

### Login
`POST /api/auth/login`

Body:
```json
{
  "email": "owner@example.com",
  "password": "password123"
}
```

The collection saves the token from the response automatically.

### Me
`GET /api/auth/me`

Headers:
- `Authorization: Bearer {{token}}`

## Payments (Interswitch)
### Purchase
`POST /api/payments/purchase`

Headers:
- `Authorization: Bearer {{token}}`

Body (meter number must be 11 digits, amount is in kobo). Omit `transactionRef` to auto-generate a unique one:
```json
{
  "meterNumber": "12345678901",
  "amount": 10000,
  "currency": "NGN",
  "authData": "encrypted_card_data_here",
  "transactionRef": "optional_ref_001",
  "customerId": "optional_customer_id",
  "merchantCode": "MX12345"
}
```

Response includes:
- `transaction` (TopupTransaction)
- `meter` (Meter details)
- `interswitch` (provider response)

Postman convenience:
- The collection saves `paymentId`, `transactionRef`, and `amount` into variables:
  - `{{last_payment_id}}`
  - `{{last_transaction_ref}}`
  - `{{last_amount}}`

### OTP Verify
`POST /api/payments/otp`

Headers:
- `Authorization: Bearer {{token}}`

Body:
```json
{
  "paymentId": "{{last_payment_id}}",
  "otp": "123456",
  "transactionId": "{{last_payment_id}}",
  "eciFlag": "07",
  "transactionRef": "{{last_transaction_ref}}"
}
```

Notes:
- If you still get `10400`, try **omitting `eciFlag`** or set `transactionId` to `{{last_transaction_ref}}` for your QA card type.

### Get Transaction By ID
`GET /api/payments/:id`

Headers:
- `Authorization: Bearer {{token}}`

Example:
```
{{baseUrl}}/api/payments/{{last_transaction_ref}}
```

### Transaction Status
`GET /api/payments/status`

Headers:
- `Authorization: Bearer {{token}}`

Query params:
- `transactionreference`
- `amount`

Example:
```
{{baseUrl}}/api/payments/status?transactionreference={{last_transaction_ref}}&amount={{last_amount}}
```

### Generate Auth Data
`POST /api/payments/auth-data`

Headers:
- `Authorization: Bearer {{token}}`

Body:
```json
{
  "pan": "5060990580000217499",
  "pin": "1111",
  "expiryYYMM": "2004",
  "cvv2": "111"
}
```

Notes:
- This endpoint generates `authData` using your Interswitch public key.

### Generate Access Token
`POST /api/payments/token`

Headers:
- `Authorization: Bearer {{token}}`

Notes:
- This returns the current Interswitch access token generated via `client_credentials`.

### Interswitch Token (Direct)
`POST https://sandbox.interswitchng.com/passport/oauth/token?grant_type=client_credentials`

Auth:
- Postman **Basic Auth**
  - Username: `{{interswitch_client_id}}`
  - Password: `{{interswitch_client_secret}}`

Headers:
- `Content-Type: application/x-www-form-urlencoded`

Body (x-www-form-urlencoded):
- `grant_type = client_credentials`

Notes:
- The response `access_token` is saved to `{{interswitch_access_token}}` by the collection test script.

## Meters
### List Meters
`GET /api/meters`

Headers:
- `Authorization: Bearer {{token}}`

### Get Meter By Number
`GET /api/meters/:meterNumber`

Headers:
- `Authorization: Bearer {{token}}`

Example:
```
{{baseUrl}}/api/meters/12345678901
```

### Validate Meter (VTpass – all DisCos)
`POST /api/meters/validate`

Headers:
- `Authorization: Bearer {{token}}`

Body:
```json
{
  "meterNumber": "1111111111111",
  "disco": "ikedc",
  "type": "prepaid"
}
```

Notes:
- `disco` can be a short code (`ikedc`, `ekedc`, `aedc`, `kedco`, `jed`, `kaedco`, `eedc`, `ibedc`, `bedc`, `phed`, `abedc`) or a VTpass `serviceID`.
- VTpass sandbox uses 13-digit test meters:
  - prepaid: `1111111111111`
  - postpaid: `1010101010101`

### Validate IKEDC Meter (VTpass)
`POST /api/meters/validate/ikedc`

Headers:
- `Authorization: Bearer {{token}}`

Body:
```json
{
  "meterNumber": "1111111111111",
  "type": "prepaid"
}
```

Notes:
- This endpoint always uses `serviceID: ikeja-electric`.
