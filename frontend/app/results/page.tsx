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
  Clock,
  Heart,
  TrendingUp,
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

      // 5. Generate comprehensive Gemini content
      await generateComprehensiveGeminiContent(data, triage, conditionDetailsArray[0], explanations[0], riskFactors)
    } catch (error) {
      console.error("Comprehensive analysis failed:", error)
      setGeminiInfo("Unable to complete comprehensive analysis. Please try again.")
    } finally {
      setComprehensiveAnalysisLoading(false)
    }
  }

  const generateComprehensiveGeminiContent = async (
    diagnosisData: DiagnosisData,
    triageData: any,
    primaryConditionDetails: any,
    primaryExplanation: any,
    riskFactors: any[],
  ) => {
    const topCondition = diagnosisData.conditions[0]

    const geminiPrompt = `Generate comprehensive, concise, and actionable patient education content and next steps for a patient based on the following detailed medical assessment data. The content must be structured using Markdown.

**Patient Profile:**
- Age: ${diagnosisData.userAge}
- Sex: ${diagnosisData.userSex}

**Primary Diagnosed Condition:**
- ID: ${topCondition.id}
- Name: ${topCondition.common_name || topCondition.name} (Probability: ${(topCondition.probability * 100).toFixed(1)}%)
- Severity: ${primaryConditionDetails?.severity || "Not specified"}
- Prevalence: ${primaryConditionDetails?.prevalence || "Not specified"}
- Acuteness: ${primaryConditionDetails?.acuteness || "Not specified"}
- Clinical Hint: ${primaryConditionDetails?.extras?.hint || "Standard medical care recommended"}
- ICD-10 Code: ${primaryConditionDetails?.extras?.icd10_code || "Not available"}

**AI Reasoning (Supporting Evidence for ${topCondition.common_name || topCondition.name}):**
${primaryExplanation?.supporting_evidence?.map((e: any) => `- ${e.common_name || e.name}`).join("\n") || "- No specific supporting evidence documented"}

**AI Reasoning (Conflicting Evidence for ${topCondition.common_name || topCondition.name}):**
${primaryExplanation?.conflicting_evidence?.length > 0 ? primaryExplanation.conflicting_evidence.map((e: any) => `- ${e.common_name || e.name}`).join("\n") : "- None"}

**Overall Medical Triage Level:** ${triageData?.triage_level || "Not assessed"}
${triageData?.serious?.length > 0 ? `**Serious Conditions to Consider:** ${triageData.serious.map((s: any) => s.common_name || s.name).join(", ")}` : ""}

**Identified Risk Factors:**
${riskFactors.map((rf: any) => `- ${rf.common_name || rf.name}`).join("\n") || "- No specific risk factors identified"}

---

**Instructions for Content Generation:**

1. **Start directly with a Markdown H2 headline:** \`## Next Steps & Important Information\`.
2. **Structure:** Use Markdown headings (##, ###), bold text (**), and bullet points (-) for clarity.
3. **Content Areas to Cover:**
   * **Immediate Actions:** Based on the triage level and primary condition. What should the patient do *right now*?
   * **Understanding [Condition Name]:** A patient-friendly explanation of what the condition is, its common causes, and typical course.
   * **Diagnostic Testing:** Suggest common tests relevant to the condition.
   * **Treatment & Management:** General advice on treatment adherence, potential for relapse (if applicable), and importance of follow-up appointments.
   * **Prevention:** Strategies to prevent future infections or recurrence.
   * **Red Flags:** A list of critical worsening symptoms that warrant immediate medical attention.
4. **Tone:** Concise, actionable, empathetic, and patient-friendly.
5. **Crucial Negative Constraints (DO NOT INCLUDE THESE):**
   * Any disclaimers or warnings (e.g., 'IMPORTANT!', 'This is for informational purposes only', 'This does not replace medical advice').
   * Subject lines (e.g., 'Subject:').
   * Salutations (e.g., 'Dear [Patient's Name],').
   * Closing remarks or signatures.
   * Any introductory or concluding sentences that are not part of the core educational content.
   * Any external links or URLs.
   * Any information about the AI's accuracy or training.

Ensure the output is *only* the Markdown-formatted educational content.`

    try {
      const response = await askAI(geminiPrompt)
      setGeminiInfo(response)
    } catch (error) {
      console.error("Gemini content generation failed:", error)
      setGeminiInfo("Patient education content is currently unavailable.")
    }
  }

  const downloadResults = () => {
    if (!diagnosisData) return

    const resultsText = `
HEALTH ASSESSMENT REPORT
Generated by HealthBuddy AI
Assessment Date: ${new Date(diagnosisData.timestamp).toLocaleDateString()}

ASSESSMENT INFORMATION:
- Age: ${diagnosisData.userAge} years
- Gender: ${diagnosisData.userSex}
- Questions Answered: ${diagnosisData.evidence.length}

${
  triageData
    ? `
MEDICAL TRIAGE ASSESSMENT:
- Urgency Level: ${triageData.triage_level?.toUpperCase()}
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
RELEVANT RISK FACTORS:
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
        return "text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800"
      case "consultation_24":
        return "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-900/20 dark:border-orange-800"
      case "consultation":
        return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-800"
      default:
        return "text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800"
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "severe":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700"
      case "moderate":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700"
      case "mild":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
    }
  }

  const getPrevalenceBadge = (prevalence: string) => {
    switch (prevalence) {
      case "very_rare":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700"
      case "rare":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-700"
      case "common":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
    }
  }

  const renderMarkdownContent = (content: string) => {
    return content.split("\n").map((line, index) => {
      const trimmedLine = line.trim()

      if (!trimmedLine) {
        return <div key={index} className="h-4" />
      }

      // Handle H2 headers (##)
      if (trimmedLine.startsWith("## ")) {
        return (
          <h2
            key={index}
            className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-6 pb-3 border-b-2 border-blue-500 dark:border-blue-400"
          >
            {trimmedLine.replace("## ", "")}
          </h2>
        )
      }

      // Handle H3 headers (###)
      if (trimmedLine.startsWith("### ")) {
        return (
          <h3 key={index} className="text-xl font-semibold text-gray-800 dark:text-gray-200 mt-6 mb-4">
            {trimmedLine.replace("### ", "")}
          </h3>
        )
      }

      // Handle bullet points
      if (trimmedLine.startsWith("- ")) {
        return (
          <div key={index} className="flex items-start mb-3">
            <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-3 mt-2 flex-shrink-0"></div>
            <p
              className="text-gray-700 dark:text-gray-300 leading-relaxed"
              dangerouslySetInnerHTML={{
                __html: trimmedLine
                  .replace("- ", "")
                  .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>'),
              }}
            />
          </div>
        )
      }

      // Handle bold text and regular paragraphs
      const processedText = trimmedLine.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-semibold text-gray-900 dark:text-white">$1</strong>',
      )

      return (
        <p
          key={index}
          className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed"
          dangerouslySetInnerHTML={{ __html: processedText }}
        />
      )
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">Loading your assessment results...</p>
        </div>
      </div>
    )
  }

  if (!diagnosisData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <FileText className="h-20 w-20 text-gray-400 dark:text-gray-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">No Assessment Data Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8 text-lg">
            Please start a new health assessment to generate your report.
          </p>
          <button
            onClick={() => router.push("/chatbot")}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Start New Assessment
          </button>
        </div>
      </div>
    )
  }

  const TriageIcon = getTriageIcon(triageData?.triage_level || "self_care")

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300">
      <Header />

      <main className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Hero Header */}
          <div className="text-center py-12">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full mb-6">
              <Heart className="h-12 w-12 text-white" />
            </div>
            <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-4">
              Health Assessment Report
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">Generated by HealthBuddy AI</p>
            <p className="text-gray-500 dark:text-gray-500">
              Assessment Date:{" "}
              {new Date(diagnosisData.timestamp).toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>

          {/* Patient Profile Card */}
          <div className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <User className="h-7 w-7 mr-3 text-blue-500" />
              Assessment Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl mr-4">
                    <Calendar className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Age</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{diagnosisData.userAge}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">years</p>
                  </div>
                </div>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl mr-4">
                    <User className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Gender</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white capitalize">
                      {diagnosisData.userSex}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50">
                <div className="flex items-center">
                  <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-xl mr-4">
                    <FileText className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Questions</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{diagnosisData.evidence.length}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">answered</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Emergency Warning */}
          {diagnosisData.emergencySymptoms.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-3xl p-8 shadow-xl">
              <div className="flex items-start">
                <div className="p-3 bg-red-500 rounded-full mr-6 flex-shrink-0">
                  <AlertTriangle className="h-8 w-8 text-white" />
                </div>
                <div className="flex-1">
                  <h2 className="text-3xl font-bold text-red-900 dark:text-red-300 mb-6">
                    ⚠️ Emergency Symptoms Detected
                  </h2>
                  <div className="bg-red-100 dark:bg-red-900/40 rounded-2xl p-6 border border-red-200 dark:border-red-700 mb-6">
                    <p className="text-red-800 dark:text-red-300 font-semibold mb-4 text-lg">
                      Critical symptoms identified during assessment:
                    </p>
                    <div className="space-y-3">
                      {diagnosisData.emergencySymptoms.map((symptom, index) => (
                        <div
                          key={index}
                          className="flex items-center p-3 bg-white dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700"
                        >
                          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
                          <span className="font-medium text-red-800 dark:text-red-300">{symptom}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-red-600 dark:bg-red-700 text-white p-6 rounded-2xl">
                    <p className="font-bold text-xl mb-2">🚨 SEEK IMMEDIATE MEDICAL ATTENTION</p>
                    <p className="text-red-100">
                      Contact emergency services (911) or visit the nearest emergency room immediately. Do not delay
                      seeking professional medical care.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Medical Triage Assessment */}
          {triageData && (
            <div className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl mr-4">
                  <TriageIcon className="h-8 w-8 text-white" />
                </div>
                Medical Triage Assessment
              </h2>

              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                  <span className="text-xl font-medium text-gray-700 dark:text-gray-300">Urgency Level:</span>
                  <div
                    className={`px-6 py-4 rounded-2xl font-bold text-xl border-2 ${getTriageColor(triageData.triage_level)} shadow-lg inline-flex items-center`}
                  >
                    <TriageIcon className="h-6 w-6 mr-3" />
                    {triageData.triage_level?.replace("_", " ").toUpperCase()}
                  </div>
                </div>

                {/* Primary Recommendation */}
                {conditionDetails[0]?.extras?.hint && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-4 flex items-center text-lg">
                      <Stethoscope className="h-6 w-6 mr-3" />
                      Primary Recommendation:
                    </h4>
                    <p className="text-blue-800 dark:text-blue-300 font-medium leading-relaxed text-lg">
                      {conditionDetails[0].extras.hint}
                    </p>
                  </div>
                )}

                {/* Serious Conditions */}
                {triageData.serious && triageData.serious.length > 0 && (
                  <div className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-800">
                    <h4 className="font-bold text-orange-900 dark:text-orange-300 mb-4 flex items-center text-lg">
                      <AlertTriangle className="h-6 w-6 mr-3" />
                      Serious Conditions to Consider:
                    </h4>
                    <div className="grid gap-3">
                      {triageData.serious.map((condition: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center p-4 bg-white dark:bg-orange-900/10 rounded-xl border border-orange-200 dark:border-orange-700"
                        >
                          <div className="w-3 h-3 bg-orange-500 rounded-full mr-4 flex-shrink-0"></div>
                          <span className="font-semibold text-gray-900 dark:text-white text-lg">
                            {condition.common_name || condition.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Loading State for Comprehensive Analysis */}
          {comprehensiveAnalysisLoading && (
            <div className="glass rounded-3xl p-12 border border-white/20 dark:border-gray-700/50 shadow-xl">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Analyzing Clinical Data</h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Generating comprehensive report with detailed medical insights...
                </p>
              </div>
            </div>
          )}

          {/* Most Likely Conditions */}
          <div className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
              <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl mr-4">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              Most Likely Conditions & Analysis
            </h2>

            <div className="space-y-8">
              {conditionDetails.map((details, index) => {
                const condition = details.originalCondition
                const explanation = explainData.find((e) => e.conditionId === condition.id)

                return (
                  <div
                    key={condition.id}
                    className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-8 border border-gray-200/50 dark:border-gray-700/50"
                  >
                    {/* Condition Header */}
                    <div className="flex items-start justify-between mb-6">
                      <div className="flex-1">
                        <div className="flex items-center mb-4">
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl mr-6 ${
                              index === 0
                                ? "bg-gradient-to-r from-red-500 to-pink-500"
                                : index === 1
                                  ? "bg-gradient-to-r from-orange-500 to-yellow-500"
                                  : "bg-gradient-to-r from-blue-500 to-purple-500"
                            }`}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                              {condition.common_name || condition.name}
                            </h3>
                            <div className="flex items-center space-x-4">
                              <span className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                {(condition.probability * 100).toFixed(1)}%
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-lg">probability</span>
                            </div>
                          </div>
                        </div>
                        {details.extras?.icd10_code && (
                          <div className="inline-block bg-gray-100 dark:bg-gray-700 px-3 py-1 rounded-lg">
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-300">
                              ICD-10: {details.extras.icd10_code}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Clinical Information */}
                    {details.extras?.hint && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 border border-blue-200 dark:border-blue-800 mb-6">
                        <h4 className="font-bold text-blue-900 dark:text-blue-300 mb-3 flex items-center text-lg">
                          <Stethoscope className="h-6 w-6 mr-3" />
                          Clinical Information:
                        </h4>
                        <p className="text-blue-800 dark:text-blue-300 leading-relaxed text-lg">
                          {details.extras.hint}
                        </p>
                      </div>
                    )}

                    {/* Key Attributes */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      {details.severity && (
                        <div
                          className={`px-4 py-3 rounded-xl border-2 text-center ${getSeverityBadge(details.severity)}`}
                        >
                          <p className="text-xs font-bold uppercase tracking-wide mb-1">Severity</p>
                          <p className="font-bold capitalize">{details.severity}</p>
                        </div>
                      )}
                      {details.prevalence && (
                        <div
                          className={`px-4 py-3 rounded-xl border-2 text-center ${getPrevalenceBadge(details.prevalence)}`}
                        >
                          <p className="text-xs font-bold uppercase tracking-wide mb-1">Prevalence</p>
                          <p className="font-bold capitalize">{details.prevalence.replace("_", " ")}</p>
                        </div>
                      )}
                      {details.acuteness && (
                        <div className="px-4 py-3 rounded-xl border-2 text-center bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                          <p className="text-xs font-bold uppercase tracking-wide mb-1">Acuteness</p>
                          <p className="font-bold capitalize">{details.acuteness.replace("_", " ")}</p>
                        </div>
                      )}
                      {details.sex_filter && (
                        <div className="px-4 py-3 rounded-xl border-2 text-center bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-600">
                          <p className="text-xs font-bold uppercase tracking-wide mb-1">Sex Filter</p>
                          <p className="font-bold capitalize">{details.sex_filter}</p>
                        </div>
                      )}
                    </div>

                    {/* AI's Reasoning */}
                    {explanation && (
                      <div className="grid md:grid-cols-2 gap-6">
                        {/* Supporting Evidence */}
                        {explanation.supporting_evidence && explanation.supporting_evidence.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-800">
                            <h4 className="font-bold text-green-900 dark:text-green-300 mb-4 flex items-center text-lg">
                              <Check className="h-6 w-6 mr-3" />
                              Supporting Evidence:
                            </h4>
                            <div className="space-y-3">
                              {explanation.supporting_evidence.map((evidence: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center p-3 bg-white dark:bg-green-900/10 rounded-xl border border-green-200 dark:border-green-700"
                                >
                                  <Check className="h-5 w-5 text-green-600 dark:text-green-400 mr-3 flex-shrink-0" />
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {evidence.common_name || evidence.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Conflicting Evidence */}
                        {explanation.conflicting_evidence && explanation.conflicting_evidence.length > 0 && (
                          <div className="bg-red-50 dark:bg-red-900/20 rounded-2xl p-6 border border-red-200 dark:border-red-800">
                            <h4 className="font-bold text-red-900 dark:text-red-300 mb-4 flex items-center text-lg">
                              <X className="h-6 w-6 mr-3" />
                              Conflicting Evidence:
                            </h4>
                            <div className="space-y-3">
                              {explanation.conflicting_evidence.map((evidence: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center p-3 bg-white dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-700"
                                >
                                  <X className="h-5 w-5 text-red-600 dark:text-red-400 mr-3 flex-shrink-0" />
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {evidence.common_name || evidence.name}
                                  </span>
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
          </div>

          {/* Risk Factors */}
          {riskFactorDetails.length > 0 && (
            <div className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl mr-4">
                  <Target className="h-8 w-8 text-white" />
                </div>
                Relevant Risk Factors
              </h2>

              <div className="grid md:grid-cols-2 gap-6">
                {riskFactorDetails.map((riskFactor, index) => {
                  const getRiskIcon = (id: string) => {
                    if (id.includes("travel") || id.includes("residence")) return Globe
                    if (id.includes("mosquito") || id.includes("bite")) return Bug
                    return MapPin
                  }

                  const RiskIcon = getRiskIcon(riskFactor.id)

                  return (
                    <div
                      key={index}
                      className="bg-orange-50 dark:bg-orange-900/20 rounded-2xl p-6 border border-orange-200 dark:border-orange-800"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center flex-1">
                          <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl mr-4">
                            <RiskIcon className="h-6 w-6 text-white" />
                          </div>
                          <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                            {riskFactor.common_name || riskFactor.name}
                          </h3>
                        </div>
                        <span className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 font-bold rounded-full border border-green-200 dark:border-green-700">
                          Present
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-400 ml-16">Status: Present in patient profile</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Next Steps & Patient Education */}
          <div className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/50 shadow-xl">
            {loadingGemini ? (
              <div className="text-center py-16">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-6"></div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
                  Generating Personalized Guidance
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Creating comprehensive next steps and patient education content...
                </p>
              </div>
            ) : geminiError ? (
              <div className="text-center py-16">
                <AlertCircle className="h-20 w-20 text-red-400 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">Content Generation Error</h3>
                <p className="text-red-500 dark:text-red-400 text-lg">
                  Unable to generate patient education content. Please try again.
                </p>
              </div>
            ) : geminiInfo ? (
              <div className="prose prose-lg max-w-none dark:prose-invert">{renderMarkdownContent(geminiInfo)}</div>
            ) : (
              <div className="text-center py-16">
                <Clock className="h-20 w-20 text-gray-400 dark:text-gray-500 mx-auto mb-6" />
                <h3 className="text-2xl font-bold text-gray-500 dark:text-gray-400 mb-4">Preparing Content</h3>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  Patient education content is being prepared...
                </p>
              </div>
            )}

            {/* Red Flags Alert */}
            <div className="mt-8 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-2xl p-6">
              <div className="flex items-start">
                <AlertCircle className="h-8 w-8 text-red-600 dark:text-red-400 mr-4 mt-1 flex-shrink-0" />
                <div>
                  <h4 className="font-bold text-red-900 dark:text-red-300 mb-4 text-xl">
                    Red Flags - Seek Immediate Care If:
                  </h4>
                  <div className="grid gap-3">
                    {[
                      "Difficulty breathing or shortness of breath",
                      "Severe chest pain or pressure",
                      "High fever (over 103°F/39.4°C) that doesn't respond to medication",
                      "Severe headache with neck stiffness",
                      "Confusion or altered mental state",
                      "Persistent vomiting or inability to keep fluids down",
                      "Signs of severe dehydration",
                    ].map((symptom, index) => (
                      <div
                        key={index}
                        className="flex items-start p-3 bg-white dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-700"
                      >
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-4 mt-2 flex-shrink-0"></div>
                        <span className="text-red-800 dark:text-red-300 font-medium">{symptom}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Important Disclaimer */}
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-3xl p-8 shadow-xl">
            <div className="flex items-start">
              <div className="p-3 bg-red-500 rounded-full mr-6 flex-shrink-0">
                <ShieldAlert className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-red-900 dark:text-red-300 mb-6">Crucial Disclaimer</h2>
                <div className="text-red-800 dark:text-red-300 space-y-4 leading-relaxed text-lg">
                  <p className="font-bold text-xl">
                    This AI-generated assessment is for educational and informational purposes only.
                  </p>
                  <p>
                    The results are based on artificial intelligence analysis of reported symptoms and should
                    <strong className="font-bold"> never replace professional medical consultation</strong>. Medical
                    conditions require proper evaluation by qualified healthcare providers.
                  </p>
                  <p>Always consult with a licensed physician, specialist, or healthcare provider for:</p>
                  <div className="grid gap-3 mt-4">
                    {[
                      "Proper medical diagnosis and evaluation",
                      "Treatment recommendations and medical advice",
                      "Emergency medical situations",
                      "Any health concerns or symptoms",
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center p-3 bg-white dark:bg-red-900/10 rounded-xl border border-red-200 dark:border-red-700"
                      >
                        <div className="w-2 h-2 bg-red-500 rounded-full mr-4"></div>
                        <span className="font-medium">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-red-100 dark:bg-red-900/40 rounded-2xl p-6 border border-red-300 dark:border-red-700 mt-6">
                    <p className="font-bold text-xl">
                      <strong>Emergency Note:</strong> If you are experiencing a medical emergency, call emergency
                      services (911) immediately or visit your nearest emergency room.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center pt-8">
            <button
              onClick={downloadResults}
              className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Download className="h-6 w-6 mr-3" />
              Download Report
            </button>
            <button
              onClick={() => router.push("/chatbot")}
              className="flex items-center justify-center px-8 py-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-2xl hover:from-green-700 hover:to-blue-700 transition-all duration-300 font-bold text-lg shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <Activity className="h-6 w-6 mr-3" />
              New Assessment
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
