"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import {
  type Condition,
  type DiagnosisData,
  getTriageResult,
  getConditionDetails,
  getRiskFactorDetails,
  getExplainationRes,
} from "../../lib/api/healthAPI"
import { useGeminiAI, useExplanation } from "../../lib/hooks/useHealthAPI"

import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Download,
  Calendar,
  User,
  MapPin,
  Clock,
  TrendingUp,
  Info,
  Heart,
  Brain,
  Shield,
  Stethoscope,
  FileText,
  Zap,
  Target,
  Award,
  AlertCircle,
  ChevronRight,
  Thermometer,
  Bug,
  Globe,
  Microscope,
  BookOpen,
  Star,
  Sparkles,
} from "lucide-react"

export default function ResultsPage() {
  const router = useRouter()
  const [diagnosisData, setDiagnosisData] = useState<DiagnosisData | null>(null)
  const [loading, setLoading] = useState(true)
  const [geminiInfo, setGeminiInfo] = useState<string>("")

  // New state for comprehensive API data
  const [triageData, setTriageData] = useState<any>(null)
  const [conditionDetails, setConditionDetails] = useState<any>(null)
  const [riskFactorDetails, setRiskFactorDetails] = useState<any[]>([])
  const [explainData, setExplainData] = useState<any>(null)
  const [comprehensiveAnalysisLoading, setComprehensiveAnalysisLoading] = useState(false)

  // 🎣 Using the hooks instead of manual state management
  const { askAI, isLoading: loadingGemini, error: geminiError } = useGeminiAI()
  const { getExplanation, isLoading: loadingExplanation, error: explanationError } = useExplanation()

  useEffect(() => {
    // Get diagnosis data from localStorage
    const storedData = localStorage.getItem("diagnosisResults")
    if (storedData) {
      try {
        const data = JSON.parse(storedData)
        setDiagnosisData(data)

        // Start comprehensive analysis
        if (data.conditions && data.conditions.length > 0) {
          fetchComprehensiveAnalysis(data)
        }
      } catch (error) {
        console.error("Error parsing diagnosis data:", error)
        router.push("/chatbot")
      }
    } else {
      // No data found, redirect to chatbot
      router.push("/chatbot")
    }
    setLoading(false)
  }, [router])

  const fetchComprehensiveAnalysis = async (data: DiagnosisData) => {
    setComprehensiveAnalysisLoading(true)

    try {
      console.log("🚀 Starting comprehensive analysis...")

      const topCondition = data.conditions[0]

      // 1. Get triage assessment
      console.log("📊 Fetching triage assessment...")
      const triage = await getTriageResult(
        { value: data.userAge!, unit: "year" },
        { value: data.userSex! },
        data.evidence,
        data.interviewId!,
      )
      setTriageData(triage)
      console.log("✅ Triage data received:", triage.triage_level)

      // 2. Get detailed condition information
      console.log("🔍 Fetching condition details...")
      const conditionInfo = await getConditionDetails(
        topCondition.id,
        data.interviewId!,
        data.userAge || undefined,
        data.userSex || undefined,
      )
      setConditionDetails(conditionInfo)
      console.log("✅ Condition details received:", conditionInfo.common_name)

      // 3. Get risk factor details
      console.log("🎯 Fetching risk factor details...")
      const riskFactorIds = data.evidence.filter((e) => e.id.startsWith("p_") && e.choice_id === "present").slice(0, 5) // Limit to 5 to avoid too many requests

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
      console.log("✅ Risk factors received:", riskFactors.length)

      // 4. Get explanation for top condition
      console.log("📖 Fetching explanation...")
      const explanation = await getExplainationRes({
        age: { value: data.userAge!, unit: "year" },
        sex: { value: data.userSex! },
        evidence: data.evidence,
        target_condition: topCondition.id,
        interviewId: data.interviewId!,
      })
      setExplainData(explanation)
      console.log("✅ Explanation received")

      // 5. Create comprehensive Gemini prompt with all data
      await createAdvancedMedicalAnalysis({
        diagnosisData: data,
        triageData: triage,
        conditionDetails: conditionInfo,
        riskFactorDetails: riskFactors,
        explainData: explanation,
        topCondition,
      })
    } catch (error) {
      console.error("❌ Comprehensive analysis failed:", error)
      setGeminiInfo("Unable to complete comprehensive analysis. Please try again.")
    } finally {
      setComprehensiveAnalysisLoading(false)
    }
  }

  const createAdvancedMedicalAnalysis = async (allData: {
    diagnosisData: DiagnosisData
    triageData: any
    conditionDetails: any
    riskFactorDetails: any[]
    explainData: any
    topCondition: Condition
  }) => {
    const { diagnosisData, triageData, conditionDetails, riskFactorDetails, explainData, topCondition } = allData

    // Enhanced medical prompt with structured analysis
    const advancedMedicalPrompt = `You are Dr. HealthBuddy, a world-renowned medical AI specialist with expertise in infectious diseases, tropical medicine, and clinical diagnostics. Provide a comprehensive, professional medical analysis based on this detailed clinical assessment:

🏥 **CLINICAL CASE SUMMARY**
═══════════════════════════════════════════════════════════════

**PATIENT DEMOGRAPHICS:**
• Age: ${diagnosisData.userAge} years old ${diagnosisData.userSex}
• Geographic Location: ${diagnosisData.userLocation || "Not specified"}
• Assessment Date: ${new Date(diagnosisData.timestamp).toLocaleDateString()}
• Clinical Interview Questions: ${diagnosisData.questionCount}

**EMERGENCY TRIAGE ASSESSMENT:**
• 🚨 Urgency Classification: **${triageData.triage_level?.toUpperCase()}**
• Root Cause Analysis: ${triageData.root_cause}
• Teleconsultation Applicable: ${triageData.teleconsultation_applicable ? "Yes" : "No"}
• Serious Findings: ${triageData.serious?.map((s: any) => `${s.common_name} (${s.seriousness})`).join(", ") || "None flagged"}

**PRIMARY DIAGNOSIS:**
• Condition: **${topCondition.common_name || topCondition.name}**
• Clinical Confidence: **${(topCondition.probability * 100).toFixed(1)}%**
• ICD-10 Classification: ${conditionDetails.extras?.icd10_code || "Not available"}
• Medical Category: ${conditionDetails.categories?.join(", ") || "General"}
• Disease Severity: ${conditionDetails.severity}
• Clinical Acuteness: ${conditionDetails.acuteness}
• Population Prevalence: ${conditionDetails.prevalence}
• Specialist Recommendation: ${conditionDetails.extras?.hint || "General medical consultation"}

**CLINICAL EVIDENCE ANALYSIS:**
Supporting Evidence (${explainData?.supporting_evidence?.length || 0} findings):
${explainData?.supporting_evidence?.map((e: any) => `• ✅ ${e.common_name || e.name}`).join("\n") || "• No supporting evidence documented"}

Conflicting Evidence (${explainData?.conflicting_evidence?.length || 0} findings):
${explainData?.conflicting_evidence?.map((e: any) => `• ❌ ${e.common_name || e.name}`).join("\n") || "• No conflicting evidence found"}

**RISK FACTOR PROFILE:**
${
  riskFactorDetails.map((rf) => `• 🎯 ${rf.common_name || rf.name} (Category: ${rf.category})`).join("\n") ||
  "• No significant risk factors identified"
}

**DIFFERENTIAL DIAGNOSIS:**
${diagnosisData.conditions
  .slice(1, 4)
  .map((c, i) => `${i + 2}. ${c.common_name || c.name} - ${(c.probability * 100).toFixed(1)}% probability`)
  .join("\n")}

═══════════════════════════════════════════════════════════════

**REQUESTED MEDICAL ANALYSIS:**

Please provide a comprehensive, evidence-based medical analysis structured as follows:

## 🔬 **CLINICAL ASSESSMENT SUMMARY**
Provide a concise but thorough clinical summary of this case, highlighting the key diagnostic findings and their significance.

## ⚠️ **URGENCY & RISK STRATIFICATION**
Analyze the emergency triage level and explain why this case requires ${triageData.triage_level} attention. Discuss any immediate risks or complications.

## 🧬 **PATHOPHYSIOLOGY & DISEASE MECHANISM**
Explain the underlying disease process, how the condition develops, and why the patient's risk factors contribute to this diagnosis.

## 📊 **EVIDENCE CORRELATION ANALYSIS**
Analyze how the supporting evidence strengthens the diagnosis and address any conflicting findings. Explain the clinical significance of each key symptom.

## 🌍 **EPIDEMIOLOGICAL CONTEXT**
Discuss the geographic and demographic factors that influence this diagnosis, especially considering the patient's location and travel history.

## 🏥 **CLINICAL MANAGEMENT RECOMMENDATIONS**
Provide specific, actionable recommendations for:
- Immediate care requirements
- Diagnostic tests that should be performed
- Treatment considerations
- Specialist referrals needed
- Follow-up care plan

## 🚨 **RED FLAG SYMPTOMS & COMPLICATIONS**
List specific warning signs the patient should monitor for that would require immediate emergency care.

## 📚 **PATIENT EDUCATION POINTS**
Key information the patient should understand about their condition, including:
- What the condition means
- How it's typically treated
- Expected recovery timeline
- Prevention strategies

## 🔮 **PROGNOSIS & OUTCOMES**
Discuss the expected course of the condition with appropriate treatment and any long-term considerations.

Please write in a professional medical tone suitable for both healthcare providers and educated patients. Emphasize evidence-based medicine while maintaining clarity and compassion. Include specific medical terminology where appropriate but explain complex concepts clearly.

**IMPORTANT:** This analysis is for educational purposes and should complement, not replace, professional medical consultation.`

    try {
      console.log("🧠 Sending advanced medical analysis to Gemini...")
      const response = await askAI(advancedMedicalPrompt)
      setGeminiInfo(response)
      console.log("✅ Advanced medical analysis complete")
    } catch (error) {
      console.error("❌ Gemini analysis failed:", error)
      setGeminiInfo("Unable to generate comprehensive medical analysis. Please try again.")
    }
  }

  const downloadResults = () => {
    if (!diagnosisData) return

    const resultsText = `
═══════════════════════════════════════════════════════════════
                    HEALTHBUDDY MEDICAL ANALYSIS REPORT
═══════════════════════════════════════════════════════════════

Generated: ${new Date(diagnosisData.timestamp).toLocaleString()}
Report ID: ${diagnosisData.interviewId || "N/A"}

PATIENT INFORMATION:
────────────────────────────────────────────────────────────────
• Age: ${diagnosisData.userAge} years
• Gender: ${diagnosisData.userSex}
• Location: ${diagnosisData.userLocation}
• Assessment Questions: ${diagnosisData.questionCount}

${
  diagnosisData.emergencySymptoms.length > 0
    ? `
🚨 EMERGENCY ALERT:
────────────────────────────────────────────────────────────────
${diagnosisData.emergencySymptoms.map((symptom) => `⚠️  ${symptom}`).join("\n")}

*** URGENT: SEEK IMMEDIATE MEDICAL ATTENTION ***
`
    : ""
}

CLINICAL FINDINGS:
────────────────────────────────────────────────────────────────
${diagnosisData.evidence
  .map(
    (evidence) => `
• ${evidence.name || `Finding ${evidence.id}`}: ${evidence.choice_id.toUpperCase()}${evidence.source ? ` (${evidence.source})` : ""}`,
  )
  .join("\n")}

${
  triageData
    ? `
TRIAGE ASSESSMENT:
────────────────────────────────────────────────────────────────
• Urgency Level: ${triageData.triage_level?.toUpperCase()}
• Root Cause: ${triageData.root_cause}
• Recommendation: ${triageData.description || "Professional medical evaluation required"}
`
    : ""
}

DIAGNOSTIC ANALYSIS:
────────────────────────────────────────────────────────────────
${diagnosisData.conditions
  .map(
    (condition, index) => `
${index + 1}. ${condition.common_name || condition.name}
   Clinical Probability: ${(condition.probability * 100).toFixed(1)}%
   ${condition.details?.severity ? `Severity: ${condition.details.severity}` : ""}
   ${condition.details?.acuteness ? `Acuteness: ${condition.details.acuteness}` : ""}
   ${condition.details?.description ? `Clinical Notes: ${condition.details.description}` : ""}
`,
  )
  .join("\n")}

${
  conditionDetails
    ? `
DETAILED CONDITION ANALYSIS:
────────────────────────────────────────────────────────────────
• Primary Condition: ${conditionDetails.common_name}
• ICD-10 Code: ${conditionDetails.extras?.icd10_code || "Not available"}
• Medical Category: ${conditionDetails.categories?.join(", ") || "General"}
• Prevalence: ${conditionDetails.prevalence}
• Severity Level: ${conditionDetails.severity}
• Clinical Acuteness: ${conditionDetails.acuteness}
• Specialist Guidance: ${conditionDetails.extras?.hint || "Standard medical care"}
`
    : ""
}

${
  riskFactorDetails.length > 0
    ? `
RISK FACTOR ANALYSIS:
────────────────────────────────────────────────────────────────
${riskFactorDetails.map((rf) => `• ${rf.common_name || rf.name} (${rf.category})`).join("\n")}
`
    : ""
}

${
  explainData
    ? `
EVIDENCE CORRELATION:
────────────────────────────────────────────────────────────────
Supporting Evidence:
${explainData.supporting_evidence?.map((e: any) => `✅ ${e.common_name || e.name}`).join("\n") || "None documented"}

${
  explainData.conflicting_evidence?.length > 0
    ? `
Conflicting Evidence:
${explainData.conflicting_evidence.map((e: any) => `❌ ${e.common_name || e.name}`).join("\n")}
`
    : ""
}
`
    : ""
}

MEDICAL DISCLAIMER:
────────────────────────────────────────────────────────────────
This AI-generated analysis is for educational and informational 
purposes only. It should not be considered as medical advice, 
diagnosis, or treatment. Always consult with qualified healthcare 
professionals for proper medical evaluation and treatment.

The analysis is based on reported symptoms and AI interpretation 
of medical data. Accuracy may vary and professional medical 
judgment is essential for proper diagnosis and treatment.

═══════════════════════════════════════════════════════════════
                    End of Medical Analysis Report
                    Generated by HealthBuddy AI System
═══════════════════════════════════════════════════════════════
    `

    const blob = new Blob([resultsText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `healthbuddy-medical-report-${new Date().toISOString().split("T")[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getTriageUrgencyConfig = (level: string) => {
    switch (level) {
      case "emergency":
        return {
          color: "from-red-600 to-red-700",
          bgColor: "bg-red-50 dark:bg-red-900/20",
          borderColor: "border-red-200 dark:border-red-700",
          textColor: "text-red-900 dark:text-red-100",
          icon: AlertTriangle,
          pulse: "animate-pulse",
          glow: "shadow-red-500/50",
        }
      case "consultation_24":
        return {
          color: "from-orange-600 to-orange-700",
          bgColor: "bg-orange-50 dark:bg-orange-900/20",
          borderColor: "border-orange-200 dark:border-orange-700",
          textColor: "text-orange-900 dark:text-orange-100",
          icon: Clock,
          pulse: "",
          glow: "shadow-orange-500/30",
        }
      case "consultation":
        return {
          color: "from-yellow-600 to-yellow-700",
          bgColor: "bg-yellow-50 dark:bg-yellow-900/20",
          borderColor: "border-yellow-200 dark:border-yellow-700",
          textColor: "text-yellow-900 dark:text-yellow-100",
          icon: Stethoscope,
          pulse: "",
          glow: "shadow-yellow-500/30",
        }
      default:
        return {
          color: "from-green-600 to-green-700",
          bgColor: "bg-green-50 dark:bg-green-900/20",
          borderColor: "border-green-200 dark:border-green-700",
          textColor: "text-green-900 dark:text-green-100",
          icon: CheckCircle,
          pulse: "",
          glow: "shadow-green-500/30",
        }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="relative">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto mb-6"></div>
            <div
              className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-purple-400 animate-spin mx-auto"
              style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
            ></div>
          </div>
          <p className="text-gray-700 dark:text-gray-300 text-lg font-medium">Analyzing your medical data...</p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-2">Please wait while we process your results</p>
        </div>
      </div>
    )
  }

  if (!diagnosisData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
            <FileText className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">No Assessment Data Found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            We couldn't find any assessment results. Please start a new health assessment.
          </p>
          <button
            onClick={() => router.push("/chatbot")}
            className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            Start New Assessment
          </button>
        </div>
      </div>
    )
  }

  const triageConfig = getTriageUrgencyConfig(triageData?.triage_level || "self_care")
  const TriageIcon = triageConfig.icon

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-blue-900 dark:to-indigo-900 flex flex-col transition-all duration-500">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50 backdrop-blur-md bg-white/80 dark:bg-gray-900/80 border-b border-gray-200/50 dark:border-gray-700/50">
        <Header />
      </div>

      <main className="flex-1 mt-16 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Hero Header Section */}
          <div className="text-center relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-indigo-600/10 rounded-3xl blur-3xl"></div>
            <div className="relative bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm rounded-3xl p-8 border border-white/50 dark:border-gray-700/50 shadow-xl">
              <div className="flex items-center justify-center mb-6">
                <div className="relative">
                  <div className="p-4 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-2xl shadow-lg">
                    <Microscope className="h-10 w-10 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-gray-900 via-blue-800 to-purple-800 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent mb-4">
                Medical Analysis Report
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
                Comprehensive AI-Powered Health Assessment
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Generated on{" "}
                {new Date(diagnosisData.timestamp).toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          {/* Emergency Warning - Enhanced */}
          {diagnosisData.emergencySymptoms.length > 0 && (
            <div
              className={`relative overflow-hidden rounded-2xl border-2 ${triageConfig.borderColor} ${triageConfig.bgColor} shadow-2xl ${triageConfig.glow}`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/10 to-orange-500/10 animate-pulse"></div>
              <div className="relative p-8">
                <div className="flex items-start">
                  <div
                    className={`p-3 rounded-full bg-gradient-to-r ${triageConfig.color} shadow-lg ${triageConfig.pulse} mr-6`}
                  >
                    <AlertTriangle className="h-8 w-8 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center mb-4">
                      <h2 className="text-3xl font-bold text-red-900 dark:text-red-100">🚨 EMERGENCY MEDICAL ALERT</h2>
                      <div className="ml-4 px-3 py-1 bg-red-600 text-white text-sm font-bold rounded-full animate-pulse">
                        URGENT
                      </div>
                    </div>
                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <p className="text-red-800 dark:text-red-200 font-semibold mb-3 text-lg">
                          Critical symptoms detected during assessment:
                        </p>
                        <ul className="space-y-2">
                          {diagnosisData.emergencySymptoms.map((symptom, index) => (
                            <li key={index} className="flex items-center text-red-800 dark:text-red-200">
                              <AlertCircle className="h-5 w-5 mr-3 flex-shrink-0" />
                              <span className="font-medium">{symptom}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="bg-red-100 dark:bg-red-800/50 p-6 rounded-xl border-2 border-red-200 dark:border-red-700">
                        <div className="text-center">
                          <div className="w-16 h-16 mx-auto mb-4 bg-red-600 rounded-full flex items-center justify-center animate-pulse">
                            <Heart className="h-8 w-8 text-white" />
                          </div>
                          <p className="text-red-900 dark:text-red-100 font-bold text-xl mb-2">
                            IMMEDIATE ACTION REQUIRED
                          </p>
                          <p className="text-red-800 dark:text-red-200 text-sm leading-relaxed">
                            Contact emergency services (911) or visit the nearest emergency room immediately. Do not
                            delay seeking professional medical care.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patient Information - Enhanced */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
            <div className="flex items-center mb-8">
              <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl shadow-lg mr-4">
                <User className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Patient Information</h2>
                <p className="text-gray-600 dark:text-gray-400">Assessment details and demographics</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  icon: Calendar,
                  label: "Age",
                  value: `${diagnosisData.userAge} years`,
                  color: "from-purple-500 to-pink-500",
                },
                {
                  icon: User,
                  label: "Gender",
                  value: diagnosisData.userSex?.charAt(0).toUpperCase() + diagnosisData.userSex?.slice(1),
                  color: "from-blue-500 to-cyan-500",
                },
                {
                  icon: MapPin,
                  label: "Location",
                  value: diagnosisData.userLocation,
                  color: "from-green-500 to-emerald-500",
                },
                {
                  icon: Clock,
                  label: "Questions",
                  value: `${diagnosisData.questionCount} asked`,
                  color: "from-orange-500 to-red-500",
                },
              ].map((item, index) => (
                <div key={index} className="group hover:scale-105 transition-all duration-300">
                  <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl">
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 bg-gradient-to-r ${item.color} rounded-lg shadow-md`}>
                        <item.icon className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{item.label}</p>
                        <p className="font-bold text-gray-900 dark:text-white text-lg">{item.value}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Triage Assessment - Enhanced */}
          {triageData && (
            <div
              className={`relative overflow-hidden rounded-2xl border-2 ${triageConfig.borderColor} ${triageConfig.bgColor} shadow-2xl ${triageConfig.glow}`}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500"></div>
              <div className="p-8">
                <div className="flex items-center mb-8">
                  <div
                    className={`p-4 bg-gradient-to-r ${triageConfig.color} rounded-xl shadow-lg mr-6 ${triageConfig.pulse}`}
                  >
                    <TriageIcon className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Medical Triage Assessment</h2>
                    <p className="text-gray-600 dark:text-gray-400 text-lg">Professional urgency evaluation</p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <span className="text-xl font-semibold text-gray-700 dark:text-gray-300">Urgency Level:</span>
                      <div
                        className={`px-6 py-3 rounded-xl font-bold text-xl shadow-lg ${triageConfig.bgColor} ${triageConfig.textColor} border-2 ${triageConfig.borderColor}`}
                      >
                        {triageData.triage_level?.replace("_", " ").toUpperCase()}
                      </div>
                    </div>

                    <div className="bg-white/50 dark:bg-gray-700/50 p-6 rounded-xl border border-gray-200 dark:border-gray-600">
                      <div className="flex items-center mb-3">
                        <FileText className="h-5 w-5 text-gray-600 dark:text-gray-400 mr-2" />
                        <span className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                          Clinical Recommendation:
                        </span>
                      </div>
                      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                        {triageData.description ||
                          "Professional medical evaluation recommended based on assessment findings."}
                      </p>
                    </div>

                    {triageData.root_cause && (
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-700">
                        <div className="flex items-center mb-3">
                          <Target className="h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" />
                          <span className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                            Root Cause Analysis:
                          </span>
                        </div>
                        <p className="text-blue-700 dark:text-blue-300 font-medium">
                          {triageData.root_cause.replace("_", " ").toUpperCase()}
                        </p>
                      </div>
                    )}
                  </div>

                  {triageData.serious && triageData.serious.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-700">
                      <div className="flex items-center mb-4">
                        <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-3" />
                        <span className="text-xl font-semibold text-orange-800 dark:text-orange-200">
                          Serious Conditions to Monitor:
                        </span>
                      </div>
                      <div className="space-y-3">
                        {triageData.serious.map((condition: any, index: number) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-4 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-orange-200 dark:border-orange-700"
                          >
                            <div className="flex items-center">
                              <div
                                className={`w-3 h-3 rounded-full mr-3 ${condition.is_emergency ? "bg-red-500 animate-pulse" : "bg-orange-500"}`}
                              ></div>
                              <span className="font-medium text-gray-900 dark:text-white">
                                {condition.common_name || condition.name}
                              </span>
                            </div>
                            {condition.is_emergency && (
                              <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 text-xs font-bold rounded-full">
                                EMERGENCY
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Comprehensive Analysis Loading */}
          {comprehensiveAnalysisLoading && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <div className="relative mb-6">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                    <div
                      className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-purple-400 animate-spin mx-auto"
                      style={{ animationDirection: "reverse", animationDuration: "2s" }}
                    ></div>
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Conducting Comprehensive Medical Analysis
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Processing clinical data through advanced AI systems...
                  </p>
                  <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                    <Zap className="h-4 w-4 animate-pulse" />
                    <span>Analyzing symptoms, conditions, and risk factors</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Detailed Condition Analysis - Enhanced */}
          {conditionDetails && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
              <div className="flex items-center mb-8">
                <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl shadow-lg mr-6">
                  <Microscope className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Primary Condition Analysis</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">Detailed medical condition breakdown</p>
                </div>
              </div>

              <div className="space-y-8">
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 p-6 rounded-xl border border-indigo-200 dark:border-indigo-700">
                  <h3 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 mb-2">
                    {conditionDetails.common_name || conditionDetails.name}
                  </h3>
                  <div className="flex items-center space-x-4 text-sm text-indigo-700 dark:text-indigo-300">
                    <span className="flex items-center">
                      <Award className="h-4 w-4 mr-1" />
                      Primary Diagnosis
                    </span>
                    <span className="flex items-center">
                      <Star className="h-4 w-4 mr-1" />
                      {(diagnosisData.conditions[0]?.probability * 100).toFixed(1)}% Confidence
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[
                    {
                      label: "Medical Category",
                      value: conditionDetails.categories?.join(", ") || "General Medicine",
                      icon: BookOpen,
                      color: "from-blue-500 to-cyan-500",
                    },
                    {
                      label: "Severity Level",
                      value:
                        conditionDetails.severity?.charAt(0).toUpperCase() + conditionDetails.severity?.slice(1) ||
                        "Not specified",
                      icon: AlertTriangle,
                      color:
                        conditionDetails.severity === "severe"
                          ? "from-red-500 to-pink-500"
                          : conditionDetails.severity === "moderate"
                            ? "from-orange-500 to-yellow-500"
                            : "from-green-500 to-emerald-500",
                    },
                    {
                      label: "Clinical Acuteness",
                      value:
                        conditionDetails.acuteness?.replace("_", " ").charAt(0).toUpperCase() +
                          conditionDetails.acuteness?.replace("_", " ").slice(1) || "Not specified",
                      icon: Clock,
                      color: "from-purple-500 to-indigo-500",
                    },
                    {
                      label: "Population Prevalence",
                      value:
                        conditionDetails.prevalence?.replace("_", " ").charAt(0).toUpperCase() +
                          conditionDetails.prevalence?.replace("_", " ").slice(1) || "Not specified",
                      icon: Globe,
                      color: "from-teal-500 to-green-500",
                    },
                    {
                      label: "Gender Filter",
                      value:
                        conditionDetails.sex_filter?.charAt(0).toUpperCase() + conditionDetails.sex_filter?.slice(1) ||
                        "Both",
                      icon: User,
                      color: "from-pink-500 to-rose-500",
                    },
                    {
                      label: "ICD-10 Code",
                      value: conditionDetails.extras?.icd10_code || "Not available",
                      icon: FileText,
                      color: "from-gray-500 to-slate-500",
                    },
                  ].map((item, index) => (
                    <div key={index} className="group hover:scale-105 transition-all duration-300">
                      <div className="bg-gradient-to-br from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-600 shadow-lg hover:shadow-xl">
                        <div className="flex items-center mb-3">
                          <div className={`p-2 bg-gradient-to-r ${item.color} rounded-lg shadow-md mr-3`}>
                            <item.icon className="h-5 w-5 text-white" />
                          </div>
                          <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{item.label}</span>
                        </div>
                        <p className="font-bold text-gray-900 dark:text-white text-lg">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {conditionDetails.extras?.hint && (
                  <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-700">
                    <div className="flex items-start">
                      <div className="p-2 bg-blue-500 rounded-lg mr-4 flex-shrink-0">
                        <Stethoscope className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h4 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">
                          Clinical Guidance:
                        </h4>
                        <p className="text-blue-700 dark:text-blue-300 leading-relaxed">
                          {conditionDetails.extras.hint}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Evidence Analysis - Enhanced */}
          {explainData && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
              <div className="flex items-center mb-8">
                <div className="p-4 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl shadow-lg mr-6">
                  <Target className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Clinical Evidence Analysis</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Symptom correlation and diagnostic reasoning
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-3 gap-8">
                {/* Supporting Evidence */}
                {explainData.supporting_evidence && explainData.supporting_evidence.length > 0 && (
                  <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-700">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-green-500 rounded-lg mr-3">
                        <CheckCircle className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-green-800 dark:text-green-200">Supporting Evidence</h3>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300 mb-4">
                      {explainData.supporting_evidence.length} findings support this diagnosis
                    </p>
                    <div className="space-y-3">
                      {explainData.supporting_evidence.map((evidence: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-green-200 dark:border-green-700"
                        >
                          <div className="w-2 h-2 bg-green-500 rounded-full mr-3 flex-shrink-0"></div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {evidence.common_name || evidence.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conflicting Evidence */}
                {explainData.conflicting_evidence && explainData.conflicting_evidence.length > 0 && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-700">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-red-500 rounded-lg mr-3">
                        <AlertCircle className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-red-800 dark:text-red-200">Conflicting Evidence</h3>
                    </div>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      {explainData.conflicting_evidence.length} findings may contradict this diagnosis
                    </p>
                    <div className="space-y-3">
                      {explainData.conflicting_evidence.map((evidence: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-red-200 dark:border-red-700"
                        >
                          <div className="w-2 h-2 bg-red-500 rounded-full mr-3 flex-shrink-0"></div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {evidence.common_name || evidence.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Unconfirmed Evidence */}
                {explainData.unconfirmed_evidence && explainData.unconfirmed_evidence.length > 0 && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-700">
                    <div className="flex items-center mb-4">
                      <div className="p-2 bg-yellow-500 rounded-lg mr-3">
                        <Info className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="text-xl font-semibold text-yellow-800 dark:text-yellow-200">
                        Unconfirmed Evidence
                      </h3>
                    </div>
                    <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-4">
                      {explainData.unconfirmed_evidence.length} findings require further evaluation
                    </p>
                    <div className="space-y-3">
                      {explainData.unconfirmed_evidence.map((evidence: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center p-3 bg-white/70 dark:bg-gray-800/70 rounded-lg border border-yellow-200 dark:border-yellow-700"
                        >
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mr-3 flex-shrink-0"></div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {evidence.common_name || evidence.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk Factors Analysis - Enhanced */}
          {riskFactorDetails.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
              <div className="flex items-center mb-8">
                <div className="p-4 bg-gradient-to-r from-orange-500 to-red-600 rounded-xl shadow-lg mr-6">
                  <Shield className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Risk Factor Analysis</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">Contributing factors and patient profile</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {riskFactorDetails.map((riskFactor, index) => (
                  <div key={index} className="group hover:scale-105 transition-all duration-300">
                    <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 p-6 rounded-xl border border-orange-200 dark:border-orange-700 shadow-lg hover:shadow-xl">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <div className="p-2 bg-gradient-to-r from-orange-500 to-red-500 rounded-lg mr-3">
                            {riskFactor.id.includes("mosquito") || riskFactor.id.includes("bite") ? (
                              <Bug className="h-5 w-5 text-white" />
                            ) : riskFactor.id.includes("travel") || riskFactor.id.includes("residence") ? (
                              <Globe className="h-5 w-5 text-white" />
                            ) : (
                              <Shield className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900 dark:text-white text-lg">
                              {riskFactor.common_name || riskFactor.name}
                            </h3>
                            <span className="px-3 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-sm rounded-full font-medium">
                              {riskFactor.category}
                            </span>
                          </div>
                        </div>
                        <div className="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 text-xs font-bold rounded-full">
                          PRESENT
                        </div>
                      </div>

                      {riskFactor.extras?.hint && (
                        <div className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg border border-orange-200 dark:border-orange-600">
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            {riskFactor.extras.hint}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Medical Analysis - Enhanced */}
          {diagnosisData.conditions.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
              <div className="flex items-center mb-8">
                <div className="p-4 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl shadow-lg mr-6">
                  <Brain className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                    AI Medical Analysis: {diagnosisData.conditions[0].common_name || diagnosisData.conditions[0].name}
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Comprehensive clinical interpretation by Dr. HealthBuddy AI
                  </p>
                </div>
              </div>

              {loadingGemini ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center">
                    <div className="relative mb-6">
                      <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-200 border-t-purple-600 mx-auto"></div>
                      <div
                        className="absolute inset-0 rounded-full h-16 w-16 border-4 border-transparent border-t-pink-400 animate-spin mx-auto"
                        style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                      ></div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                      Dr. HealthBuddy AI is analyzing your case...
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Processing clinical data and generating comprehensive medical insights
                    </p>
                  </div>
                </div>
              ) : geminiError ? (
                <div className="flex items-center justify-center py-16">
                  <div className="text-center max-w-md">
                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                      <AlertTriangle className="h-8 w-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-red-600 dark:text-red-400 mb-2">Analysis Error</h3>
                    <p className="text-red-500 dark:text-red-400">{geminiError}</p>
                  </div>
                </div>
              ) : geminiInfo ? (
                <div className="prose prose-lg max-w-none dark:prose-invert">
                  <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-700 mb-8">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mr-4">
                        <Stethoscope className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-purple-900 dark:text-purple-100">Dr. HealthBuddy AI</h3>
                        <p className="text-purple-700 dark:text-purple-300 text-sm">
                          Medical AI Specialist • Infectious Disease Expert
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {geminiInfo.split("\n").map((paragraph, index) => {
                      if (paragraph.trim()) {
                        // Handle section headers with ##
                        if (paragraph.startsWith("## ")) {
                          const headerText = paragraph
                            .replace("## ", "")
                            .replace(/[🔬⚠️🧬📊🌍🏥🚨📚🔮]/gu, "")
                            .trim()
                          const emoji = paragraph.match(/[🔬⚠️🧬📊🌍🏥🚨📚🔮]/u)?.[0] || "📋"
                          return (
                            <div key={index} className="mt-8 mb-6">
                              <div className="flex items-center mb-4">
                                <div className="text-2xl mr-3">{emoji}</div>
                                <h3 className="text-2xl font-bold text-gray-900 dark:text-white border-b-2 border-purple-500 pb-2">
                                  {headerText}
                                </h3>
                              </div>
                            </div>
                          )
                        }

                        // Handle bold headers with **
                        if (paragraph.includes("**")) {
                          const parts = paragraph.split("**")
                          return (
                            <p key={index} className="mb-4 leading-relaxed">
                              {parts.map((part, i) =>
                                i % 2 === 1 ? (
                                  <strong
                                    key={i}
                                    className="font-bold text-gray-900 dark:text-white bg-yellow-100 dark:bg-yellow-900/30 px-1 rounded"
                                  >
                                    {part}
                                  </strong>
                                ) : (
                                  <span key={i} className="text-gray-700 dark:text-gray-300">
                                    {part}
                                  </span>
                                ),
                              )}
                            </p>
                          )
                        }

                        // Handle bullet points
                        if (paragraph.trim().startsWith("•") || paragraph.trim().startsWith("-")) {
                          return (
                            <div key={index} className="flex items-start mb-3">
                              <ChevronRight className="h-5 w-5 text-purple-500 mr-2 mt-0.5 flex-shrink-0" />
                              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                                {paragraph.replace(/^[•-]\s*/, "")}
                              </p>
                            </div>
                          )
                        }

                        return (
                          <p key={index} className="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed text-lg">
                            {paragraph}
                          </p>
                        )
                      }
                      return <div key={index} className="mb-4"></div>
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                    <Brain className="h-8 w-8 text-gray-400" />
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    AI medical analysis is currently unavailable.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Reported Symptoms - Enhanced */}
          {diagnosisData.evidence.length > 0 && (
            <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
              <div className="flex items-center mb-8">
                <div className="p-4 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-xl shadow-lg mr-6">
                  <Activity className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Clinical Findings & Symptoms</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-lg">
                    Reported symptoms and risk factors assessment
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {diagnosisData.evidence.map((evidence, index) => {
                  const getEvidenceIcon = (id: string, choiceId: string) => {
                    if (id.includes("fever") || id.includes("temperature")) return Thermometer
                    if (id.includes("bite") || id.includes("mosquito")) return Bug
                    if (id.includes("travel") || id.includes("residence")) return Globe
                    return choiceId === "present" ? CheckCircle : choiceId === "absent" ? AlertCircle : Info
                  }

                  const EvidenceIcon = getEvidenceIcon(evidence.id, evidence.choice_id)

                  return (
                    <div key={index} className="group hover:scale-105 transition-all duration-300">
                      <div
                        className={`p-4 rounded-xl border-2 shadow-lg hover:shadow-xl ${
                          evidence.choice_id === "present"
                            ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700"
                            : evidence.choice_id === "absent"
                              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                              : "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-700"
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <div
                            className={`p-2 rounded-lg flex-shrink-0 ${
                              evidence.choice_id === "present"
                                ? "bg-green-500"
                                : evidence.choice_id === "absent"
                                  ? "bg-red-500"
                                  : "bg-yellow-500"
                            }`}
                          >
                            <EvidenceIcon className="h-5 w-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">
                              {evidence.name || `Finding ${evidence.id}`}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-bold ${
                                  evidence.choice_id === "present"
                                    ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-100"
                                    : evidence.choice_id === "absent"
                                      ? "bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100"
                                      : "bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-100"
                                }`}
                              >
                                {evidence.choice_id.toUpperCase()}
                              </span>
                              {evidence.source && (
                                <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                                  {evidence.source}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-8 flex items-center justify-center space-x-8 text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="font-medium">
                    Present ({diagnosisData.evidence.filter((e) => e.choice_id === "present").length})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-red-500"></div>
                  <span className="font-medium">
                    Absent ({diagnosisData.evidence.filter((e) => e.choice_id === "absent").length})
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="font-medium">
                    Unknown ({diagnosisData.evidence.filter((e) => e.choice_id === "unknown").length})
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Possible Conditions - Enhanced */}
          <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-2xl shadow-xl border border-white/50 dark:border-gray-700/50 p-8">
            <div className="flex items-center mb-8">
              <div className="p-4 bg-gradient-to-r from-teal-500 to-cyan-600 rounded-xl shadow-lg mr-6">
                <TrendingUp className="h-8 w-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Differential Diagnosis</h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">Possible conditions ranked by probability</p>
              </div>
            </div>

            {diagnosisData.conditions.length > 0 ? (
              <div className="space-y-6">
                {diagnosisData.conditions.slice(0, 5).map((condition, index) => {
                  const percentage = (condition.probability * 100).toFixed(1)
                  const isTopCondition = index === 0

                  const getRankColor = (index: number) => {
                    switch (index) {
                      case 0:
                        return "from-red-500 to-pink-500"
                      case 1:
                        return "from-orange-500 to-yellow-500"
                      case 2:
                        return "from-blue-500 to-cyan-500"
                      case 3:
                        return "from-purple-500 to-indigo-500"
                      default:
                        return "from-gray-500 to-slate-500"
                    }
                  }

                  return (
                    <div
                      key={condition.id}
                      className={`group hover:scale-[1.02] transition-all duration-300 p-6 rounded-2xl border-2 shadow-lg hover:shadow-2xl ${
                        isTopCondition
                          ? "bg-gradient-to-r from-blue-50 via-purple-50 to-indigo-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-700"
                          : "bg-gradient-to-r from-gray-50 to-white dark:from-gray-700 dark:to-gray-800 border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-4">
                          <div
                            className={`flex items-center justify-center w-12 h-12 rounded-xl text-white font-bold text-lg shadow-lg bg-gradient-to-r ${getRankColor(index)}`}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                              {condition.common_name || condition.name}
                            </h3>
                            {isTopCondition && (
                              <div className="flex items-center mt-1">
                                <Star className="h-4 w-4 text-yellow-500 mr-1" />
                                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                                  Primary Diagnosis
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{percentage}%</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">confidence</div>
                        </div>
                      </div>

                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3 mb-4 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-1000 bg-gradient-to-r ${getRankColor(index)}`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>

                      {(condition.details?.severity || condition.details?.acuteness) && (
                        <div className="flex flex-wrap gap-2 mb-4">
                          {condition.details.severity && (
                            <span
                              className={`px-3 py-1 rounded-full text-sm font-medium ${
                                condition.details.severity === "severe"
                                  ? "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200"
                                  : condition.details.severity === "moderate"
                                    ? "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200"
                                    : "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200"
                              }`}
                            >
                              {condition.details.severity} severity
                            </span>
                          )}
                          {condition.details.acuteness && (
                            <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-sm rounded-full font-medium">
                              {condition.details.acuteness.replace("_", " ")}
                            </span>
                          )}
                        </div>
                      )}

                      {condition.details?.description && (
                        <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed">
                          {condition.details.description}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <Info className="h-8 w-8 text-gray-400" />
                </div>
                <p className="text-gray-500 dark:text-gray-400 text-lg">
                  No specific conditions were identified during the assessment.
                </p>
              </div>
            )}
          </div>

          {/* Important Disclaimer - Enhanced */}
          <div className="bg-gradient-to-r from-yellow-50 via-orange-50 to-red-50 dark:from-yellow-900/20 dark:via-orange-900/20 dark:to-red-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-2xl p-8 shadow-xl">
            <div className="flex items-start">
              <div className="p-3 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg mr-6 flex-shrink-0">
                <Shield className="h-8 w-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-yellow-900 dark:text-yellow-100 mb-4">
                  Important Medical Disclaimer
                </h3>
                <div className="space-y-3 text-yellow-800 dark:text-yellow-200 leading-relaxed">
                  <p className="font-semibold">
                    This AI-generated analysis is for educational and informational purposes only.
                  </p>
                  <p>
                    The results are based on artificial intelligence analysis of reported symptoms and should
                    <strong className="font-bold"> never replace professional medical consultation</strong>. Medical
                    conditions require proper evaluation by qualified healthcare providers.
                  </p>
                  <p>Always consult with a licensed physician, specialist, or healthcare provider for:</p>
                  <ul className="list-disc pl-6 space-y-1">
                    <li>Proper medical diagnosis and evaluation</li>
                    <li>Treatment recommendations and medical advice</li>
                    <li>Emergency medical situations</li>
                    <li>Any health concerns or symptoms</li>
                  </ul>
                  <p className="text-sm font-medium bg-yellow-100 dark:bg-yellow-800/50 p-3 rounded-lg border border-yellow-300 dark:border-yellow-600">
                    <strong>Emergency Note:</strong> If you are experiencing a medical emergency, call emergency
                    services (911) immediately or visit your nearest emergency room.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons - Enhanced */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <button
              onClick={downloadResults}
              className="group flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              <Download className="h-6 w-6 mr-3 group-hover:animate-bounce" />
              Download Medical Report
              <div className="ml-2 px-2 py-1 bg-white/20 rounded-full text-xs">PDF</div>
            </button>
            <button
              onClick={() => router.push("/chatbot")}
              className="group flex items-center justify-center px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              <Activity className="h-6 w-6 mr-3 group-hover:animate-pulse" />
              New Health Assessment
              <ChevronRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
