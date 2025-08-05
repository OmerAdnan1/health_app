"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import {
  type DiagnosisData,
  getTriageResult,
  getConditionDetails,
  getRiskFactorDetails,
  getExplainationRes,
} from "../../lib/api/healthAPI"
import { useGeminiAI } from "../../lib/hooks/useHealthAPI"

import {
  AlertTriangle,
  CheckCircle,
  FileWarningIcon as Warning,
  MapPin,
  Bug,
  AlertCircle,
  ShieldAlert,
  Download,
  Activity,
  User,
  Calendar,
  Globe,
  FileText,
  Stethoscope,
  Target,
  X,
  Check,
} from "lucide-react"

export default function ResultsPage() {
  const router = useRouter()
  const [diagnosisData, setDiagnosisData] = useState<DiagnosisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [geminiInfo, setGeminiInfo] = useState<string>("")

  // API data states
  const [triageData, setTriageData] = useState<any>(null)
  const [conditionDetails, setConditionDetails] = useState<any[]>([])
  const [riskFactorDetails, setRiskFactorDetails] = useState<any[]>([])
  const [explainData, setExplainData] = useState<any[]>([])
  const [comprehensiveAnalysisLoading, setComprehensiveAnalysisLoading] = useState(false)

  const { askAI, isLoading: loadingGemini, error: geminiError } = useGeminiAI()

  useEffect(() => {
    const storedData = localStorage.getItem("diagnosisResults")
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        setDiagnosisData(data)

        if (data.conditions && data.conditions.length > 0) {
          fetchComprehensiveAnalysis(data)
        }
      } catch (error) {
        console.error("Error parsing diagnosis data:", error)
        router.push("/chatbot")
      }
    } else {
      router.push("/chatbot")
    }
    setLoading(false)
  }, [router])

  const fetchComprehensiveAnalysis = async (data: DiagnosisData) => {
    setComprehensiveAnalysisLoading(true)

    try {
      // 1. Get triage assessment
      const triage = await getTriageResult(
        { value: data.userAge!, unit: "year" },
        { value: data.userSex! },
        data.evidence,
        data.interviewId!,
      )
      setTriageData(triage)

      // 2. Get detailed condition information for top 3 conditions
      const topConditions = data.conditions.slice(0, 3)
      const conditionDetailsArray = []

      for (const condition of topConditions) {
        try {
          const details = await getConditionDetails(
            condition.id,
            data.interviewId!,
            data.userAge || undefined,
            data.userSex || undefined,
          )
          conditionDetailsArray.push({ ...details, originalCondition: condition })
        } catch (err) {
          console.warn(`Could not get details for condition ${condition.id}`)
        }
      }
      setConditionDetails(conditionDetailsArray)

      // 3. Get risk factor details
      const riskFactorIds = data.evidence.filter((e) => e.id.startsWith("p_") && e.choice_id === "present").slice(0, 5)

      const riskFactors = []
      for (const riskFactor of riskFactorIds) {
        try {
          const details = await getRiskFactorDetails(
            riskFactor.id,
            data.userAge || undefined,
            data.userSex || undefined,
            data.interviewId!,
          )
          riskFactors.push({ ...details, evidenceItem: riskFactor })
        } catch (err) {
          console.warn(`Could not get details for risk factor ${riskFactor.id}`)
        }
      }
      setRiskFactorDetails(riskFactors)

      // 4. Get explanations for top conditions
      const explanations = []
      for (const condition of topConditions) {
        try {
          const explanation = await getExplainationRes({
            age: { value: data.userAge!, unit: "year" },
            sex: { value: data.userSex! },
            evidence: data.evidence,
            target_condition: condition.id,
            interviewId: data.interviewId!,
          })
          explanations.push({ ...explanation, conditionId: condition.id })
        } catch (err) {
          console.warn(`Could not get explanation for condition ${condition.id}`)
        }
      }
      setExplainData(explanations)

      // 5. Generate patient education content
      await generatePatientEducation(data, triage, conditionDetailsArray[0])
    } catch (error) {
      console.error("Comprehensive analysis failed:", error)
      setGeminiInfo("Unable to complete comprehensive analysis. Please try again.")
    } finally {
      setComprehensiveAnalysisLoading(false)
    }
  }

  const generatePatientEducation = async (
    diagnosisData: DiagnosisData,
    triageData: any,
    primaryConditionDetails: any,
  ) => {
    const prompt = `As a medical education specialist, create patient education content for:

PATIENT: ${diagnosisData.userAge}-year-old ${diagnosisData.userSex}
PRIMARY CONDITION: ${primaryConditionDetails?.common_name || diagnosisData.conditions[0]?.common_name}
URGENCY LEVEL: ${triageData?.triage_level}
CLINICAL GUIDANCE: ${primaryConditionDetails?.extras?.hint}

Please provide:

1. IMMEDIATE CONSULTATION NEEDS:
- Specific type of medical professional to see
- Urgency timeline
- What to tell the doctor

2. DIAGNOSTIC TESTING:
- Specific tests likely needed
- Why these tests are important
- What to expect

3. PATIENT EDUCATION POINTS:
- What this condition means in simple terms
- How it develops
- Treatment approach
- Recovery expectations
- Prevention strategies

4. RED FLAGS - SEEK IMMEDIATE CARE IF:
- Specific symptoms that indicate emergency
- When to call 911
- Warning signs of complications

Keep language clear, professional, and reassuring while emphasizing the importance of professional medical care.`

    try {
      const response = await askAI(prompt)
      setGeminiInfo(response)
    } catch (error) {
      console.error("Patient education generation failed:", error)
      setGeminiInfo("Patient education content is currently unavailable.")
    }
  }

  const downloadResults = () => {
    if (!diagnosisData) return

    const resultsText = `
AI HEALTH ASSESSMENT REPORT
Generated by HealthBuddy AI
Date: ${new Date(diagnosisData.timestamp).toLocaleString()}

PATIENT INFORMATION:
- Age: ${diagnosisData.userAge} years
- Gender: ${diagnosisData.userSex}
- Location: ${diagnosisData.userLocation}
- Questions Answered: ${diagnosisData.evidence.length}

${
  triageData
    ? `
MEDICAL TRIAGE ASSESSMENT:
- Urgency Level: ${triageData.triage_level?.toUpperCase()}
- Root Cause: ${triageData.root_cause}
${triageData.serious?.length > 0 ? `- Serious Conditions: ${triageData.serious.map((s: any) => s.common_name).join(", ")}` : ""}
`
    : ""
}

MOST LIKELY CONDITIONS:
${diagnosisData.conditions
  .map(
    (condition, index) => `
${index + 1}. ${condition.common_name || condition.name}
   Probability: ${(condition.probability * 100).toFixed(1)}%
   ${conditionDetails[index]?.severity ? `Severity: ${conditionDetails[index].severity}` : ""}
   ${conditionDetails[index]?.extras?.icd10_code ? `ICD-10: ${conditionDetails[index].extras.icd10_code}` : ""}
`,
  )
  .join("")}

${
  riskFactorDetails.length > 0
    ? `
RISK FACTORS:
${riskFactorDetails.map((rf) => `- ${rf.common_name || rf.name}`).join("\n")}
`
    : ""
}

IMPORTANT DISCLAIMER:
This AI-generated assessment is for educational purposes only and should not replace professional medical consultation. Always consult with qualified healthcare providers for proper medical evaluation and treatment.

Report ID: ${diagnosisData.interviewId}
    `

    const blob = new Blob([resultsText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `health-assessment-report-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getTriageIcon = (level: string) => {
    switch (level) {
      case "emergency":
        return AlertTriangle
      case "consultation_24":
      case "consultation":
        return Warning
      default:
        return CheckCircle
    }
  }

  const getTriageColor = (level: string) => {
    switch (level) {
      case "emergency":
        return "text-red-600 bg-red-50 border-red-200"
      case "consultation_24":
        return "text-orange-600 bg-orange-50 border-orange-200"
      case "consultation":
        return "text-yellow-600 bg-yellow-50 border-yellow-200"
      default:
        return "text-green-600 bg-green-50 border-green-200"
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "severe":
        return "bg-red-100 text-red-800 border-red-200"
      case "moderate":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "mild":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getPrevalenceBadge = (prevalence: string) => {
    switch (prevalence) {
      case "very_rare":
        return "bg-red-100 text-red-800 border-red-200"
      case "rare":
        return "bg-orange-100 text-orange-800 border-orange-200"
      case "common":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your assessment results...</p>
        </div>
      </div>
    )
  }

  if (!diagnosisData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">No Assessment Data Found</h2>
          <p className="text-gray-600 mb-6">Please start a new health assessment.</p>
          <button
            onClick={() => router.push("/chatbot")}
            className="px-6 py-3 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors font-medium"
          >
            Start New Assessment
          </button>
        </div>
      </div>
    )
  }

  const TriageIcon = getTriageIcon(triageData?.triage_level || "self_care")

  return (
    <div className="min-h-screen bg-gray-50 font-['Inter']">
      <Header />

      <main className="pt-20 pb-12">
        <div className="max-w-5xl mx-auto px-6 space-y-6">
          {/* Report Header */}
          <div className="text-center py-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Your Personalized Health Assessment Report</h1>
            <p className="text-lg text-gray-600">Powered by HealthBuddy AI</p>
          </div>

          {/* Patient Profile */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <User className="h-5 w-5 mr-2 text-blue-500" />
              Assessment Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Age</p>
                  <p className="font-medium text-gray-900">{diagnosisData.userAge} years</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Gender</p>
                  <p className="font-medium text-gray-900 capitalize">{diagnosisData.userSex}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Globe className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Location</p>
                  <p className="font-medium text-gray-900">{diagnosisData.userLocation}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <FileText className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Questions Answered</p>
                  <p className="font-medium text-gray-900">{diagnosisData.evidence.length}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Warning */}
          {diagnosisData.emergencySymptoms.length > 0 && (
            <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl shadow-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-8 w-8 text-red-500 mr-4 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl font-bold text-red-900 mb-4">⚠️ Emergency Symptoms Detected</h2>
                  <div className="mb-4">
                    <p className="text-red-800 font-semibold mb-2">Critical symptoms identified during assessment:</p>
                    <ul className="list-disc pl-6 space-y-1">
                      {diagnosisData.emergencySymptoms.map((symptom, index) => (
                        <li key={index} className="text-red-800">
                          {symptom}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-100 p-4 rounded-xl border border-red-200">
                    <p className="text-red-900 font-bold text-lg">🚨 SEEK IMMEDIATE MEDICAL ATTENTION</p>
                    <p className="text-red-800 mt-2">
                      Contact emergency services (911) or visit the nearest emergency room immediately.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Medical Triage Assessment */}
          {triageData && (
            <div className={`rounded-2xl shadow-lg p-6 border-2 ${getTriageColor(triageData.triage_level)}`}>
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <TriageIcon className="h-6 w-6 mr-3" />
                Medical Triage Assessment
              </h2>

              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-medium text-gray-700">Urgency Level:</span>
                  <span
                    className={`px-4 py-2 rounded-xl font-bold text-xl border ${getTriageColor(triageData.triage_level)}`}
                  >
                    {triageData.triage_level?.replace("_", " ").toUpperCase()}
                  </span>
                </div>

                {triageData.description && (
                  <div className="bg-white/50 p-4 rounded-xl border border-gray-200">
                    <h4 className="font-semibold text-gray-900 mb-2">Recommendation:</h4>
                    <p className="text-gray-700">{triageData.description}</p>
                  </div>
                )}

                {triageData.serious && triageData.serious.length > 0 && (
                  <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                    <h4 className="font-semibold text-orange-900 mb-2 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Serious Conditions to Consider:
                    </h4>
                    <ul className="space-y-1">
                      {triageData.serious.map((condition: any, index: number) => (
                        <li key={index} className="text-orange-800 flex items-center">
                          <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
                          {condition.common_name || condition.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State for Comprehensive Analysis */}
          {comprehensiveAnalysisLoading && (
            <div className="bg-white rounded-2xl shadow-lg p-8">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-4"></div>
                <span className="text-lg text-gray-600">
                  Analyzing clinical data and generating comprehensive report...
                </span>
              </div>
            </div>
          )}

          {/* Most Likely Conditions & Detailed Analysis */}
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Most Likely Conditions & Detailed Analysis</h2>

            {conditionDetails.map((details, index) => {
              const condition = details.originalCondition
              const explanation = explainData.find((e) => e.conditionId === condition.id)

              return (
                <div key={condition.id} className="bg-white rounded-2xl shadow-lg p-6">
                  {/* Condition Header */}
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-900 mb-2">
                        {condition.common_name || condition.name}
                      </h3>
                      <div className="flex items-center space-x-2 mb-2">
                        <span className="text-3xl font-bold text-blue-600">
                          {(condition.probability * 100).toFixed(1)}%
                        </span>
                        <span className="text-gray-500">probability</span>
                      </div>
                      {details.extras?.icd10_code && (
                        <p className="text-sm text-gray-500">ICD-10: {details.extras.icd10_code}</p>
                      )}
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-sm font-medium ${index === 0 ? "bg-blue-100 text-blue-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      #{index + 1} Most Likely
                    </div>
                  </div>

                  {/* Clinical Information */}
                  {details.extras?.hint && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 mb-6">
                      <h4 className="font-semibold text-blue-900 mb-2 flex items-center">
                        <Stethoscope className="h-4 w-4 mr-2" />
                        Clinical Information:
                      </h4>
                      <p className="text-blue-800 font-medium">{details.extras.hint}</p>
                    </div>
                  )}

                  {/* Key Attributes */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                    {details.severity && (
                      <div
                        className={`px-3 py-2 rounded-lg border text-sm font-medium ${getSeverityBadge(details.severity)}`}
                      >
                        Severity: {details.severity}
                      </div>
                    )}
                    {details.prevalence && (
                      <div
                        className={`px-3 py-2 rounded-lg border text-sm font-medium ${getPrevalenceBadge(details.prevalence)}`}
                      >
                        Prevalence: {details.prevalence.replace("_", " ")}
                      </div>
                    )}
                    {details.acuteness && (
                      <div className="px-3 py-2 rounded-lg border text-sm font-medium bg-purple-100 text-purple-800 border-purple-200">
                        {details.acuteness.replace("_", " ")}
                      </div>
                    )}
                    {details.sex_filter && (
                      <div className="px-3 py-2 rounded-lg border text-sm font-medium bg-gray-100 text-gray-800 border-gray-200">
                        Sex Filter: {details.sex_filter}
                      </div>
                    )}
                  </div>

                  {/* AI's Reasoning */}
                  {explanation && (
                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Supporting Evidence */}
                      {explanation.supporting_evidence && explanation.supporting_evidence.length > 0 && (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                          <h4 className="font-semibold text-green-900 mb-3 flex items-center">
                            <Check className="h-4 w-4 mr-2" />
                            Supporting Evidence:
                          </h4>
                          <div className="space-y-2">
                            {explanation.supporting_evidence.map((evidence: any, idx: number) => (
                              <div key={idx} className="flex items-center text-green-800">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                <span className="text-sm">{evidence.common_name || evidence.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Conflicting Evidence */}
                      {explanation.conflicting_evidence && explanation.conflicting_evidence.length > 0 && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                          <h4 className="font-semibold text-red-900 mb-3 flex items-center">
                            <X className="h-4 w-4 mr-2" />
                            Conflicting Evidence:
                          </h4>
                          <div className="space-y-2">
                            {explanation.conflicting_evidence.map((evidence: any, idx: number) => (
                              <div key={idx} className="flex items-center text-red-800">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-2"></div>
                                <span className="text-sm">{evidence.common_name || evidence.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Risk Factors Analysis */}
          {riskFactorDetails.length > 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Target className="h-6 w-6 mr-3 text-orange-500" />
                Risk Factors Analysis
              </h2>

              <div className="grid md:grid-cols-2 gap-4">
                {riskFactorDetails.map((riskFactor, index) => {
                  const getRiskIcon = (id: string) => {
                    if (id.includes("travel") || id.includes("residence")) return Globe
                    if (id.includes("mosquito") || id.includes("bite")) return Bug
                    return MapPin
                  }

                  const RiskIcon = getRiskIcon(riskFactor.id)

                  return (
                    <div key={index} className="border border-gray-200 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center">
                          <RiskIcon className="h-5 w-5 text-orange-500 mr-2" />
                          <h3 className="font-semibold text-gray-900">{riskFactor.common_name || riskFactor.name}</h3>
                        </div>
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                          Present
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">Status: Present in patient profile</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Next Steps & Patient Education */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Next Steps & Patient Education</h2>

            {loadingGemini ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mr-3"></div>
                <span className="text-gray-600">Generating personalized guidance...</span>
              </div>
            ) : geminiError ? (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-600">Error generating patient education content</p>
              </div>
            ) : geminiInfo ? (
              <div className="prose max-w-none">
                {geminiInfo.split("\n").map((paragraph, index) => {
                  if (paragraph.trim()) {
                    // Handle numbered sections
                    if (paragraph.match(/^\d+\./)) {
                      return (
                        <h3 key={index} className="text-lg font-semibold text-gray-900 mt-6 mb-3">
                          {paragraph}
                        </h3>
                      )
                    }

                    // Handle bullet points
                    if (paragraph.trim().startsWith("-")) {
                      return (
                        <div key={index} className="flex items-start mb-2">
                          <div className="w-2 h-2 bg-blue-500 rounded-full mr-3 mt-2"></div>
                          <p className="text-gray-700">{paragraph.replace(/^-\s*/, "")}</p>
                        </div>
                      )
                    }

                    // Handle section headers in caps
                    if (paragraph === paragraph.toUpperCase() && paragraph.length > 5) {
                      return (
                        <h4 key={index} className="text-md font-semibold text-blue-900 mt-4 mb-2">
                          {paragraph}
                        </h4>
                      )
                    }

                    return (
                      <p key={index} className="text-gray-700 mb-3 leading-relaxed">
                        {paragraph}
                      </p>
                    )
                  }
                  return <br key={index} />
                })}
              </div>
            ) : (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Patient education content is being prepared...</p>
              </div>
            )}

            {/* Red Flags Alert */}
            <div className="mt-8 bg-red-50 border-l-4 border-red-500 p-4 rounded-xl">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-red-500 mr-3 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-red-900 mb-2">Red Flags - Seek Immediate Care If:</h4>
                  <ul className="text-red-800 text-sm space-y-1">
                    <li>• Difficulty breathing or shortness of breath</li>
                    <li>• Severe chest pain or pressure</li>
                    <li>• High fever (over 103°F/39.4°C) that doesn't respond to medication</li>
                    <li>• Severe headache with neck stiffness</li>
                    <li>• Confusion or altered mental state</li>
                    <li>• Persistent vomiting or inability to keep fluids down</li>
                    <li>• Signs of severe dehydration</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Important Disclaimer */}
          <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-2xl shadow-lg">
            <div className="flex items-start">
              <ShieldAlert className="h-8 w-8 text-red-500 mr-4 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-red-900 mb-4">Crucial Disclaimer</h2>
                <div className="text-red-800 space-y-3">
                  <p className="font-semibold">
                    This AI-generated assessment is for educational and informational purposes only.
                  </p>
                  <p>
                    The results are based on artificial intelligence analysis of reported symptoms and should
                    <strong> never replace professional medical consultation</strong>. Medical conditions require proper
                    evaluation by qualified healthcare providers.
                  </p>
                  <p>Always consult with a licensed physician, specialist, or healthcare provider for:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Proper medical diagnosis and evaluation</li>
                    <li>Treatment recommendations and medical advice</li>
                    <li>Emergency medical situations</li>
                    <li>Any health concerns or symptoms</li>
                  </ul>
                  <div className="bg-red-100 p-3 rounded-lg border border-red-300 mt-4">
                    <p className="font-medium">
                      <strong>Emergency Note:</strong> If you are experiencing a medical emergency, call emergency
                      services (911) immediately or visit your nearest emergency room.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
            <button
              onClick={downloadResults}
              className="flex items-center justify-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl transition-colors font-medium shadow-lg"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Report
            </button>
            <button
              onClick={() => router.push("/chatbot")}
              className="flex items-center justify-center px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-xl transition-colors font-medium shadow-lg"
            >
              <Activity className="h-5 w-5 mr-2" />
              New Assessment
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
