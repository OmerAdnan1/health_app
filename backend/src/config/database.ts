import mongoose from "mongoose"

export const connectDB = async (): Promise<void> => {
  try {
    const mongoURI = process.env.MONGODB_URI || "mongodb://localhost:27017/health_app"

    await mongoose.connect(mongoURI)

    console.log("✅ MongoDB connected successfully")
  } catch (error) {
    console.error("❌ MongoDB connection error:", error)
    process.exit(1)
  }
}

// Handle connection events
mongoose.connection.on("disconnected", () => {
  console.log("📴 MongoDB disconnected")
})

mongoose.connection.on("error", (error) => {
  console.error("❌ MongoDB error:", error)
})
