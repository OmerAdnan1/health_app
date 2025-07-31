import type { Condition } from "../api/healthAPI"

// Utility function to format probability as percentage
export const formatProbability = (probability: number): string => {
  return `${(probability * 100).toFixed(1)}%`
}

// Utility function to get condition urgency level
export const getConditionUrgency = (condition: Condition): "low" | "medium" | "high" | "emergency" => {
  if (condition.details?.severity === "high" || condition.details?.acuteness === "acute") {
    return "emergency"
  }

  if (condition.probability > 0.7) {
    return "high"
  }

  if (condition.probability > 0.4) {
    return "medium"
  }

  return "low"
}

// Utility function to get urgency color
export const getUrgencyColor = (urgency: "low" | "medium" | "high" | "emergency"): string => {
  switch (urgency) {
    case "emergency":
      return "text-red-600 bg-red-100"
    case "high":
      return "text-orange-600 bg-orange-100"
    case "medium":
      return "text-yellow-600 bg-yellow-100"
    case "low":
      return "text-green-600 bg-green-100"
    default:
      return "text-gray-600 bg-gray-100"
  }
}

// Utility function to validate user input
export const validateAge = (age: string): { isValid: boolean; error?: string } => {
  const ageNum = Number.parseInt(age, 10)

  if (isNaN(ageNum)) {
    return { isValid: false, error: "Please enter a valid number" }
  }

  if (ageNum <= 0 || ageNum > 120) {
    return { isValid: false, error: "Please enter an age between 1 and 120" }
  }

  return { isValid: true }
}

// Utility function to validate symptoms description
export const validateSymptoms = (symptoms: string): { isValid: boolean; error?: string } => {
  if (symptoms.trim().length < 10) {
    return { isValid: false, error: "Please provide a more detailed description (at least 10 characters)" }
  }

  return { isValid: true }
}

// Utility function to save assessment to localStorage
export const saveAssessmentToStorage = (assessment: {
  id: string
  timestamp: Date
  conditions: Condition[]
  userAge: number
  userSex: string
  symptoms: string
}) => {
  try {
    const existingAssessments = getAssessmentsFromStorage()
    const updatedAssessments = [assessment, ...existingAssessments.slice(0, 9)] // Keep last 10
    localStorage.setItem("healthAssessments", JSON.stringify(updatedAssessments))
  } catch (error) {
    console.error("Failed to save assessment to storage:", error)
  }
}

// Utility function to get assessments from localStorage
export const getAssessmentsFromStorage = () => {
  try {
    const stored = localStorage.getItem("healthAssessments")
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("Failed to get assessments from storage:", error)
    return []
  }
}

// Utility function to clear assessments from localStorage
export const clearAssessmentsFromStorage = () => {
  try {
    localStorage.removeItem("healthAssessments")
  } catch (error) {
    console.error("Failed to clear assessments from storage:", error)
  }
}

// Utility function to generate assessment summary
export const generateAssessmentSummary = (conditions: Condition[]): string => {
  if (!conditions || conditions.length === 0) {
    return "No specific conditions identified"
  }

  const topCondition = conditions[0]
  const probability = formatProbability(topCondition.probability)

  return `Most likely: ${topCondition.common_name || topCondition.name} (${probability})`
}
