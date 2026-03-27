import { Router } from "express";
import { authenticate } from "../auth/auth.middleware.js";
import {
  getMeter,
  getMeters,
  validateMeter,
  validateIkedcMeter,
  updateMeterConfig,
  applyQaElectricityTestData,
} from "./meters.controller.js";
import { validateBody } from "../../middlewares/validate.middleware.js";
import { validateMeterSchema, updateMeterConfigSchema } from "./meters.schema.js";

const router = Router();

router.get("/", authenticate, getMeters);
router.get("/:meterNumber", authenticate, getMeter);
router.patch(
  "/:meterNumber/config",
  authenticate,
  validateBody(updateMeterConfigSchema),
  updateMeterConfig,
);
router.post(
  "/:meterNumber/apply-qa-electricity",
  authenticate,
  applyQaElectricityTestData,
);
router.post("/validate", authenticate, validateBody(validateMeterSchema), validateMeter);
router.post(
  "/validate/ikedc",
  authenticate,
  validateBody(validateMeterSchema.omit({ disco: true })),
  validateIkedcMeter,
);

export default router;
