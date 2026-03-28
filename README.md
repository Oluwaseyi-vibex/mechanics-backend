# Power as you go

Power as you go by the mechanics is an IoT-enabled electricity credit management backend for smart prepaid meters. It helps small businesses and households avoid unexpected blackouts by tracking meter credit, triggering low-balance events, and initiating automated top-ups through card-backed payments.

Built for hackathon use, the project combines:

- meter registration and account onboarding
- secure authentication with email verification
- card auth data generation and storage
- Interswitch-powered electricity top-up flows
- IoT credit update ingestion
- automatic low-credit top-up logic

## Why This Project Matters

In many communities, users only realize their prepaid electricity credit is low when power is about to go out. Mechanics is designed to reduce that friction by turning meter balance into a proactive workflow:

- the meter reports its current credit
- the backend stores the event
- the system checks whether the credit is below the configured threshold
- if auto top-up is enabled and payment credentials are available, a purchase is triggered automatically

The result is a more reliable and less stressful energy experience.

## Core Features

- User registration, login, and profile retrieval
- Email verification before account access
- Meter registration and meter ownership checks
- Configurable meter threshold and activation state
- IoT credit update endpoint for simulated or real device events
- Automatic top-up trigger when credit falls below threshold
- Interswitch purchase initiation and OTP verification
- Auth data generation and storage for card-backed repeat payments
- Transaction history and transaction status lookup
- Email notifications for key payment and auto-topup events

## How It Works

1. A user registers with their business details and meter number.
2. The user verifies their email and logs in.
3. The user generates or stores card `authData` and sets a preferred top-up amount.
4. An IoT device or frontend sends the current meter credit to `/api/iot/credit-update`.
5. If the reported credit is less than or equal to the meter threshold, the backend attempts an automatic electricity purchase.
6. The payment result and meter event are stored for tracking and follow-up.

## BACKEND Tech Stack

- Node.js
- Express
- Prisma ORM
- PostgreSQL
- Zod
- JWT authentication
- Nodemailer
- Interswitch payment APIs
- VTpass meter validation support

## Interswitch APIs Used

This project currently uses these Interswitch APIs:

- `POST /passport/oauth/token`
  Used to generate the OAuth access token for core purchase operations through the configured `INTERSWITCH_TOKEN_URL`.
- `POST /api/v3/purchases`
  Used to initiate card-backed top-up purchases.
- `POST /api/v3/purchases/otps/auths`
  Used to submit OTP and complete transactions that require additional authentication.
- `GET /collections/api/v1/gettransaction`
  Used to fetch transaction status from Interswitch.
- `POST /passport/oauth/token` for Bills
  Used to generate a separate OAuth access token for the bills vending flow through `INTERSWITCH_BILLS_TOKEN_URL`.
- `POST /quicktellerservice/api/v5/Transactions/validatecustomers`
  Used to validate the electricity customer or meter details before vending.
- `POST /quicktellerservice/api/v5/Transactions`
  Used to vend prepaid electricity units.

Notes:

- `POST /api/payments/auth-data` is a project endpoint, not an Interswitch endpoint.
- Auth data is generated locally in this backend with the configured Interswitch public key values.

## Project Structure

```text
src/
  app.js
  server.js
  config/
    prisma.js
  middlewares/
    validate.middleware.js
  modules/
    auth/
    iot/
    meters/
    notifications/
    payments/
prisma/
  schema.prisma
docs/
  postman.md
```

## Main API Modules

- `auth`: registration, login, email verification, current user
- `payments`: purchase, OTP confirmation, auth data, top-up amount, status lookup
- `meters`: meter validation and meter configuration endpoints
- `iot`: credit update ingestion and auto-topup trigger path

## Database Models

The Prisma schema includes these main entities:

- `User`
- `Wallet`
- `Meter`
- `TopupTransaction`
- `IotEvent`
- `Notification`

This lets the app connect people, meters, payments, and IoT events in one flow.

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root and set at least:

