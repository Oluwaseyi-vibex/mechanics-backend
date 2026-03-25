import { Router } from "express";
import { register, login, me } from "./auth.controller.js";
import { authenticate } from "./auth.middleware.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { registerSchema, loginSchema } from "./auth.schema.js";

const router = Router();

router.post("/register", validateBody(registerSchema), register);
router.post("/login", validateBody(loginSchema), login);
router.get("/me", authenticate, me);

export default router;
