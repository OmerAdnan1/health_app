import express from "express"
import cors from "cors"
import helmet from "helmet"
import dotenv from "dotenv"
import { connectDB } from "./config/database"
import { errorHandler } from "./middleware/errorHandler"
import userRoutes from "./routes/users"
import healthRoutes from "./routes/health"
import infermedicaRoutes from "./apis/infermedica"
// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 5000

// Connect to database
connectDB()

// Middleware
app.use(helmet())
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true }))

// Routes
app.use("/api/users", userRoutes)
app.use("/api/health", healthRoutes)
app.use("/api/infermedica", infermedicaRoutes)
// Health check endpoint
app.get("/api/health-check", (req, res) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  })
})

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
  console.log(`📱 Health check: http://localhost:${PORT}/api/health-check`)
})

export default app
