import type { Request, Response, NextFunction } from "express"

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error("Error:", error)

  // Mongoose validation error
  if (error.name === "ValidationError") {
    res.status(400).json({
      message: "Validation error",
      details: error.message,
    })
    return
  }

  // Mongoose duplicate key error
  if (error.name === "MongoServerError" && (error as any).code === 11000) {
    res.status(400).json({
      message: "Duplicate field value",
      details: "A record with this value already exists",
    })
    return
  }

  // JWT errors
  if (error.name === "JsonWebTokenError") {
    res.status(401).json({
      message: "Invalid token",
    })
    return
  }

  // Default error
  res.status(500).json({
    message: "Internal server error",
    ...(process.env.NODE_ENV === "development" && { details: error.message }),
  })
}
