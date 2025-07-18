import express from "express"
import { body } from "express-validator"
import { register, login, getProfile } from "../controllers/authController"
import { auth } from "../middleware/auth"
import { validateRequest } from "../middleware/validateRequest"

const router = express.Router()

// Register
router.post(
  "/register",
  [
    body("email").isEmail().normalizeEmail(),
    body("password").isLength({ min: 6 }),
    body("firstName").trim().isLength({ min: 1 }),
    body("lastName").trim().isLength({ min: 1 }),
  ],
  validateRequest,
  register,
)

// Login
router.post("/login", [body("email").isEmail().normalizeEmail(), body("password").exists()], validateRequest, login)

// Get current user profile
router.get("/profile", auth, getProfile)

export default router
