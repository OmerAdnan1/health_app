import { v4 as uuidv4 } from "uuid"

// Type Definitions
export type EvidenceItem = {
  id: string
  choice_id: "present" | "absent" | "unknown"
  source?: "initial" | "suggest" | "predefined" | "red_flags"
  name: string
}

export type Condition = {
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

export type DiagnosisResponse = {
  question?: InfermedicaQuestion
  conditions: Condition[]
  should_stop: boolean
  evidence?: EvidenceItem[]
  reasoning?: string[]
}

export type InfermedicaChoice = {
  id: "present" | "absent" | "unknown"
  label: string
}

export type InfermedicaQuestionItem = {
  id: string
  name: string
  choices: InfermedicaChoice[]
}

export type InfermedicaQuestion = {
  type: "single" | "group_single" | "group_multiple"
  text: string
  items: InfermedicaQuestionItem[]
}

export type InitialQuestion = {
  id: string
  question: string
  type: "age" | "select" | "text"
  options?: string[]
  tips: string[]
}

// Type for diagnosis data stored in localStorage
export type DiagnosisData = {
  conditions: Condition[]
  emergencySymptoms: string[]
  userAge: number | null
  userSex: "male" | "female" | null
  userLocation: string | null
  evidence: EvidenceItem[]
  interviewId: string | null
  timestamp: string
  questionCount: number
}

// Type for triage response
export type TriageResponse = {
  triage_level: "non_urgent" | "self_care" | "consultation" | "consultation_24" | "emergency"
  description: string
  label: string
  serious: Array<{
    id: string
    name: string
    common_name: string
    is_emergency?: boolean
  }>
}

// Type for condition details
export type ConditionDetails = {
  id: string
  name: string
  common_name: string
  sex_filter: "both" | "male" | "female"
  prevalence: "very_rare" | "rare" | "moderate" | "common" | "very_common"
  acuteness: "chronic" | "chronic_with_exacerbation" | "acute_potentially_chronic" | "acute"
  severity: "mild" | "moderate" | "severe"
  extras?: {
    hint?: string
    icd10_code?: string
  }
  image_url?: string
  image_source?: string
}

// Type for risk factor details
export type RiskFactorDetails = {
  id: string
  name: string
  common_name?: string
  sex_filter: "both" | "male" | "female"
  category: string
  extras?: {
    hint?: string
  }
  image_url?: string
  image_source?: string
}

// Helper function to safely parse API responses
export const parseJsonResponse = async (response: Response) => {
  try {
    const text = await response.text()
    if (!response.ok) {
      try {
        const errorData = JSON.parse(text)
        throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`)
      } catch (jsonError) {
        throw new Error(`API error: ${response.status} ${response.statusText}${text ? `: ${text}` : ""}`)
      }
    }
    return text ? JSON.parse(text) : {}
  } catch (error) {
    console.error("Error parsing JSON response:", error)
    throw error
  }
}

// Helper function to normalize text input for better parsing
export const normalizeText = (input: string): string => {
  return input.trim().replace(/\s+/g, " ").toLowerCase()
}

// Geographic risk factors mapping based on Infermedica documentation
export const getGeographicRiskFactors = (location: string | null): EvidenceItem[] => {
  if (!location || location === "No recent travel") return []

  const riskFactors: EvidenceItem[] = []

  switch (location) {
    case "United States/Canada":
      riskFactors.push({ id: "p_13", choice_id: "present", source: "predefined", name: "Living in North America" })
      break
    case "Europe":
      riskFactors.push({ id: "p_15", choice_id: "present", source: "predefined", name: "Living in Europe" })
      break
    case "Asia":
      riskFactors.push({ id: "p_236", choice_id: "present", source: "predefined", name: "Living in Asia" })
      break
    case "Africa":
      // Using Central Africa as default, could be refined further
      riskFactors.push({ id: "p_17", choice_id: "present", source: "predefined", name: "Living in Central Africa" })
      break
    case "South America":
      riskFactors.push({ id: "p_14", choice_id: "present", source: "predefined", name: "Living in South America" })
      break
    case "Australia/Oceania":
      riskFactors.push({ id: "p_19", choice_id: "present", source: "predefined", name: "Living in Australia/Oceania" })
      break
    case "Middle East":
      riskFactors.push({ id: "p_21", choice_id: "present", source: "predefined", name: "Living in Middle East" })
      break
  }

  return riskFactors
}

// Function to identify emergency symptoms from evidence and conditions
export const identifyEmergencySymptoms = (
  diagnosisResult: DiagnosisResponse,
  currentEvidence: EvidenceItem[],
): string[] => {
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

// Smart stop logic function
export const smartStopLogic = (
  diagnosisResult: DiagnosisResponse,
  currentQuestionCount: number,
  MAX_DIAGNOSIS_QUESTIONS: number,
  continuePastMaxQuestions: boolean,
  setShowMaxQuestionsChoice: (show: boolean) => void,
  setEmergencySymptoms: (setter: (prev: string[]) => string[]) => void,
  evidence: EvidenceItem[],
): boolean => {
  const conditions = diagnosisResult.conditions || []
  const apiShouldStop = diagnosisResult.should_stop

  console.log("Smart Stop Analysis:", {
    questionCount: currentQuestionCount,
    apiShouldStop,
    conditionsCount: conditions.length,
    topProbability: conditions[0]?.probability || 0,
    hasQuestion: !!diagnosisResult.question,
  })

  // EMERGENCY DETECTION: Collect emergency symptoms but continue diagnosis
  const detectedEmergencies = identifyEmergencySymptoms(diagnosisResult, evidence)
  if (detectedEmergencies.length > 0) {
    console.log("🚨 EMERGENCY SYMPTOMS DETECTED:", detectedEmergencies)
    setEmergencySymptoms((prev) => {
      const combined = [...prev, ...detectedEmergencies]
      return [...new Set(combined)] // Remove duplicates
    })
    // Don't stop - continue with diagnosis to gather more information
  }

  // HIGH CONFIDENCE STOP: If we have a very confident diagnosis
  if (conditions.length > 0) {
    const topCondition = conditions[0]
    const secondCondition = conditions[1]

    // Stop if top condition has very high probability (>85%)
    if (topCondition.probability > 0.85) {
      console.log("🎯 HIGH CONFIDENCE STOP: Top condition >85%", topCondition.probability)
      return true
    }

    // Stop if top condition is significantly higher than second (gap >40%)
    if (secondCondition && topCondition.probability - secondCondition.probability > 0.4) {
      console.log("📊 CLEAR LEADER STOP: Large gap between top conditions")
      return true
    }

    // Stop if we have good confidence (>70%) AND API suggests stopping
    if (topCondition.probability > 0.7 && apiShouldStop) {
      console.log("✅ GOOD CONFIDENCE + API STOP")
      return true
    }
  }

  // MINIMUM QUESTIONS: Don't stop before asking at least 3 questions (unless emergency)
  if (currentQuestionCount < 3) {
    console.log("🔄 CONTINUE: Need minimum 3 questions")
    return false
  }

  // API GUIDANCE: Trust API if it strongly suggests stopping after minimum questions
  if (apiShouldStop && currentQuestionCount >= 5) {
    console.log("🤖 API GUIDANCE STOP: API suggests stopping after sufficient questions")
    return true
  }

  // QUESTION AVAILABILITY: If no more questions available, stop
  if (!diagnosisResult.question) {
    console.log("❓ NO MORE QUESTIONS: Stopping due to lack of questions")
    return true
  }

  // MAXIMUM QUESTIONS: Show choice to user instead of hard stop
  if (currentQuestionCount >= MAX_DIAGNOSIS_QUESTIONS && !continuePastMaxQuestions) {
    console.log("🔚 MAX QUESTIONS REACHED: Showing user choice")
    setShowMaxQuestionsChoice(true)
    return true // Temporarily stop to show choice
  }

  // EXTENDED MAXIMUM: Hard limit for continued diagnosis (50% higher than original)
  if (continuePastMaxQuestions && currentQuestionCount >= Math.floor(MAX_DIAGNOSIS_QUESTIONS * 1.5)) {
    console.log("🛑 EXTENDED MAX REACHED: Final hard stop")
    return true
  }

  // CONVERGENCE CHECK: If probabilities haven't changed much in recent questions
  if (currentQuestionCount >= 6 && conditions.length > 0) {
    const topProbability = conditions[0].probability
    // This could be enhanced to track probability changes over time
    if (topProbability > 0.6) {
      console.log("📈 CONVERGENCE STOP: Stable probabilities with good confidence")
      return true
    }
  }

  console.log("➡️ CONTINUE: No stop conditions met")
  return false
}

// API call to get diagnosis
export const getDiagnosis = async (
  currentEvidence: EvidenceItem[],
  userAge: number | null,
  userSex: "male" | "female" | null,
  interviewId: string | null,
): Promise<DiagnosisResponse> => {
  if (userAge === null || userSex === null || currentEvidence.length === 0) {
    throw new Error("Diagnosis prerequisites are missing (age, sex, or initial evidence).")
  }

  if (!interviewId) {
    throw new Error("Interview ID is missing.")
  }

  // Deduplicate evidence
  const uniqueEvidenceMap = new Map<string, EvidenceItem>()
  currentEvidence.forEach((item) => {
    if (!uniqueEvidenceMap.has(item.id)) {
      uniqueEvidenceMap.set(item.id, item)
    }
  })
  const dedupedEvidence = Array.from(uniqueEvidenceMap.values())

  // Ensure all evidence has proper source according to Infermedica API
  const normalizedEvidence = dedupedEvidence.map((item) => ({
    ...item,
    // Keep existing source if present, otherwise omit for dynamic interview evidence
    ...(item.source && { source: item.source }),
  }))

  console.log(`Sending diagnosis with ${normalizedEvidence.length} evidence items:`, {
    initialEvidence: normalizedEvidence.filter((e) => e.source === "initial").length,
    dynamicEvidence: normalizedEvidence.filter((e) => !e.source).length,
    otherSources: normalizedEvidence.filter((e) => e.source && e.source !== "initial").length,
  })

  const payload = {
    age: { value: userAge, unit: "year" },
    sex: userSex,
    evidence: normalizedEvidence,
    evaluated_at: new Date().toISOString().split("T")[0], // Optional but helps timeline logic
    extras: {
      enable_triage_advanced_mode: true,
      enable_conditions_details: true,
      enable_evidence_details: true,
    },
  }

  try {
    const res = await fetch("http://localhost:5001/api/infermedica/diagnosis", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Interview-Id": interviewId,
      },
      body: JSON.stringify(payload),
    })
    return await parseJsonResponse(res)
  } catch (error) {
    console.error("Diagnosis API call failed:", error)
    throw error
  }
}

// API call to parse symptoms
export const getParseResult = async (
  responseString: string,
  userAge: number | null,
  userSex: "male" | "female" | null,
  interviewId: string | null,
) => {
  if (userAge === null || userSex === null) {
    throw new Error("Parsing prerequisites are missing (age or sex).")
  }

  const finalInterviewId = interviewId || uuidv4()

  console.log("Using User Age:", userAge)

  const payload = {
    "age.value": userAge,
    "age.unit": "year",
    sex: userSex,
    text: responseString,
    context: [], // can populate this from previous input (optional)
    include_tokens: true, // Set to true to get better parsing details
    correct_spelling: true,
    concept_types: ["symptom", "risk_factor"], // capture more context
    interviewId: finalInterviewId,
  }

  try {
    const res = await fetch("http://localhost:5001/api/infermedica/parse", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Interview-Id": finalInterviewId,
      },
      body: JSON.stringify(payload),
    })

    const data = await parseJsonResponse(res)

    // // Filter out low-relevance mentions to improve quality
    // if (data.mentions) {
    //   data.mentions = data.mentions.filter((m: any) => {
    //     // Keep mentions with higher relevance or confidence
    //     return m.relevance ? m.relevance > 0.4 : true
    //   })
    // }

    return data
  } catch (error) {
    console.error("API call to /parse failed:", error)
    throw error
  }
}

// API call to Gemini
export const askGemini = async (prompt: string): Promise<string> => {
  try {
    const res = await fetch("http://localhost:5001/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    })
    const data = await res.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
  } catch (error) {
    console.error("Gemini API call failed:", error)
    throw error
  }
}

// Interface for explain API end point
export interface ExplainRequest {
  age: {value: number, unit: string}
  sex: {value: 'male' | 'female' }
  evidence: Array<EvidenceItem>
  target_condition: string
  interviewId: string
}

// API function for explain endpoint
export const getExplainationRes = async (request: ExplainRequest): Promise<any> => {
  if (!request.age || !request.sex || !request.evidence || !request.target_condition) {
    throw new Error("Explain api missing required fields.")
  }

  const payload = {
    age: request.age,
    sex: request.sex.value, // Extract just the value, not the object
    evidence: request.evidence,
    condition_id: request.target_condition,
    interviewId: request.interviewId || uuidv4(), // Ensure interviewId is always set
  }

  console.log("📤 Sending explanation request:", payload)

  try {
    const res = await fetch("http://localhost:5001/api/infermedica/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Interview-Id": request.interviewId,
      },
      body: JSON.stringify(payload),
    })
    const result = await parseJsonResponse(res)
    console.log("📥 Received explanation response:", result)
    return result
  } catch (error) {
    console.error("Explain API call failed:", error)
    throw error
  }
}

// API function for triage endpoint
export const getTriageResult = async (
  age: {value: number, unit: string},
  sex: {value: 'male' | 'female'},
  evidence: Array<EvidenceItem>,
  interviewId: string
): Promise<any> => {
  if (!age || !sex || !evidence) {
    throw new Error("Triage API missing required fields.")
  }

  const payload = {
    age,
    sex: sex.value,
    evidence,
    interviewId: interviewId || uuidv4(),
  }

  console.log("📤 Sending triage request:", payload)

  try {
    const res = await fetch("http://localhost:5001/api/infermedica/triage", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Interview-Id": interviewId,
      },
      body: JSON.stringify(payload),
    })
    const result = await parseJsonResponse(res)
    console.log("📥 Received triage response:", result)
    return result
  } catch (error) {
    console.error("Triage API call failed:", error)
    throw error
  }
}

// API function to get condition details by ID
export const getConditionDetails = async (
  conditionId: string,
  interviewId?: string,
  age?: number,
  sex?: string
): Promise<any> => {
  if (!conditionId) {
    throw new Error("Condition ID is required.")
  }

  console.log("📤 Fetching condition details for:", conditionId, { age, sex })

  try {
    const url = new URL(`http://localhost:5001/api/infermedica/conditions/${conditionId}`)
    if (interviewId) {
      url.searchParams.append('interviewId', interviewId)
    }
    if (age) {
      url.searchParams.append('age', age.toString())
    }
    if (sex) {
      url.searchParams.append('sex', sex)
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(interviewId && { "Interview-Id": interviewId }),
      },
    })
    const result = await parseJsonResponse(res)
    console.log("📥 Received condition details:", result)
    return result
  } catch (error) {
    console.error("Condition details API call failed:", error)
    throw error
  }
}

// API function to list all conditions
export const getConditionsList = async (
  queryParams?: Record<string, string>,
  interviewId?: string
): Promise<any> => {
  console.log("📤 Fetching conditions list")

  try {
    const url = new URL("http://localhost:5001/api/infermedica/conditions")
    
    // Add query parameters
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }
    if (interviewId) {
      url.searchParams.append('interviewId', interviewId)
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(interviewId && { "Interview-Id": interviewId }),
      },
    })
    const result = await parseJsonResponse(res)
    console.log("📥 Received conditions list:", result)
    return result
  } catch (error) {
    console.error("Conditions list API call failed:", error)
    throw error
  }
}

