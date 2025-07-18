import mongoose, { type Document, Schema } from "mongoose"
import bcrypt from "bcryptjs"

export interface IUser extends Document {
  email: string
  password: string
  firstName: string
  lastName: string
  dateOfBirth?: Date
  gender?: "male" | "female" | "other"
  height?: number // in cm
  weight?: number // in kg
  activityLevel?: "sedentary" | "light" | "moderate" | "active" | "very_active"
  healthGoals?: string[]
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<boolean>
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
    },
    dateOfBirth: {
      type: Date,
    },
    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },
    height: {
      type: Number,
      min: 50,
      max: 300,
    },
    weight: {
      type: Number,
      min: 20,
      max: 500,
    },
    activityLevel: {
      type: String,
      enum: ["sedentary", "light", "moderate", "active", "very_active"],
      default: "moderate",
    },
    healthGoals: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  },
)

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next()

  try {
    const salt = await bcrypt.genSalt(12)
    this.password = await bcrypt.hash(this.password, salt)
    next()
  } catch (error) {
    next(error as Error)
  }
})

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password)
}

export const User = mongoose.model<IUser>("User", userSchema)
