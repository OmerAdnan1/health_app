"use client"

import { useState, useCallback } from "react"
import { getParseResult, getDiagnosis, askGemini, getGeographicRiskFactors, ExplainRequest, EvidenceItem, getExplainationRes, DiagnosisResponse  } from "../api/healthAPI"
import { v4 as uuidv4 } from "uuid"



// Hook for symptom parsing
export const useSymptomParser = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseSymptoms = useCallback(
    async (
      symptoms: string,
      userAge: number | null,
      userSex: "male" | "female" | null,
      interviewId: string | null,
    ) => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getParseResult(symptoms, userAge, userSex, interviewId)
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to parse symptoms"
        setError(errorMessage)
        throw err
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

  const diagnose = useCallback(
    async (
      evidence: EvidenceItem[],
      userAge: number | null,
      userSex: "male" | "female" | null,
      interviewId: string | null,
    ): Promise<DiagnosisResponse> => {
      setIsLoading(true)
      setError(null)

      try {
        const result = await getDiagnosis(evidence, userAge, userSex, interviewId)
        return result
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to get diagnosis"
        setError(errorMessage)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return { diagnose, isLoading, error }
}

// Hook for Gemini AI
export const useGeminiAI = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const askAI = useCallback(async (prompt: string): Promise<string> => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await askGemini(prompt)
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to get AI response"
      setError(errorMessage)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { askAI, isLoading, error }
}

// Combined hook for complete health workflow
export const useHealthWorkflow = () => {
  const { parseSymptoms, isLoading: isParsingLoading, error: parseError } = useSymptomParser()
  const { diagnose, isLoading: isDiagnosisLoading, error: diagnosisError } = useDiagnosis()
  const { askAI, isLoading: isAILoading, error: aiError } = useGeminiAI()

  const isLoading = isParsingLoading || isDiagnosisLoading || isAILoading
  const error = parseError || diagnosisError || aiError

  return {
    parseSymptoms,
    diagnose,
    askAI,
    getGeographicRiskFactors,
    isLoading,
    error,
  }
}


export const useExplanation = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getExplanation = useCallback(async (explainData: ExplainRequest) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await getExplainationRes(explainData);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get explanation';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    getExplanation,
    isLoading,
    error
  };
};
