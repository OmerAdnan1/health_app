"use client"

// Custom React hooks for HealthBuddy API
import { useState, useCallback } from "react"
import { healthAPI, type EvidenceItem, type DiagnosisResponse, type ParseResponse, APIError } from "../api"

// Hook for symptom parsing
export const useSymptomParser = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseSymptoms = useCallback(
    async (
      text: string,
      age: number,
      sex: "male" | "female" | "other",
      interviewId?: string,
    ): Promise<ParseResponse | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await healthAPI.parseSymptoms(text, age, sex, interviewId)
        return result
      } catch (err) {
        const errorMessage = err instanceof APIError ? err.message : "Failed to parse symptoms"
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return { parseSymptoms, isLoading, error }
}

// Hook for diagnosis
export const useDiagnosis = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const getDiagnosis = useCallback(
    async (
      evidence: EvidenceItem[],
      age: number,
      sex: "male" | "female" | "other",
      interviewId: string,
    ): Promise<DiagnosisResponse | null> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await healthAPI.getDiagnosis(evidence, age, sex, interviewId)
        return result
      } catch (err) {
        const errorMessage = err instanceof APIError ? err.message : "Failed to get diagnosis"
        setError(errorMessage)
        return null
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return { getDiagnosis, isLoading, error }
}

// Hook for Gemini AI
export const useGeminiAI = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const askGemini = useCallback(async (prompt: string): Promise<string | null> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await healthAPI.askGemini(prompt)
      return result
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : "Failed to get AI response"
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { askGemini, isLoading, error }
}

// Hook for health assessments management
export const useHealthAssessments = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const saveAssessment = useCallback(async (assessmentData: any) => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await healthAPI.saveHealthAssessment(assessmentData)
      return result
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : "Failed to save assessment"
      setError(errorMessage)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getAssessments = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await healthAPI.getHealthAssessments()
      return result
    } catch (err) {
      const errorMessage = err instanceof APIError ? err.message : "Failed to get assessments"
      setError(errorMessage)
      return []
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { saveAssessment, getAssessments, isLoading, error }
}

// Combined hook for complete health workflow
export const useHealthWorkflow = () => {
  const { parseSymptoms, isLoading: isParsingSymptoms, error: parseError } = useSymptomParser()
  const { getDiagnosis, isLoading: isDiagnosing, error: diagnosisError } = useDiagnosis()
  const { askGemini, isLoading: isAskingGemini, error: geminiError } = useGeminiAI()
  const { saveAssessment, getAssessments, isLoading: isManagingData, error: dataError } = useHealthAssessments()

  const isLoading = isParsingSymptoms || isDiagnosing || isAskingGemini || isManagingData
  const error = parseError || diagnosisError || geminiError || dataError

  return {
    // Methods
    parseSymptoms,
    getDiagnosis,
    askGemini,
    saveAssessment,
    getAssessments,
    // State
    isLoading,
    error,
    // Individual loading states
    isParsingSymptoms,
    isDiagnosing,
    isAskingGemini,
    isManagingData,
  }
}
