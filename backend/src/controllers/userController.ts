import type { Response } from "express"
import { User } from "../models/User"
import type { AuthRequest } from "../types/auth"

export const updateProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const updates = req.body

    // Remove sensitive fields that shouldn't be updated this way
    delete updates.password
    delete updates.email

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true, runValidators: true }).select(
      "-password",
    )

    if (!user) {
      res.status(404).json({ message: "User not found" })
      return
    }

    res.json({
      message: "Profile updated successfully",
      user,
    })
  } catch (error) {
    console.error("Update profile error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

export const deleteAccount = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await User.findByIdAndDelete(req.userId)

    res.json({ message: "Account deleted successfully" })
  } catch (error) {
    console.error("Delete account error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
