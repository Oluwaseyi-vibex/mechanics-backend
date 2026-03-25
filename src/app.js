import express from "express";
import dotenv from "dotenv";
import authRouter from "./modules/auth/auth.routes.js";
import paymentsRouter from "./modules/payments/payments.routes.js";
import metersRouter from "./modules/meters/meters.routes.js";
dotenv.config();

const app = express();

app.use(express.json());

// Routes will be imported here as you build each module
// e.g. app.use('/api/auth', authRouter)
app.get("/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/payments", paymentsRouter);
app.use("/api/meters", metersRouter);

export default app;
