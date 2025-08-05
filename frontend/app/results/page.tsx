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
  Lightbulb,
  BookOpen,
  Zap,
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
        return "text-red-600 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-900/50"
      case "consultation_24":
        return "text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-900/50"
      case "consultation":
        return "text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-300 dark:bg-yellow-950/30 dark:border-yellow-900/50"
      default:
        return "text-green-600 bg-green-50 border-green-200 dark:text-green-300 dark:bg-green-950/30 dark:border-green-900/50"
    }
  }

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "severe":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/50"
      case "moderate":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900/50"
      case "mild":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900/50"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-200 dark:border-gray-700/50"
    }
  }

  const getPrevalenceBadge = (prevalence: string) => {
    switch (prevalence) {
      case "very_rare":
        return "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/50"
      case "rare":
        return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-200 dark:border-orange-900/50"
      case "common":
        return "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900/50"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800/50 dark:text-gray-200 dark:border-gray-700/50"
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
          <div key={index} className="group animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex items-center mb-6 mt-8">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl mr-4 group-hover:scale-110 transition-transform duration-300">
                <BookOpen className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                {trimmedLine.replace("## ", "")}
              </h2>
            </div>
            <div className="w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full mb-6 opacity-20"></div>
          </div>
        )
      }

      // Handle H3 headers (###)
      if (trimmedLine.startsWith("### ")) {
        return (
          <div key={index} className="group animate-fade-in-up" style={{ animationDelay: `${index * 50}ms` }}>
            <div className="flex items-center mt-8 mb-4">
              <div className="p-2 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-lg mr-3 group-hover:scale-110 transition-transform duration-300">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{trimmedLine.replace("### ", "")}</h3>
            </div>
          </div>
        )
      }

      // Handle bullet points
      if (trimmedLine.startsWith("- ")) {
        return (
          <div
            key={index}
            className="group animate-fade-in-up hover:bg-blue-50/50 dark:hover:bg-blue-950/20 rounded-xl p-4 transition-all duration-300 hover:shadow-md"
            style={{ animationDelay: `${index * 30}ms` }}
          >
            <div className="flex items-start">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg mr-4 mt-1 group-hover:scale-110 transition-transform duration-300">
                <Zap className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1">
                <p
                  className="text-gray-700 dark:text-gray-200 leading-relaxed text-lg font-medium"
                  dangerouslySetInnerHTML={{
                    __html: trimmedLine
                      .replace("- ", "")
                      .replace(
                        /\*\*(.*?)\*\*/g,
                        '<span class="font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">$1</span>',
                      ),
                  }}
                />
              </div>
            </div>
          </div>
        )
      }

      // Handle bold text and regular paragraphs
      const processedText = trimmedLine.replace(
        /\*\*(.*?)\*\*/g,
        '<span class="font-bold text-gray-900 dark:text-white bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">$1</span>',
      )

      return (
        <div
          key={index}
          className="animate-fade-in-up hover:bg-gray-50/50 dark:hover:bg-gray-800/30 rounded-xl p-4 transition-all duration-300"
          style={{ animationDelay: `${index * 30}ms` }}
        >
          <p
            className="text-gray-700 dark:text-gray-200 leading-relaxed text-lg"
            dangerouslySetInnerHTML={{ __html: processedText }}
          />
        </div>
      )
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-500">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-500/30 border-t-blue-500 mx-auto mb-8"></div>
            <div className="absolute inset-0 rounded-full h-20 w-20 border-4 border-purple-500/20 border-t-purple-500 mx-auto animate-spin animate-reverse"></div>
          </div>
          <div className="space-y-2">
            <p className="text-gray-600 dark:text-gray-300 text-xl font-semibold animate-pulse">
              Loading your assessment results...
            </p>
            <div className="flex justify-center space-x-1">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
              <div
                className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"
                style={{ animationDelay: "0.1s" }}
              ></div>
              <div
                className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce"
                style={{ animationDelay: "0.2s" }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!diagnosisData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center transition-colors duration-500">
        <div className="text-center max-w-md mx-auto p-8 animate-fade-in-up">
          <div className="relative mb-8">
            <FileText className="h-24 w-24 text-gray-400 dark:text-gray-500 mx-auto" />
            <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
              <X className="h-4 w-4 text-white" />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">No Assessment Data Found</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 text-lg leading-relaxed">
            Please start a new health assessment to generate your comprehensive report.
          </p>
          <button
            onClick={() => router.push("/chatbot")}
            className="group px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 hover:-translate-y-1"
          >
            <div className="flex items-center">
              <Activity className="h-6 w-6 mr-3 group-hover:rotate-12 transition-transform duration-300" />
              Start New Assessment
            </div>
          </button>
        </div>
      </div>
    )
  }

  const TriageIcon = getTriageIcon(triageData?.triage_level || "self_care")

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-500">
      <Header />

      <main className="pt-20 pb-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          {/* Hero Header */}
          <div className="text-center py-16 animate-fade-in-up">
            <div className="relative inline-flex items-center justify-center mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur-xl opacity-30 animate-pulse"></div>
              <div className="relative p-6 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-2xl">
                <Heart className="h-16 w-16 text-white animate-pulse" />
              </div>
            </div>
            <h1 className="text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6 animate-fade-in-up">
              Health Assessment Report
            </h1>
            <p
              className="text-2xl text-gray-600 dark:text-gray-300 mb-4 animate-fade-in-up"
              style={{ animationDelay: "0.2s" }}
            >
              Generated by HealthBuddy AI
            </p>
            <div
              className="inline-flex items-center px-6 py-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-full border border-gray-200/50 dark:border-gray-700/50 shadow-lg animate-fade-in-up"
              style={{ animationDelay: "0.4s" }}
            >
              <Calendar className="h-5 w-5 text-gray-500 dark:text-gray-400 mr-2" />
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                Assessment Date:{" "}
                {new Date(diagnosisData.timestamp).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
          </div>

          {/* Patient Profile Card */}
          <div
            className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/30 shadow-2xl backdrop-blur-xl animate-fade-in-up hover:shadow-3xl transition-all duration-500"
            style={{ animationDelay: "0.1s" }}
          >
            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl mr-4 shadow-lg">
                <User className="h-8 w-8 text-white" />
              </div>
              Assessment Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: Calendar,
                  label: "Age",
                  value: diagnosisData.userAge,
                  unit: "years",
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  icon: User,
                  label: "Gender",
                  value: diagnosisData.userSex,
                  unit: "",
                  color: "from-purple-500 to-pink-500",
                },
                {
                  icon: FileText,
                  label: "Questions",
                  value: diagnosisData.evidence.length,
                  unit: "answered",
                  color: "from-green-500 to-emerald-500",
                },
              ].map((item, index) => (
                <div
                  key={index}
                  className="group bg-white/60 dark:bg-gray-800/40 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-800/60 transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
                >
                  <div className="flex items-center">
                    <div
                      className={`p-4 bg-gradient-to-r ${item.color} rounded-xl mr-4 shadow-lg group-hover:scale-110 transition-transform duration-300`}
                    >
                      <item.icon className="h-7 w-7 text-white" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">
                        {item.label}
                      </p>
                      <p className="text-3xl font-bold text-gray-900 dark:text-white">
                        {typeof item.value === "string"
                          ? item.value.charAt(0).toUpperCase() + item.value.slice(1)
                          : item.value}
                      </p>
                      {item.unit && <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{item.unit}</p>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Emergency Warning */}
          {diagnosisData.emergencySymptoms.length > 0 && (
            <div
              className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-l-4 border-red-500 rounded-3xl p-8 shadow-2xl animate-fade-in-up backdrop-blur-sm"
              style={{ animationDelay: "0.2s" }}
            >
              <div className="flex items-start">
                <div className="relative p-4 bg-red-500 rounded-full mr-6 flex-shrink-0 shadow-lg">
                  <AlertTriangle className="h-10 w-10 text-white animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-yellow-400 rounded-full animate-ping"></div>
                </div>
                <div className="flex-1">
                  <h2 className="text-4xl font-bold text-red-900 dark:text-red-200 mb-8">
                    ⚠️ Emergency Symptoms Detected
                  </h2>
                  <div className="bg-red-100/80 dark:bg-red-950/40 rounded-2xl p-6 border border-red-200 dark:border-red-800/50 mb-6 backdrop-blur-sm">
                    <p className="text-red-800 dark:text-red-200 font-bold mb-6 text-xl">
                      Critical symptoms identified during assessment:
                    </p>
                    <div className="grid gap-4">
                      {diagnosisData.emergencySymptoms.map((symptom, index) => (
                        <div
                          key={index}
                          className="flex items-center p-4 bg-white/80 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-800/50 hover:shadow-lg transition-all duration-300 animate-fade-in-up"
                          style={{ animationDelay: `${0.1 * index}s` }}
                        >
                          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mr-4 flex-shrink-0" />
                          <span className="font-semibold text-red-800 dark:text-red-200 text-lg">{symptom}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-8 rounded-2xl shadow-xl">
                    <p className="font-bold text-2xl mb-3">🚨 SEEK IMMEDIATE MEDICAL ATTENTION</p>
                    <p className="text-red-100 text-lg leading-relaxed">
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
            <div
              className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/30 shadow-2xl backdrop-blur-xl animate-fade-in-up hover:shadow-3xl transition-all duration-500"
              style={{ animationDelay: "0.3s" }}
            >
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-8 flex items-center">
                <div className="p-4 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl mr-4 shadow-lg">
                  <TriageIcon className="h-10 w-10 text-white" />
                </div>
                Medical Triage Assessment
              </h2>

              <div className="space-y-8">
                <div className="flex flex-col lg:flex-row lg:items-center space-y-6 lg:space-y-0 lg:space-x-8">
                  <span className="text-2xl font-semibold text-gray-700 dark:text-gray-200">Urgency Level:</span>
                  <div
                    className={`px-8 py-6 rounded-2xl font-bold text-2xl border-2 ${getTriageColor(triageData.triage_level)} shadow-xl inline-flex items-center hover:scale-105 transition-transform duration-300`}
                  >
                    <TriageIcon className="h-8 w-8 mr-4" />
                    {triageData.triage_level?.replace("_", " ").toUpperCase()}
                  </div>
                </div>

                {/* Primary Recommendation */}
                {conditionDetails[0]?.extras?.hint && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-800/50 shadow-lg hover:shadow-xl transition-all duration-300">
                    <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-6 flex items-center text-2xl">
                      <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl mr-4 shadow-lg">
                        <Stethoscope className="h-7 w-7 text-white" />
                      </div>
                      Primary Recommendation:
                    </h4>
                    <p className="text-blue-800 dark:text-blue-200 font-medium leading-relaxed text-xl bg-white/50 dark:bg-blue-950/20 p-6 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
                      {conditionDetails[0].extras.hint}
                    </p>
                  </div>
                )}

                {/* Serious Conditions */}
                {triageData.serious && triageData.serious.length > 0 && (
                  <div className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 rounded-2xl p-8 border border-orange-200 dark:border-orange-800/50 shadow-lg">
                    <h4 className="font-bold text-orange-900 dark:text-orange-200 mb-6 flex items-center text-2xl">
                      <div className="p-3 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl mr-4 shadow-lg">
                        <AlertTriangle className="h-7 w-7 text-white" />
                      </div>
                      Serious Conditions to Consider:
                    </h4>
                    <div className="grid gap-4">
                      {triageData.serious.map((condition: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center p-6 bg-white/80 dark:bg-orange-950/20 rounded-xl border border-orange-200 dark:border-orange-700/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                          style={{ animationDelay: `${0.1 * index}s` }}
                        >
                          <div className="w-4 h-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mr-6 flex-shrink-0 shadow-lg"></div>
                          <span className="font-bold text-gray-900 dark:text-white text-xl">
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
            <div className="glass rounded-3xl p-16 border border-white/20 dark:border-gray-700/30 shadow-2xl backdrop-blur-xl animate-fade-in-up">
              <div className="text-center">
                <div className="relative mb-8">
                  <div className="animate-spin rounded-full h-20 w-20 border-4 border-blue-500/30 border-t-blue-500 mx-auto"></div>
                  <div className="absolute inset-0 rounded-full h-20 w-20 border-4 border-purple-500/20 border-t-purple-500 mx-auto animate-spin animate-reverse"></div>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">Analyzing Clinical Data</h3>
                <p className="text-gray-600 dark:text-gray-300 text-xl">
                  Generating comprehensive report with detailed medical insights...
                </p>
                <div className="flex justify-center space-x-2 mt-6">
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-3 h-3 bg-indigo-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {/* Most Likely Conditions */}
          <div
            className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/30 shadow-2xl backdrop-blur-xl animate-fade-in-up hover:shadow-3xl transition-all duration-500"
            style={{ animationDelay: "0.4s" }}
          >
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-10 flex items-center">
              <div className="p-4 bg-gradient-to-r from-green-500 to-blue-500 rounded-xl mr-4 shadow-lg">
                <TrendingUp className="h-10 w-10 text-white" />
              </div>
              Most Likely Conditions & Analysis
            </h2>

            <div className="space-y-10">
              {conditionDetails.map((details, index) => {
                const condition = details.originalCondition
                const explanation = explainData.find((e) => e.conditionId === condition.id)

                return (
                  <div
                    key={condition.id}
                    className="bg-white/60 dark:bg-gray-800/40 rounded-3xl p-8 border border-gray-200/50 dark:border-gray-700/30 hover:bg-white/80 dark:hover:bg-gray-800/60 transition-all duration-500 hover:shadow-2xl hover:-translate-y-2 animate-fade-in-up"
                    style={{ animationDelay: `${0.1 * index}s` }}
                  >
                    {/* Condition Header */}
                    <div className="flex items-start justify-between mb-8">
                      <div className="flex-1">
                        <div className="flex items-center mb-6">
                          <div
                            className={`w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-2xl mr-6 shadow-2xl ${
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
                            <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-3">
                              {condition.common_name || condition.name}
                            </h3>
                            <div className="flex items-center space-x-6">
                              <span className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                {(condition.probability * 100).toFixed(1)}%
                              </span>
                              <span className="text-gray-500 dark:text-gray-400 text-xl font-medium">probability</span>
                            </div>
                          </div>
                        </div>
                        {details.extras?.icd10_code && (
                          <div className="inline-block bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 px-4 py-2 rounded-xl shadow-lg">
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-300 font-semibold">
                              ICD-10: {details.extras.icd10_code}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Clinical Information */}
                    {details.extras?.hint && (
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-2xl p-8 border border-blue-200 dark:border-blue-800/50 mb-8 shadow-lg hover:shadow-xl transition-all duration-300">
                        <h4 className="font-bold text-blue-900 dark:text-blue-200 mb-4 flex items-center text-2xl">
                          <div className="p-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl mr-4 shadow-lg">
                            <Stethoscope className="h-7 w-7 text-white" />
                          </div>
                          Clinical Information:
                        </h4>
                        <p className="text-blue-800 dark:text-blue-200 leading-relaxed text-xl font-medium bg-white/50 dark:bg-blue-950/20 p-6 rounded-xl border border-blue-200/50 dark:border-blue-800/30">
                          {details.extras.hint}
                        </p>
                      </div>
                    )}

                    {/* Key Attributes */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                      {[
                        { key: "severity", value: details.severity, colors: getSeverityBadge(details.severity) },
                        {
                          key: "prevalence",
                          value: details.prevalence,
                          colors: getPrevalenceBadge(details.prevalence),
                        },
                        {
                          key: "acuteness",
                          value: details.acuteness,
                          colors:
                            "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-200 border-purple-300 dark:border-purple-700/50",
                        },
                        {
                          key: "sex_filter",
                          value: details.sex_filter,
                          colors:
                            "bg-gray-100 dark:bg-gray-800/50 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600/50",
                        },
                      ]
                        .filter((attr) => attr.value)
                        .map((attr, idx) => (
                          <div
                            key={idx}
                            className={`px-6 py-4 rounded-xl border-2 text-center ${attr.colors} hover:scale-105 transition-transform duration-300 shadow-lg`}
                          >
                            <p className="text-xs font-bold uppercase tracking-wider mb-2">
                              {attr.key.replace("_", " ")}
                            </p>
                            <p className="font-bold capitalize text-lg">{attr.value.replace("_", " ")}</p>
                          </div>
                        ))}
                    </div>

                    {/* AI's Reasoning */}
                    {explanation && (
                      <div className="grid md:grid-cols-2 gap-8">
                        {/* Supporting Evidence */}
                        {explanation.supporting_evidence && explanation.supporting_evidence.length > 0 && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-2xl p-8 border border-green-200 dark:border-green-800/50 shadow-lg hover:shadow-xl transition-all duration-300">
                            <h4 className="font-bold text-green-900 dark:text-green-200 mb-6 flex items-center text-2xl">
                              <div className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl mr-4 shadow-lg">
                                <Check className="h-7 w-7 text-white" />
                              </div>
                              Supporting Evidence:
                            </h4>
                            <div className="space-y-4">
                              {explanation.supporting_evidence.map((evidence: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center p-4 bg-white/80 dark:bg-green-950/20 rounded-xl border border-green-200 dark:border-green-700/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                                  style={{ animationDelay: `${0.05 * idx}s` }}
                                >
                                  <Check className="h-6 w-6 text-green-600 dark:text-green-400 mr-4 flex-shrink-0" />
                                  <span className="font-semibold text-gray-900 dark:text-white text-lg">
                                    {evidence.common_name || evidence.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Conflicting Evidence */}
                        {explanation.conflicting_evidence && explanation.conflicting_evidence.length > 0 && (
                          <div className="bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 rounded-2xl p-8 border border-red-200 dark:border-red-800/50 shadow-lg hover:shadow-xl transition-all duration-300">
                            <h4 className="font-bold text-red-900 dark:text-red-200 mb-6 flex items-center text-2xl">
                              <div className="p-3 bg-gradient-to-r from-red-500 to-pink-500 rounded-xl mr-4 shadow-lg">
                                <X className="h-7 w-7 text-white" />
                              </div>
                              Conflicting Evidence:
                            </h4>
                            <div className="space-y-4">
                              {explanation.conflicting_evidence.map((evidence: any, idx: number) => (
                                <div
                                  key={idx}
                                  className="flex items-center p-4 bg-white/80 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-700/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                                  style={{ animationDelay: `${0.05 * idx}s` }}
                                >
                                  <X className="h-6 w-6 text-red-600 dark:text-red-400 mr-4 flex-shrink-0" />
                                  <span className="font-semibold text-gray-900 dark:text-white text-lg">
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
            <div
              className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/30 shadow-2xl backdrop-blur-xl animate-fade-in-up hover:shadow-3xl transition-all duration-500"
              style={{ animationDelay: "0.5s" }}
            >
              <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-10 flex items-center">
                <div className="p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl mr-4 shadow-lg">
                  <Target className="h-10 w-10 text-white" />
                </div>
                Relevant Risk Factors
              </h2>

              <div className="grid md:grid-cols-2 gap-8">
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
                      className="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/20 dark:to-red-950/20 rounded-2xl p-8 border border-orange-200 dark:border-orange-800/50 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fade-in-up"
                      style={{ animationDelay: `${0.1 * index}s` }}
                    >
                      <div className="flex items-start justify-between mb-6">
                        <div className="flex items-center flex-1">
                          <div className="p-4 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl mr-6 shadow-lg hover:scale-110 transition-transform duration-300">
                            <RiskIcon className="h-8 w-8 text-white" />
                          </div>
                          <h3 className="font-bold text-gray-900 dark:text-white text-2xl">
                            {riskFactor.common_name || riskFactor.name}
                          </h3>
                        </div>
                        <span className="px-6 py-3 bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 text-green-800 dark:text-green-200 font-bold rounded-full border border-green-200 dark:border-green-700/50 shadow-lg">
                          Present
                        </span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 ml-20 text-lg font-medium">
                        Status: Present in patient profile
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Next Steps & Patient Education */}
          <div
            className="glass rounded-3xl p-8 border border-white/20 dark:border-gray-700/30 shadow-2xl backdrop-blur-xl animate-fade-in-up hover:shadow-3xl transition-all duration-500"
            style={{ animationDelay: "0.6s" }}
          >
            {loadingGemini ? (
              <div className="text-center py-20">
                <div className="relative mb-10">
                  <div className="animate-spin rounded-full h-24 w-24 border-4 border-blue-500/30 border-t-blue-500 mx-auto"></div>
                  <div className="absolute inset-0 rounded-full h-24 w-24 border-4 border-purple-500/20 border-t-purple-500 mx-auto animate-spin animate-reverse"></div>
                </div>
                <h3 className="text-3xl font-bold text-gray-900 dark:text-white mb-6">
                  Generating Personalized Guidance
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-xl">
                  Creating comprehensive next steps and patient education content...
                </p>
                <div className="flex justify-center space-x-2 mt-8">
                  <div className="w-4 h-4 bg-blue-500 rounded-full animate-bounce"></div>
                  <div
                    className="w-4 h-4 bg-purple-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-4 h-4 bg-indigo-500 rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            ) : geminiError ? (
              <div className="text-center py-20">
                <div className="relative mb-8">
                  <AlertCircle className="h-24 w-24 text-red-400 mx-auto" />
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                    <X className="h-4 w-4 text-white" />
                  </div>
                </div>
                <h3 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-6">Content Generation Error</h3>
                <p className="text-red-500 dark:text-red-400 text-xl">
                  Unable to generate patient education content. Please try again.
                </p>
              </div>
            ) : geminiInfo ? (
              <div className="prose prose-xl max-w-none dark:prose-invert">{renderMarkdownContent(geminiInfo)}</div>
            ) : (
              <div className="text-center py-20">
                <div className="relative mb-8">
                  <Clock className="h-24 w-24 text-gray-400 dark:text-gray-500 mx-auto animate-pulse" />
                  <div className="absolute inset-0 rounded-full border-4 border-gray-300 dark:border-gray-600 animate-spin opacity-20"></div>
                </div>
                <h3 className="text-3xl font-bold text-gray-500 dark:text-gray-400 mb-6">Preparing Content</h3>
                <p className="text-gray-500 dark:text-gray-400 text-xl">
                  Patient education content is being prepared...
                </p>
              </div>
            )}

            {/* Red Flags Alert */}
            <div className="mt-12 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-950/20 dark:to-pink-950/20 border-l-4 border-red-500 rounded-2xl p-8 shadow-xl">
              <div className="flex items-start">
                <div className="p-4 bg-red-500 rounded-full mr-6 flex-shrink-0 shadow-lg">
                  <AlertCircle className="h-10 w-10 text-white" />
                </div>
                <div>
                  <h4 className="font-bold text-red-900 dark:text-red-200 mb-6 text-2xl">
                    Red Flags - Seek Immediate Care If:
                  </h4>
                  <div className="grid gap-4">
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
                        className="flex items-start p-4 bg-white/80 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-700/50 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
                        style={{ animationDelay: `${0.05 * index}s` }}
                      >
                        <div className="w-4 h-4 bg-red-500 rounded-full mr-6 mt-2 flex-shrink-0 shadow-lg"></div>
                        <span className="text-red-800 dark:text-red-200 font-semibold text-lg">{symptom}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Important Disclaimer */}
          <div
            className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-950/20 dark:to-orange-950/20 border-l-4 border-red-500 rounded-3xl p-8 shadow-2xl animate-fade-in-up backdrop-blur-sm"
            style={{ animationDelay: "0.7s" }}
          >
            <div className="flex items-start">
              <div className="p-4 bg-red-500 rounded-full mr-6 flex-shrink-0 shadow-lg">
                <ShieldAlert className="h-10 w-10 text-white" />
              </div>
              <div>
                <h2 className="text-4xl font-bold text-red-900 dark:text-red-200 mb-8">Crucial Disclaimer</h2>
                <div className="text-red-800 dark:text-red-200 space-y-6 leading-relaxed text-xl">
                  <p className="font-bold text-2xl">
                    This AI-generated assessment is for educational and informational purposes only.
                  </p>
                  <p>
                    The results are based on artificial intelligence analysis of reported symptoms and should
                    <strong className="font-bold"> never replace professional medical consultation</strong>. Medical
                    conditions require proper evaluation by qualified healthcare providers.
                  </p>
                  <p>Always consult with a licensed physician, specialist, or healthcare provider for:</p>
                  <div className="grid gap-4 mt-6">
                    {[
                      "Proper medical diagnosis and evaluation",
                      "Treatment recommendations and medical advice",
                      "Emergency medical situations",
                      "Any health concerns or symptoms",
                    ].map((item, index) => (
                      <div
                        key={index}
                        className="flex items-center p-4 bg-white/80 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-700/50 hover:shadow-lg transition-all duration-300 animate-fade-in-up"
                        style={{ animationDelay: `${0.05 * index}s` }}
                      >
                        <div className="w-3 h-3 bg-red-500 rounded-full mr-6 shadow-lg"></div>
                        <span className="font-semibold text-lg">{item}</span>
                      </div>
                    ))}
                  </div>
                  <div className="bg-gradient-to-r from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40 rounded-2xl p-8 border border-red-300 dark:border-red-700/50 mt-8 shadow-lg">
                    <p className="font-bold text-2xl">
                      <strong>Emergency Note:</strong> If you are experiencing a medical emergency, call emergency
                      services (911) immediately or visit your nearest emergency room.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-8 justify-center pt-12 animate-fade-in-up"
            style={{ animationDelay: "0.8s" }}
          >
            <button
              onClick={downloadResults}
              className="group flex items-center justify-center px-10 py-5 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-2xl hover:from-blue-700 hover:to-purple-700 transition-all duration-300 font-bold text-xl shadow-2xl hover:shadow-3xl transform hover:scale-105 hover:-translate-y-2"
            >
              <Download className="h-7 w-7 mr-4 group-hover:rotate-12 transition-transform duration-300" />
              Download Report
            </button>
            <button
              onClick={() => router.push("/chatbot")}
              className="group flex items-center justify-center px-10 py-5 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-2xl hover:from-green-700 hover:to-blue-700 transition-all duration-300 font-bold text-xl shadow-2xl hover:shadow-3xl transform hover:scale-105 hover:-translate-y-2"
            >
              <Activity className="h-7 w-7 mr-4 group-hover:rotate-12 transition-transform duration-300" />
              New Assessment
            </button>
          </div>
        </div>
      </main>

      <Footer />

      <style jsx>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
        
        .animate-reverse {
          animation-direction: reverse;
        }
        
        .glass {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
        }
        
        .dark .glass {
          background: rgba(17, 24, 39, 0.7);
        }
        
        .hover\:shadow-3xl:hover {
          box-shadow: 0 35px 60px -12px rgba(0, 0, 0, 0.25);
        }
      `}</style>
    </div>
  )
}
