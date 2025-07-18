import type { Request, Response } from "express"
import jwt from "jsonwebtoken"
import { User } from "../models/User"
import type { AuthRequest } from "../types/auth"

const generateToken = (userId: string): string => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || "fallback_secret", {
    expiresIn: "7d",
  })
}

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, firstName, lastName } = req.body

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      res.status(400).json({ message: "User already exists with this email" })
      return
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
    })

    await user.save()

    // Generate token
    const token = generateToken(user._id.toString())

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ message: "Server error during registration" })
  }
}

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body

    // Find user
    const user = await User.findOne({ email })
    if (!user) {
      res.status(401).json({ message: "Invalid credentials" })
      return
    }

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" })
      return
    }

    // Generate token
    const token = generateToken(user._id.toString())

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error during login" })
  }
}

export const getProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.userId).select("-password")
    if (!user) {
      res.status(404).json({ message: "User not found" })
      return
    }

    res.json({ user })
  } catch (error) {
    console.error("Get profile error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
