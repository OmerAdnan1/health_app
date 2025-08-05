"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { 
  type Condition,
  type EvidenceItem,
  type DiagnosisData,
  getTriageResult,
  getConditionDetails,
  getRiskFactorDetails,
  getExplainationRes
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
  Stethoscope
} from "lucide-react"

// Remove local DiagnosisData interface since we're now importing it
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
        { value: data.userAge!, unit: 'year' },
        { value: data.userSex! },
        data.evidence,
        data.interviewId!
      )
      setTriageData(triage)
      console.log("✅ Triage data received:", triage.triage_level)

      // 2. Get detailed condition information
      console.log("🔍 Fetching condition details...")
      const conditionInfo = await getConditionDetails(
        topCondition.id, 
        data.interviewId!, 
        data.userAge || undefined, 
        data.userSex || undefined
      )
      setConditionDetails(conditionInfo)
      console.log("✅ Condition details received:", conditionInfo.common_name)

      // 3. Get risk factor details
      console.log("🎯 Fetching risk factor details...")
      const riskFactorIds = data.evidence
        .filter(e => e.id.startsWith('p_') && e.choice_id === 'present')
        .slice(0, 5) // Limit to 5 to avoid too many requests
      
      const riskFactors = []
      for (const riskFactor of riskFactorIds) {
        try {
          const details = await getRiskFactorDetails(
            riskFactor.id, 
            data.userAge || undefined, 
            data.userSex || undefined, 
            data.interviewId!
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
        age: { value: data.userAge!, unit: 'year' },
        sex: { value: data.userSex! },
        evidence: data.evidence,
        target_condition: topCondition.id,
        interviewId: data.interviewId!
      })
      setExplainData(explanation)
      console.log("✅ Explanation received")

      // 5. Create comprehensive Gemini prompt with all data
      await createComprehensiveGeminiAnalysis({
        diagnosisData: data,
        triageData: triage,
        conditionDetails: conditionInfo,
        riskFactorDetails: riskFactors,
        explainData: explanation,
        topCondition
      })

    } catch (error) {
      console.error("❌ Comprehensive analysis failed:", error)
      setGeminiInfo("Unable to complete comprehensive analysis. Please try again.")
    } finally {
      setComprehensiveAnalysisLoading(false)
    }
  }

  const createComprehensiveGeminiAnalysis = async (allData: {
    diagnosisData: DiagnosisData,
    triageData: any,
    conditionDetails: any,
    riskFactorDetails: any[],
    explainData: any,
    topCondition: Condition
  }) => {
    const { diagnosisData, triageData, conditionDetails, riskFactorDetails, explainData, topCondition } = allData
    
    // Create rich prompt with all available data
    const comprehensivePrompt = `As a medical AI assistant, provide a comprehensive analysis based on the following detailed medical assessment data:

**PATIENT PROFILE:**
- Age: ${diagnosisData.userAge} years
- Sex: ${diagnosisData.userSex}
- Location: ${diagnosisData.userLocation || 'Not specified'}
- Assessment Date: ${new Date(diagnosisData.timestamp).toLocaleDateString()}

**TRIAGE ASSESSMENT:**
- Urgency Level: ${triageData.triage_level}
- Recommendation: ${triageData.description}
- Serious Conditions to Consider: ${triageData.serious?.map((c: any) => c.common_name || c.name).join(', ') || 'None flagged'}

**TOP CONDITION ANALYSIS:**
- Condition: ${topCondition.common_name || topCondition.name}
- Probability: ${(topCondition.probability * 100).toFixed(1)}%
- Clinical Details:
  * Severity: ${conditionDetails.severity}
  * Prevalence: ${conditionDetails.prevalence}
  * Acuteness: ${conditionDetails.acuteness}
  * ICD-10 Code: ${conditionDetails.extras?.icd10_code || 'Not available'}
  * Clinical Hint: ${conditionDetails.extras?.hint || 'None provided'}

**SYMPTOMS PRESENT:**
${diagnosisData.evidence
  .filter(e => e.choice_id === 'present' && e.id.startsWith('s_'))
  .map(e => `- ${e.name}`)
  .join('\n')}

**RISK FACTORS IDENTIFIED:**
${riskFactorDetails.map(rf => 
  `- ${rf.common_name || rf.name} (Category: ${rf.category})`
).join('\n') || 'None identified'}

**MEDICAL EXPLANATION SUMMARY:**
${explainData?.supporting_evidence ? 
  `Supporting Evidence: ${explainData.supporting_evidence.map((e: any) => e.name || e.id).join(', ')}` : 
  'Detailed explanation data processed'}

**OTHER POSSIBLE CONDITIONS:**
${diagnosisData.conditions.slice(1, 4).map(c => 
  `- ${c.common_name || c.name} (${(c.probability * 100).toFixed(1)}%)`
).join('\n')}

Based on this comprehensive medical data, please provide:

1. **Clinical Summary**: A clear, professional summary of the patient's presentation
2. **Risk Assessment**: Analysis of the urgency level and any concerning patterns
3. **Symptom Correlation**: How the symptoms relate to the top condition
4. **Risk Factor Impact**: How identified risk factors contribute to the diagnosis
5. **Next Steps**: Specific recommendations for care level and follow-up
6. **Patient Education**: Key points the patient should understand about their condition
7. **Red Flags**: Any warning signs that would require immediate medical attention

Please write this in clear, professional language suitable for both healthcare providers and educated patients. Emphasize the importance of professional medical consultation while providing valuable educational insights.`

    try {
      console.log("🧠 Sending comprehensive data to Gemini...")
      const response = await askAI(comprehensivePrompt)
      setGeminiInfo(response)
      console.log("✅ Comprehensive Gemini analysis complete")
    } catch (error) {
      console.error("❌ Gemini analysis failed:", error)
      setGeminiInfo("Unable to generate comprehensive analysis. Please try again.")
    }
  }

  const downloadResults = () => {
    if (!diagnosisData) return

    const resultsText = `
HEALTH ASSESSMENT RESULTS
Generated on: ${new Date(diagnosisData.timestamp).toLocaleString()}
Interview ID: ${diagnosisData.interviewId || 'N/A'}

PATIENT INFORMATION:
- Age: ${diagnosisData.userAge} years
- Gender: ${diagnosisData.userSex}
- Location: ${diagnosisData.userLocation}
- Assessment Questions: ${diagnosisData.questionCount}

REPORTED SYMPTOMS & RISK FACTORS:
${diagnosisData.evidence.map(evidence => `
- ${evidence.name || `Symptom ${evidence.id}`}: ${evidence.choice_id.toUpperCase()}${evidence.source ? ` (${evidence.source})` : ''}`).join('\n')}

${diagnosisData.emergencySymptoms.length > 0 ? `
⚠️ EMERGENCY SYMPTOMS DETECTED:
${diagnosisData.emergencySymptoms.map(symptom => `- ${symptom}`).join('\n')}

🚨 URGENT: Please seek immediate medical attention!
` : ''}

POSSIBLE CONDITIONS:
${diagnosisData.conditions.map((condition, index) => `
${index + 1}. ${condition.common_name || condition.name}
   Probability: ${(condition.probability * 100).toFixed(1)}%
   ${condition.details?.severity ? `Severity: ${condition.details.severity}` : ''}
   ${condition.details?.acuteness ? `Acuteness: ${condition.details.acuteness}` : ''}
   ${condition.details?.description ? `Description: ${condition.details.description}` : ''}
`).join('\n')}

IMPORTANT DISCLAIMER:
This assessment is for educational purposes only and should not replace professional medical advice, diagnosis, or treatment. Always consult with a qualified healthcare provider for proper medical evaluation and treatment.

Generated by HealthBuddy AI Assistant
    `

    const blob = new Blob([resultsText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `health-assessment-${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading your results...</p>
        </div>
      </div>
    )
  }

  if (!diagnosisData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">No assessment data found.</p>
          <button
            onClick={() => router.push("/chatbot")}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Start New Assessment
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col transition-colors">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Header />
      </div>

      <main className="flex-1 mt-16 p-6">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header Section */}
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <div className="p-3 bg-gradient-to-r from-green-500 to-blue-500 rounded-full mr-4">
                <Stethoscope className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Assessment Results</h1>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Your comprehensive health analysis • {new Date(diagnosisData.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Emergency Warning */}
          {diagnosisData.emergencySymptoms.length > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-6 rounded-lg shadow-lg">
              <div className="flex items-start">
                <AlertTriangle className="h-8 w-8 text-red-500 mr-4 flex-shrink-0 mt-1" />
                <div>
                  <h2 className="text-2xl font-bold text-red-900 dark:text-red-100 mb-4">
                    ⚠️ Emergency Symptoms Detected
                  </h2>
                  <div className="mb-4">
                    <p className="text-red-800 dark:text-red-200 font-semibold mb-2">
                      The following emergency indicators were identified during your assessment:
                    </p>
                    <ul className="list-disc pl-6 space-y-1">
                      {diagnosisData.emergencySymptoms.map((symptom, index) => (
                        <li key={index} className="text-red-800 dark:text-red-200">{symptom}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="bg-red-100 dark:bg-red-800/50 p-4 rounded-lg border border-red-200 dark:border-red-700">
                    <p className="text-red-900 dark:text-red-100 font-bold text-lg">
                      🚨 PLEASE SEEK IMMEDIATE MEDICAL ATTENTION
                    </p>
                    <p className="text-red-800 dark:text-red-200 mt-2">
                      Contact emergency services (911) or visit the nearest emergency room immediately. 
                      Do not delay seeking professional medical care.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Patient Information */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <User className="h-6 w-6 mr-3 text-blue-500" />
              Assessment Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-center space-x-3">
                <Calendar className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Age</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{diagnosisData.userAge} years</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <User className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Gender</p>
                  <p className="font-semibold text-gray-900 dark:text-white capitalize">{diagnosisData.userSex}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <MapPin className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{diagnosisData.userLocation}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Questions Asked</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{diagnosisData.questionCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Reported Symptoms */}
          {diagnosisData.evidence.length > 0 && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Stethoscope className="h-6 w-6 mr-3 text-purple-500" />
                Reported Symptoms & Risk Factors
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {diagnosisData.evidence.map((evidence, index) => (
                  <div key={index} className="flex items-start space-x-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                      evidence.choice_id === "present" ? "bg-red-500" : 
                      evidence.choice_id === "absent" ? "bg-green-500" : "bg-yellow-500"
                    }`}></div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">
                        {evidence.name || `Symptom ${evidence.id}`}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {evidence.choice_id} {evidence.source ? `• ${evidence.source}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center text-sm text-gray-600 dark:text-gray-400">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Present</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Absent</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <span>Unknown</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Possible Conditions */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <TrendingUp className="h-6 w-6 mr-3 text-green-500" />
              Possible Conditions
            </h2>
            
            {diagnosisData.conditions.length > 0 ? (
              <div className="space-y-4">
                {diagnosisData.conditions.slice(0, 5).map((condition, index) => {
                  const percentage = (condition.probability * 100).toFixed(1)
                  const isTopCondition = index === 0
                  
                  return (
                    <div
                      key={condition.id}
                      className={`p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                        isTopCondition
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                          : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white font-bold ${
                            index === 0 ? "bg-red-500" : index === 1 ? "bg-yellow-500" : "bg-green-500"
                          }`}>
                            {index + 1}
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {condition.common_name || condition.name}
                          </h3>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                            {percentage}%
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">probability</div>
                        </div>
                      </div>
                      
                      <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-3">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            index === 0 ? "bg-red-500" : index === 1 ? "bg-yellow-500" : "bg-green-500"
                          }`}
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>

                      {(condition.details?.severity || condition.details?.acuteness) && (
                        <div className="flex flex-wrap gap-2 mb-3">
                          {condition.details.severity && (
                            <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 text-xs rounded-full">
                              {condition.details.severity} severity
                            </span>
                          )}
                          {condition.details.acuteness && (
                            <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 text-xs rounded-full">
                              {condition.details.acuteness}
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
              <div className="text-center py-8">
                <Info className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No specific conditions were identified during the assessment.
                </p>
              </div>
            )}
          </div>

          {/* Comprehensive Analysis Loading */}
          {comprehensiveAnalysisLoading && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-4"></div>
                <span className="text-lg text-gray-600 dark:text-gray-300">
                  Gathering comprehensive medical analysis...
                </span>
              </div>
            </div>
          )}

          {/* Triage Assessment */}
          {triageData && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <AlertTriangle className="h-6 w-6 mr-3 text-orange-500" />
                Medical Triage Assessment
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center space-x-4">
                  <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Urgency Level:</span>
                  <span className={`px-4 py-2 rounded-lg font-bold text-lg ${
                    triageData.triage_level === 'emergency' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' :
                    triageData.triage_level === 'consultation_24' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200' :
                    triageData.triage_level === 'consultation' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200' :
                    triageData.triage_level === 'self_care' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200' :
                    'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200'
                  }`}>
                    {triageData.triage_level?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                
                <div>
                  <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Recommendation:</span>
                  <p className="text-gray-600 dark:text-gray-300 mt-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    {triageData.description}
                  </p>
                </div>

                {triageData.serious && triageData.serious.length > 0 && (
                  <div>
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Serious Conditions to Consider:</span>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {triageData.serious.map((condition: any, index: number) => (
                        <span 
                          key={index}
                          className={`px-3 py-1 rounded-full text-sm font-medium ${
                            condition.is_emergency 
                              ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200' 
                              : 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200'
                          }`}
                        >
                          {condition.common_name || condition.name}
                          {condition.is_emergency && " ⚠️"}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Detailed Condition Analysis */}
          {conditionDetails && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Stethoscope className="h-6 w-6 mr-3 text-blue-500" />
                Detailed Condition Analysis
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {conditionDetails.common_name || conditionDetails.name}
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Severity</span>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">
                      {conditionDetails.severity || 'Not specified'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Prevalence</span>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">
                      {conditionDetails.prevalence?.replace('_', ' ') || 'Not specified'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Acuteness</span>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">
                      {conditionDetails.acuteness?.replace('_', ' ') || 'Not specified'}
                    </p>
                  </div>
                  
                  <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <span className="text-sm text-gray-500 dark:text-gray-400">Sex Filter</span>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">
                      {conditionDetails.sex_filter || 'Both'}
                    </p>
                  </div>
                </div>

                {conditionDetails.extras?.hint && (
                  <div>
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Clinical Information:</span>
                    <p className="text-gray-600 dark:text-gray-300 mt-2 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      {conditionDetails.extras.hint}
                    </p>
                  </div>
                )}

                {conditionDetails.extras?.icd10_code && (
                  <div>
                    <span className="text-lg font-medium text-gray-700 dark:text-gray-300">ICD-10 Code:</span>
                    <span className="ml-2 px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm font-mono">
                      {conditionDetails.extras.icd10_code}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Risk Factors Analysis */}
          {riskFactorDetails.length > 0 && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Shield className="h-6 w-6 mr-3 text-green-500" />
                Risk Factors Analysis
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {riskFactorDetails.map((riskFactor, index) => (
                  <div key={index} className="p-4 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {riskFactor.common_name || riskFactor.name}
                      </h3>
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                        {riskFactor.category}
                      </span>
                    </div>
                    
                    {riskFactor.extras?.hint && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                        {riskFactor.extras.hint}
                      </p>
                    )}
                    
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Status: Present in patient profile
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Medical Explanation */}
          {explainData && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Info className="h-6 w-6 mr-3 text-purple-500" />
                Medical Explanation
              </h2>
              
              <div className="space-y-4">
                {explainData.supporting_evidence && explainData.supporting_evidence.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Supporting Evidence:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {explainData.supporting_evidence.map((evidence: any, index: number) => (
                        <span 
                          key={index}
                          className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm"
                        >
                          {evidence.name || evidence.id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {explainData.conflicting_evidence && explainData.conflicting_evidence.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Conflicting Evidence:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {explainData.conflicting_evidence.map((evidence: any, index: number) => (
                        <span 
                          key={index}
                          className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full text-sm"
                        >
                          {evidence.name || evidence.id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {explainData.unconfirmed_evidence && explainData.unconfirmed_evidence.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Unconfirmed Evidence:
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {explainData.unconfirmed_evidence.map((evidence: any, index: number) => (
                        <span 
                          key={index}
                          className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-sm"
                        >
                          {evidence.name || evidence.id}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Additional Information from Gemini */}
          {diagnosisData.conditions.length > 0 && (
            <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6 flex items-center">
                <Brain className="h-6 w-6 mr-3 text-purple-500" />
                Additional Information: {diagnosisData.conditions[0].common_name || diagnosisData.conditions[0].name}
              </h2>
              
              {loadingGemini ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mr-3"></div>
                  <p className="text-gray-600 dark:text-gray-400">Loading additional information...</p>
                </div>
              ) : geminiError ? (
                <div className="flex items-center justify-center py-8">
                  <p className="text-red-500 dark:text-red-400">Error: {geminiError}</p>
                </div>
              ) : geminiInfo ? (
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  {geminiInfo.split('\n').map((paragraph, index) => {
                    if (paragraph.trim()) {
                      // Handle bold headers
                      if (paragraph.includes('**')) {
                        const parts = paragraph.split('**')
                        return (
                          <p key={index} className="mb-3">
                            {parts.map((part, i) => 
                              i % 2 === 1 ? (
                                <strong key={i} className="font-semibold text-gray-900 dark:text-white">{part}</strong>
                              ) : (
                                <span key={i}>{part}</span>
                              )
                            )}
                          </p>
                        )
                      }
                      return (
                        <p key={index} className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed">
                          {paragraph}
                        </p>
                      )
                    }
                    return <br key={index} />
                  })}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  Additional information is currently unavailable.
                </p>
              )}
            </div>
          )}

          {/* Advanced Analysis Section - Now integrated above */}

          {/* Important Disclaimer */}
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl p-6">
            <div className="flex items-start">
              <Shield className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mr-3 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                  Important Medical Disclaimer
                </h3>
                <p className="text-yellow-800 dark:text-yellow-200 text-sm leading-relaxed">
                  This assessment is for educational and informational purposes only and should not be considered 
                  as medical advice, diagnosis, or treatment. The results are based on AI analysis of reported 
                  symptoms and should not replace professional medical consultation. Always consult with a 
                  qualified healthcare provider for proper medical evaluation, diagnosis, and treatment of any 
                  health concerns.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={downloadResults}
              className="flex items-center justify-center px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Results
            </button>
            <button
              onClick={() => router.push("/chatbot")}
              className="flex items-center justify-center px-6 py-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors shadow-md hover:shadow-lg"
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
