import type { Response } from "express"
import { HealthMetric } from "../models/HealthMetric"
import type { AuthRequest } from "../types/auth"

export const addHealthMetric = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, value, unit, additionalData, recordedAt } = req.body

    const healthMetric = new HealthMetric({
      userId: req.userId,
      type,
      value,
      unit,
      additionalData,
      recordedAt: recordedAt || new Date(),
    })

    await healthMetric.save()

    res.status(201).json({
      message: "Health metric added successfully",
      metric: healthMetric,
    })
  } catch (error) {
    console.error("Add health metric error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

export const getHealthMetrics = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { type, startDate, endDate, limit = 50 } = req.query

    const query: any = { userId: req.userId }

    if (type) {
      query.type = type
    }

    if (startDate || endDate) {
      query.recordedAt = {}
      if (startDate) query.recordedAt.$gte = new Date(startDate as string)
      if (endDate) query.recordedAt.$lte = new Date(endDate as string)
    }

    const metrics = await HealthMetric.find(query)
      .sort({ recordedAt: -1 })
      .limit(Number.parseInt(limit as string))

    res.json({ metrics })
  } catch (error) {
    console.error("Get health metrics error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

export const getHealthSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    // Get latest metrics for each type
    const metricTypes = ["weight", "blood_pressure", "heart_rate", "steps", "sleep", "water_intake", "calories"]

    const summary: any = {}

    for (const type of metricTypes) {
      const latestMetric = await HealthMetric.findOne({
        userId: req.userId,
        type,
      }).sort({ recordedAt: -1 })

      if (latestMetric) {
        summary[type] = {
          value: latestMetric.value,
          unit: latestMetric.unit,
          recordedAt: latestMetric.recordedAt,
          additionalData: latestMetric.additionalData,
        }
      }
    }

    res.json({ summary })
  } catch (error) {
    console.error("Get health summary error:", error)
    res.status(500).json({ message: "Server error" })
  }
}

export const deleteHealthMetric = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params

    const metric = await HealthMetric.findOneAndDelete({
      _id: id,
      userId: req.userId,
    })

    if (!metric) {
      res.status(404).json({ message: "Health metric not found" })
      return
    }

    res.json({ message: "Health metric deleted successfully" })
  } catch (error) {
    console.error("Delete health metric error:", error)
    res.status(500).json({ message: "Server error" })
  }
}
