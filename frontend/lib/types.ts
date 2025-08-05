// Shared type definitions for the health app

export type Message = {
  id: number
  content: string | InfermedicaQuestion
  sender: "bot" | "user"
  timestamp: Date
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

export type EvidenceItem = {
  id: string
  choice_id: "present" | "absent" | "unknown"
  name: string  // Human-readable name of the symptom/risk factor
  source?: "initial" | "suggest" | "predefined" | "red_flags"  // source of evidence per Infermedica API
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

// Types for comprehensive medical analysis
export type TriageResponse = {
  triage_level: string
  root_cause?: string
  description?: string
  serious?: Array<{
    id: string
    name: string
    common_name?: string
    is_emergency: boolean
  }>
}

export type ConditionDetails = {
  id: string
  name: string
  common_name: string
  category: string
  prevalence?: {
    population_percentage?: number
    age_range?: string
  }
  severity?: string
  acuteness?: string
  sex_filter?: string
  extras?: {
    icd10_code?: string
    hint?: string
  }
}

export type RiskFactorDetails = {
  id: string
  name: string
  common_name: string
  category: string
  sex_filter?: string
  extras?: {
    hint?: string
  }
}

export type ExplainResponse = {
  supporting_evidence?: Array<{
    id: string
    name: string
    common_name: string
  }>
  conflicting_evidence?: Array<{
    id: string
    name: string
    common_name: string
  }>
  unconfirmed_evidence?: Array<{
    id: string
    name: string
    common_name: string
  }>
}

// Complete diagnosis data structure for localStorage
export type DiagnosisData = {
  conditions: Condition[]
  evidence: EvidenceItem[]
  emergencySymptoms: string[]
  userAge: number
  userSex: "male" | "female"
  userLocation: string
  questionCount: number
  timestamp: string
  interviewId: string
}

export type DiagnosisResponse = {
  question?: InfermedicaQuestion
  conditions: Condition[]
  should_stop: boolean
  evidence?: EvidenceItem[]
  reasoning?: string[]
}

export type InitialQuestion = {
  id: string
  question: string
  type: "age" | "select" | "text"
  options?: string[]
  tips: string[]
}

export type FinalDiagnosisContent = {
  type: "final_diagnosis"
  conditions: Condition[]
  emergencySymptoms: string[]
}

export type MaxQuestionsChoiceContent = {
  type: "max_questions_choice"
  questionCount: number
  conditions: Condition[]
}
