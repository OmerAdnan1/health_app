import express from "express"
import { body, query } from "express-validator"
import {
  addHealthMetric,
  getHealthMetrics,
  getHealthSummary,
  deleteHealthMetric,
} from "../controllers/healthController"
import { auth } from "../middleware/auth"
import { validateRequest } from "../middleware/validateRequest"

const router = express.Router()

// Add health metric
router.post(
  "/metrics",
  auth,
  [
    body("type").isIn(["weight", "blood_pressure", "heart_rate", "steps", "sleep", "water_intake", "calories"]),
    body("value").isNumeric(),
    body("unit").isString().trim().isLength({ min: 1 }),
    body("recordedAt").optional().isISO8601(),
  ],
  validateRequest,
  addHealthMetric,
)

// Get health metrics
router.get(
  "/metrics",
  auth,
  [
    query("type")
      .optional()
      .isIn(["weight", "blood_pressure", "heart_rate", "steps", "sleep", "water_intake", "calories"]),
    query("startDate").optional().isISO8601(),
    query("endDate").optional().isISO8601(),
    query("limit").optional().isInt({ min: 1, max: 100 }),
  ],
  validateRequest,
  getHealthMetrics,
)

// Get health summary
router.get("/summary", auth, getHealthSummary)

// Delete health metric
router.delete("/metrics/:id", auth, deleteHealthMetric)

export default router
