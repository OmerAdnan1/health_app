import mongoose, { type Document, Schema } from "mongoose"

export interface IHealthMetric extends Document {
  userId: mongoose.Types.ObjectId
  type: "weight" | "blood_pressure" | "heart_rate" | "steps" | "sleep" | "water_intake" | "calories"
  value: number
  unit: string
  additionalData?: {
    systolic?: number
    diastolic?: number
    duration?: number // for sleep in minutes
    quality?: number // 1-10 scale
  }
  recordedAt: Date
  createdAt: Date
}

const healthMetricSchema = new Schema<IHealthMetric>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      required: true,
      enum: ["weight", "blood_pressure", "heart_rate", "steps", "sleep", "water_intake", "calories"],
    },
    value: {
      type: Number,
      required: true,
    },
    unit: {
      type: String,
      required: true,
    },
    additionalData: {
      systolic: Number,
      diastolic: Number,
      duration: Number,
      quality: Number,
    },
    recordedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Index for efficient queries
healthMetricSchema.index({ userId: 1, type: 1, recordedAt: -1 })

export const HealthMetric = mongoose.model<IHealthMetric>("HealthMetric", healthMetricSchema)
