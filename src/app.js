import express from "express";
import dotenv from "dotenv";
import authRouter from "./modules/auth/auth.routes.js";
import paymentsRouter from "./modules/payments/payments.routes.js";
import metersRouter from "./modules/meters/meters.routes.js";
import iotRouter from "./modules/iot/iot.routes.js";
dotenv.config();

const app = express();
const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const configuredOrigins = (
  process.env.CORS_ORIGINS ||
  process.env.CORS_ORIGIN ||
  process.env.FRONTEND_URL ||
  ""
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins =
  configuredOrigins.length > 0 ? configuredOrigins : defaultAllowedOrigins;

app.use((req, res, next) => {
  const requestOrigin = req.headers.origin;
  const isAllowedOrigin =
    !requestOrigin || allowedOrigins.includes(requestOrigin);

  if (isAllowedOrigin) {
    if (requestOrigin) {
      res.header("Access-Control-Allow-Origin", requestOrigin);
      res.header("Vary", "Origin");
    }

    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
    );
    res.header(
      "Access-Control-Allow-Methods",
      "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    );
    res.header("Access-Control-Allow-Credentials", "true");

    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }

    return next();
  }

  if (requestOrigin) {
    return res.status(403).json({
      message:
        "CORS blocked: this origin is not allowed. Set CORS_ORIGINS to include your frontend URL.",
    });
  }

  return next();
});

app.use(express.json());

// Routes will be imported here as you build each module
// e.g. app.use('/api/auth', authRouter)
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/meters", metersRouter);
app.use("/api/iot", iotRouter);

export default app;
