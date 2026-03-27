import { Router } from "express";
import { creditUpdate } from "./iot.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { creditUpdateSchema } from "./iot.schema.js";

const router = Router();

router.post("/credit-update", validateBody(creditUpdateSchema), creditUpdate);

export default router;
