// Utility functions for health-related operations
import type { Condition } from "../api"
import { T } from "some-module" // Assuming T is imported from a module

// Smart stop logic for diagnosis
export interface SmartStopOptions {
  questionCount: number
  maxQuestions: number
  conditions: Condition[]
  apiShouldStop: boolean
  hasQuestion: boolean
  continuePastMax?: boolean
}

export const smartStopLogic = (options: SmartStopOptions): { shouldStop: boolean; reason: string } => {
  const { questionCount, maxQuestions, conditions, apiShouldStop, hasQuestion, continuePastMax = false } = options

  console.log("Smart Stop Analysis:", {
    questionCount,
    apiShouldStop,
    conditionsCount: conditions.length,
    topProbability: conditions[0]?.probability || 0,
    hasQuestion,
  })

  // HIGH CONFIDENCE STOP: If we have a very confident diagnosis
  if (conditions.length > 0) {
    const topCondition = conditions[0]
    const secondCondition = conditions[1]

    // Stop if top condition has very high probability (>85%)
    if (topCondition.probability > 0.85) {
      console.log("🎯 HIGH CONFIDENCE STOP: Top condition >85%", topCondition.probability)
      return { shouldStop: true, reason: "High confidence diagnosis achieved" }
    }

    // Stop if top condition is significantly higher than second (gap >40%)
    if (secondCondition && topCondition.probability - secondCondition.probability > 0.4) {
      console.log("📊 CLEAR LEADER STOP: Large gap between top conditions")
      return { shouldStop: true, reason: "Clear leading condition identified" }
    }

    // Stop if we have good confidence (>70%) AND API suggests stopping
    if (topCondition.probability > 0.7 && apiShouldStop) {
      console.log("✅ GOOD CONFIDENCE + API STOP")
      return { shouldStop: true, reason: "Good confidence with API recommendation" }
    }
  }

  // MINIMUM QUESTIONS: Don't stop before asking at least 3 questions
  if (questionCount < 3) {
    console.log("🔄 CONTINUE: Need minimum 3 questions")
    return { shouldStop: false, reason: "Minimum questions not reached" }
  }

  // API GUIDANCE: Trust API if it strongly suggests stopping after minimum questions
  if (apiShouldStop && questionCount >= 5) {
    console.log("🤖 API GUIDANCE STOP: API suggests stopping after sufficient questions")
    return { shouldStop: true, reason: "API recommendation after sufficient questions" }
  }

  // QUESTION AVAILABILITY: If no more questions available, stop
  if (!hasQuestion) {
    console.log("❓ NO MORE QUESTIONS: Stopping due to lack of questions")
    return { shouldStop: true, reason: "No more questions available" }
  }

  // MAXIMUM QUESTIONS: Show choice to user instead of hard stop
  if (questionCount >= maxQuestions && !continuePastMax) {
    console.log("🔚 MAX QUESTIONS REACHED: Showing user choice")
    return { shouldStop: true, reason: "Maximum questions reached - user choice needed" }
  }

  // EXTENDED MAXIMUM: Hard limit for continued diagnosis (50% higher than original)
  if (continuePastMax && questionCount >= Math.floor(maxQuestions * 1.5)) {
    console.log("🛑 EXTENDED MAX REACHED: Final hard stop")
    return { shouldStop: true, reason: "Extended maximum questions reached" }
  }

  // CONVERGENCE CHECK: If probabilities haven't changed much in recent questions
  if (questionCount >= 6 && conditions.length > 0) {
    const topProbability = conditions[0].probability
    if (topProbability > 0.6) {
      console.log("📈 CONVERGENCE STOP: Stable probabilities with good confidence")
      return { shouldStop: true, reason: "Stable probabilities achieved" }
    }
  }

  console.log("➡️ CONTINUE: No stop conditions met")
  return { shouldStop: false, reason: "Continue diagnosis" }
}

// Format time duration
export const formatDuration = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

// Get severity color
export const getSeverityColor = (severity: number): string => {
  if (severity >= 8) return "text-red-600"
  if (severity >= 6) return "text-orange-600"
  if (severity >= 4) return "text-yellow-600"
  return "text-green-600"
}

// Get confidence color
export const getConfidenceColor = (confidence: number): string => {
  if (confidence >= 85) return "text-green-600"
  if (confidence >= 70) return "text-blue-600"
  if (confidence >= 50) return "text-yellow-600"
  return "text-red-600"
}

// Format condition probability
export const formatProbability = (probability: number): string => {
  return `${(probability * 100).toFixed(1)}%`
}

// Get recommendation urgency
export const getRecommendationUrgency = (
  severity: number,
  probability: number,
  emergencySymptoms: string[],
): "urgent" | "consult" | "monitor" => {
  if (emergencySymptoms.length > 0 || severity >= 8) {
    return "urgent"
  }
  if (severity >= 6 || (probability > 0.8 && severity >= 4)) {
    return "consult"
  }
  return "monitor"
}

// Validate user input
export const validateSymptomInput = (input: string): { isValid: boolean; message?: string } => {
  if (!input.trim()) {
    return { isValid: false, message: "Please describe your symptoms" }
  }
  if (input.trim().length < 10) {
    return { isValid: false, message: "Please provide more detail about your symptoms (at least 10 characters)" }
  }
  if (input.trim().length > 1000) {
    return { isValid: false, message: "Please keep your symptom description under 1000 characters" }
  }
  return { isValid: true }
}

// Validate age input
export const validateAge = (age: string): { isValid: boolean; message?: string; value?: number } => {
  const numAge = Number.parseInt(age, 10)
  if (isNaN(numAge)) {
    return { isValid: false, message: "Please enter a valid age" }
  }
  if (numAge <= 0 || numAge > 120) {
    return { isValid: false, message: "Please enter an age between 1 and 120" }
  }
  return { isValid: true, value: numAge }
}

// Generate unique interview ID
export const generateInterviewId = (): string => {
  return `interview_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Local storage helpers
export const saveToLocalStorage = (key: string, data: any): void => {
  try {
    localStorage.setItem(key, JSON.stringify(data))
  } catch (error) {
    console.error("Failed to save to localStorage:", error)
  }
}

export const getFromLocalStorage = <T>(key: string): T | null => {
  try {\
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : null
  } catch (error) {
    console.error("Failed to get from localStorage:", error)
    return null
  }
}
\
export const removeFromLocalStorage = (key: string): void => {
  try {\
    localStorage.removeItem(key)
  } catch (error) {
    console.error("Failed to remove from localStorage:", error)
  }\
}
