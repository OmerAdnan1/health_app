// Centralized API service for HealthBuddy
import { v4 as uuidv4 } from "uuid"

// Base configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001"

// Types
export interface EvidenceItem {
  id: string
  choice_id: "present" | "absent" | "unknown"
  source?: "initial" | "suggest" | "predefined" | "red_flags"
}

export interface Condition {
  id: string
  name: string
  common_name: string
  probability: number
  details?: {
    description?: string
    severity?: string
    category?: string
    treatment_description?: string
    icd10?: string
    acuteness?: string
    prevalence?: string
  }
}

export interface InfermedicaChoice {
  id: "present" | "absent" | "unknown"
  label: string
}

export interface InfermedicaQuestionItem {
  id: string
  name: string
  choices: InfermedicaChoice[]
}

export interface InfermedicaQuestion {
  type: "single" | "group_single" | "group_multiple"
  text: string
  items: InfermedicaQuestionItem[]
}

export interface DiagnosisResponse {
  question?: InfermedicaQuestion
  conditions: Condition[]
  should_stop: boolean
  evidence?: EvidenceItem[]
  reasoning?: string[]
}

export interface ParseResponse {
  mentions: Array<{
    id: string
    choice_id: "present" | "absent" | "unknown"
    relevance?: number
  }>
}

export interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string
      }>
    }
  }>
}

// Error handling
export class APIError extends Error {
  constructor(
    message: string,
    public status?: number,
    public response?: any,
  ) {
    super(message)
    this.name = "APIError"
  }
}

// Helper function to safely parse API responses
const parseJsonResponse = async (response: Response) => {
  try {
    const text = await response.text()
    if (!response.ok) {
      try {
        const errorData = JSON.parse(text)
        throw new APIError(
          errorData.message || `API error: ${response.status} ${response.statusText}`,
          response.status,
          errorData,
        )
      } catch (jsonError) {
        throw new APIError(
          `API error: ${response.status} ${response.statusText}${text ? `: ${text}` : ""}`,
          response.status,
        )
      }
    }
    return text ? JSON.parse(text) : {}
  } catch (error) {
    if (error instanceof APIError) {
      throw error
    }
    console.error("Error parsing JSON response:", error)
    throw new APIError("Failed to parse API response")
  }
}

