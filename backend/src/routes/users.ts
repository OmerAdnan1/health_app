import express from "express"
import { body } from "express-validator"
import { updateProfile, deleteAccount } from "../controllers/userController"
import { auth } from "../middleware/auth"
import { validateRequest } from "../middleware/validateRequest"

const router = express.Router()

// Update user profile
router.put(
  "/profile",
  auth,
  [
    body("firstName").optional().trim().isLength({ min: 1 }),
    body("lastName").optional().trim().isLength({ min: 1 }),
    body("height")
      .optional()
      .isNumeric()
      .custom((value) => value >= 50 && value <= 300),
    body("weight")
      .optional()
      .isNumeric()
      .custom((value) => value >= 20 && value <= 500),
  ],
  validateRequest,
  updateProfile,
)

// Delete user account
router.delete("/account", auth, deleteAccount)

export default router