```env
PORT=5000
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DB_NAME
JWT_SECRET=your_jwt_secret
APP_BASE_URL=http://localhost:5000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,https://nimble-sprinkles-0a724c.netlify.app/

SMTP_HOST=your_smtp_host
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_password
SMTP_FROM=your_from_email

INTERSWITCH_BASE_URL=https://qa.interswitchng.com
INTERSWITCH_TOKEN_URL=https://sandbox.interswitchng.com/passport/oauth/token
INTERSWITCH_CLIENT_ID=your_client_id
INTERSWITCH_CLIENT_SECRET=your_client_secret
INTERSWITCH_PUBLIC_MODULUS=your_public_modulus
INTERSWITCH_PUBLIC_EXPONENT=your_public_exponent
INTERSWITCH_TERMINAL_ID=your_terminal_id
INTERSWITCH_BILLS_BASE_URL=https://qa.interswitchng.com/quicktellerservice/api/v5
INTERSWITCH_BILLS_CLIENT_ID=your_bills_client_id
INTERSWITCH_BILLS_CLIENT_SECRET=your_bills_client_secret
INTERSWITCH_BILLS_TOKEN_URL=https://apps.qa.interswitchng.com/passport/oauth/token
INTERSWITCH_BILLS_SCOPE=profile
INTERSWITCH_BILLS_AMOUNT_UNIT=KOBO

VTPASS_BASE_URL=https://sandbox.vtpass.com
VTPASS_API_KEY=your_vtpass_api_key
VTPASS_SECRET_KEY=your_vtpass_secret_key
VTPASS_DEFAULT_DISCO=ikedc
VTPASS_DEFAULT_METER_TYPE=prepaid
```

Notes:

- `DATABASE_URL` must point to a running PostgreSQL instance.
- `CORS_ORIGINS` accepts a comma-separated list of frontend origins allowed to call this API from the browser.
- VTpass support exists in the codebase, but registration-time meter verification is currently disabled temporarily.
- Some payment flows depend on live or sandbox provider credentials.

### 3. Run database migration

```bash
npm run migrate
```

### 4. Start the development server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`.

Health check:

```bash
GET /health
```

## Demo Login Credentials

Judges can use this demo account to log into the application:

- Email: `kodeleyirioluwaseyifunmi@gmail.com`
- Password: `password123`

## Demo Flow

For a demo, this is the simplest story to show:

1. Register a user and meter.
2. Verify the user email.
3. Log in and generate card `authData`.
4. Set a preferred top-up amount.
5. Send a low-credit IoT update with `/api/iot/credit-update`.
6. Show that the backend records the event and attempts an auto-topup when the threshold is reached.

## Example Endpoints

### Register

`POST /api/auth/register`

```json
{
  "businessName": "Demo Ventures",
  "email": "owner@example.com",
  "phone": "08012345678",
  "password": "password123",
  "meterNumber": "12345678901",
  "disco": "ikedc",
  "meterType": "prepaid"
}
```

### Generate Auth Data

`POST /api/payments/auth-data`

```json
{
  "pan": "5060990580000217499",
  "pin": "1111",
  "expiryYYMM": "2004",
  "cvv2": "111"
}
```

### IoT Credit Update

`POST /api/iot/credit-update`

```json
{
  "meterNumber": "12345678901",
  "creditLevel": 10
}
```

When `creditLevel <= threshold`, the backend can trigger auto-topup for an active meter if the user has stored payment credentials and a valid top-up amount.

## Postman

Detailed request examples are documented in [docs/postman.md](/home/thatti/Desktop/workspace/mechanics/docs/postman.md).

## Hackathon Value

Power as you go is a strong project because it demonstrates:

- a real local problem with clear user impact
- IoT event ingestion
- payment automation
- backend workflow orchestration
- practical API design
- database-backed state tracking
- integration with external providers

It is not just a concept deck. It is an executable backend prototype with real transaction, meter, and event flows.

## Future Improvements

- Web or mobile dashboard for businesses and households
- Real hardware meter integration over MQTT or WebSockets
- Smarter top-up recommendations based on usage history
- Wallet funding and ledger support
- Admin analytics and alerting
- Retry queues and webhook-based payment reconciliation
- Richer notification channels such as SMS and WhatsApp