// API Service Class
export class HealthBuddyAPI {
  private baseUrl: string
  private defaultHeaders: Record<string, string>

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl
    this.defaultHeaders = {
      "Content-Type": "application/json",
    }
  }

  // Generic request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    additionalHeaders: Record<string, string> = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    const headers = {
      ...this.defaultHeaders,
      ...additionalHeaders,
      ...options.headers,
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

      return await parseJsonResponse(response)
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error)
      throw error
    }
  }

  // Infermedica API methods
  async parseSymptoms(
    text: string,
    age: number,
    sex: "male" | "female" | "other",
    interviewId?: string,
  ): Promise<ParseResponse> {
    const finalInterviewId = interviewId || uuidv4()

    const payload = {
      "age.value": age,
      "age.unit": "year",
      sex,
      text: text.trim().replace(/\s+/g, " ").toLowerCase(),
      context: [],
      include_tokens: true,
      correct_spelling: true,
      concept_types: ["symptom", "risk_factor"],
      interviewId: finalInterviewId,
    }

    const response = await this.request<ParseResponse>(
      "/api/infermedica/parse",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      {
        "Interview-Id": finalInterviewId,
      },
    )

    // Filter out low-relevance mentions
    if (response.mentions) {
      response.mentions = response.mentions.filter((m) => {
        return m.relevance ? m.relevance > 0.4 : true
      })
    }

    return response
  }

  async getDiagnosis(
    evidence: EvidenceItem[],
    age: number,
    sex: "male" | "female" | "other",
    interviewId: string,
  ): Promise<DiagnosisResponse> {
    if (!interviewId) {
      throw new APIError("Interview ID is required for diagnosis")
    }

    // Deduplicate evidence
    const uniqueEvidenceMap = new Map<string, EvidenceItem>()
    evidence.forEach((item) => {
      if (!uniqueEvidenceMap.has(item.id)) {
        uniqueEvidenceMap.set(item.id, item)
      }
    })
    const dedupedEvidence = Array.from(uniqueEvidenceMap.values())

    // Normalize evidence according to Infermedica API
    const normalizedEvidence = dedupedEvidence.map((item) => ({
      ...item,
      ...(item.source && { source: item.source }),
    }))

    const payload = {
      age: { value: age, unit: "year" },
      sex,
      evidence: normalizedEvidence,
      evaluated_at: new Date().toISOString().split("T")[0],
      extras: {
        enable_triage_advanced_mode: true,
        enable_conditions_details: true,
        enable_evidence_details: true,
      },
    }

    return await this.request<DiagnosisResponse>(
      "/api/infermedica/diagnosis",
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
      {
        "Interview-Id": interviewId,
      },
    )
  }

  // Gemini AI methods
  async askGemini(prompt: string): Promise<string> {
    const response = await this.request<GeminiResponse>("/api/gemini", {
      method: "POST",
      body: JSON.stringify({ prompt }),
    })

    return response.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
  }

  // Geographic risk factors
  getGeographicRiskFactors(location: string | null): EvidenceItem[] {
    if (!location || location === "No recent travel") return []

    const riskFactors: EvidenceItem[] = []

    switch (location) {
      case "United States/Canada":
        riskFactors.push({ id: "p_13", choice_id: "present", source: "predefined" })
        break
      case "Europe":
        riskFactors.push({ id: "p_15", choice_id: "present", source: "predefined" })
        break
      case "Asia":
        riskFactors.push({ id: "p_236", choice_id: "present", source: "predefined" })
        break
      case "Africa":
        riskFactors.push({ id: "p_17", choice_id: "present", source: "predefined" })
        break
      case "South America":
        riskFactors.push({ id: "p_14", choice_id: "present", source: "predefined" })
        break
      case "Australia/Oceania":
        riskFactors.push({ id: "p_19", choice_id: "present", source: "predefined" })
        break
      case "Middle East":
        riskFactors.push({ id: "p_21", choice_id: "present", source: "predefined" })
        break
    }

    return riskFactors
  }

  // Emergency symptom detection
  identifyEmergencySymptoms(diagnosisResult: DiagnosisResponse, currentEvidence: EvidenceItem[]): string[] {
    const emergencyKeywords = [
      "severe chest pain",
      "difficulty breathing",
      "loss of consciousness",
      "severe headache",
      "stroke symptoms",
      "heart attack",
      "severe bleeding",
      "poisoning",
      "severe burns",
      "severe allergic reaction",
      "suicidal thoughts",
      "severe abdominal pain",
      "difficulty swallowing",
      "severe shortness of breath",
      "chest tightness",
      "cardiac arrest",
      "respiratory distress",
      "anaphylaxis",
      "seizure",
    ]

    const detectedEmergencies: string[] = []

    // Check API emergency flag
    if ((diagnosisResult as any).has_emergency_evidence) {
      detectedEmergencies.push("Emergency evidence detected by medical AI")
    }

    // Check conditions for emergency indicators
    if (diagnosisResult.conditions) {
      diagnosisResult.conditions.forEach((condition) => {
        const conditionName = (condition.common_name || condition.name).toLowerCase()
        const description = condition.details?.description?.toLowerCase() || ""

        // Check for emergency conditions
        if (
          condition.details?.acuteness === "chronic_with_exacerbation" ||
          condition.details?.acuteness === "acute" ||
          condition.details?.severity === "high"
        ) {
          emergencyKeywords.forEach((keyword) => {
            if (conditionName.includes(keyword) || description.includes(keyword)) {
              detectedEmergencies.push(`${condition.common_name || condition.name} (${keyword})`)
            }
          })
        }
      })
    }

    return [...new Set(detectedEmergencies)] // Remove duplicates
  }

  // Health data management (for future use with backend)
  async saveHealthAssessment(assessmentData: any): Promise<{ id: string; success: boolean }> {
    // This would connect to your backend to save assessment data
    // For now, we'll use localStorage as fallback
    const id = uuidv4()
    const dataToSave = {
      id,
      ...assessmentData,
      timestamp: new Date().toISOString(),
    }

    try {
      // Try to save to backend first
      const response = await this.request<{ id: string; success: boolean }>("/api/health/assessments", {
        method: "POST",
        body: JSON.stringify(dataToSave),
      })
      return response
    } catch (error) {
      // Fallback to localStorage
      console.warn("Backend save failed, using localStorage:", error)
      localStorage.setItem(`healthAssessment_${id}`, JSON.stringify(dataToSave))
      return { id, success: true }
    }
  }

  async getHealthAssessments(): Promise<any[]> {
    try {
      // Try to get from backend first
      return await this.request<any[]>("/api/health/assessments")
    } catch (error) {
      // Fallback to localStorage
      console.warn("Backend fetch failed, using localStorage:", error)
      const assessments = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith("healthAssessment_")) {
          const data = localStorage.getItem(key)
          if (data) {
            assessments.push(JSON.parse(data))
          }
        }
      }
      return assessments.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    }
  }
}

// Create singleton instance
export const healthAPI = new HealthBuddyAPI()

// Export convenience functions
export const parseSymptoms = (text: string, age: number, sex: "male" | "female" | "other", interviewId?: string) =>
  healthAPI.parseSymptoms(text, age, sex, interviewId)

export const getDiagnosis = (
  evidence: EvidenceItem[],
  age: number,
  sex: "male" | "female" | "other",
  interviewId: string,
) => healthAPI.getDiagnosis(evidence, age, sex, interviewId)

export const askGemini = (prompt: string) => healthAPI.askGemini(prompt)

export const getGeographicRiskFactors = (location: string | null) => healthAPI.getGeographicRiskFactors(location)

export const identifyEmergencySymptoms = (diagnosisResult: DiagnosisResponse, currentEvidence: EvidenceItem[]) =>
  healthAPI.identifyEmergencySymptoms(diagnosisResult, currentEvidence)

export const saveHealthAssessment = (assessmentData: any) => healthAPI.saveHealthAssessment(assessmentData)

export const getHealthAssessments = () => healthAPI.getHealthAssessments()
