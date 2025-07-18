import type { Response, NextFunction } from "express"
import jwt from "jsonwebtoken"
import type { AuthRequest } from "../types/auth"

export const auth = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "")

    if (!token) {
      res.status(401).json({ message: "No token provided" })
      return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || "fallback_secret") as { userId: string }
    req.userId = decoded.userId

    next()
  } catch (error) {
    res.status(401).json({ message: "Invalid token" })
  }
}