// API function to get risk factor details by ID
export const getRiskFactorDetails = async (
  riskFactorId: string,
  age?: number,
  sex?: string,
  interviewId?: string
): Promise<any> => {
  if (!riskFactorId) {
    throw new Error("Risk factor ID is required.")
  }

  console.log("📤 Fetching risk factor details for:", riskFactorId)

  try {
    const url = new URL(`http://localhost:5001/api/infermedica/risk_factors/${riskFactorId}`)
    if (interviewId) {
      url.searchParams.append('interviewId', interviewId)
    }
    if (age) {
      url.searchParams.append('age', age.toString())
    }
    if (sex) {
      url.searchParams.append('sex', sex)
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(interviewId && { "Interview-Id": interviewId }),
      },
    })
    const result = await parseJsonResponse(res)
    console.log("📥 Received risk factor details:", result)
    return result
  } catch (error) {
    console.error("Risk factor details API call failed:", error)
    throw error
  }
}

// API function to list all risk factors
export const getRiskFactorsList = async (
  queryParams?: Record<string, string>,
  interviewId?: string
): Promise<any> => {
  console.log("📤 Fetching risk factors list")

  try {
    const url = new URL("http://localhost:5001/api/infermedica/risk_factors")
    
    // Add query parameters
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }
    if (interviewId) {
      url.searchParams.append('interviewId', interviewId)
    }

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(interviewId && { "Interview-Id": interviewId }),
      },
    })
    const result = await parseJsonResponse(res)
    console.log("📥 Received risk factors list:", result)
    return result
  } catch (error) {
    console.error("Risk factors list API call failed:", error)
    throw error
  }
}
