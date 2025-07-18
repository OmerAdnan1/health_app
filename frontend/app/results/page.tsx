"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts"
import { AlertTriangle, CheckCircle, TrendingUp, Calendar, ArrowRight, Stethoscope, Clock, Target } from "lucide-react"

export default function ResultsPage() {
  const router = useRouter()
  const [assessment, setAssessment] = useState(null)
  const [diagnosis, setDiagnosis] = useState(null)

  useEffect(() => {
    // Get assessment data from localStorage
    const storedAssessment = localStorage.getItem("healthAssessment")
    if (storedAssessment) {
      const data = JSON.parse(storedAssessment)
      setAssessment(data)

      // Generate diagnosis based on responses
      generateDiagnosis(data.responses)
    } else {
      router.push("/chatbot")
    }
  }, [router])

  const generateDiagnosis = (responses) => {
    // Mock AI diagnosis logic
    const symptoms = responses.symptoms?.toLowerCase() || ""
    const severity = Number.parseInt(responses.severity) || 5
    const duration = responses.duration || ""

    let condition = "General Health Concern"
    let confidence = 75
    let recommendation = "monitor"
    let description = "Based on your symptoms, this appears to be a common health concern."

    // Simple symptom matching
    if (symptoms.includes("headache") || symptoms.includes("head")) {
      condition = "Tension Headache"
      confidence = 85
      description =
        "Your symptoms suggest a tension-type headache, commonly caused by stress, poor posture, or muscle tension."
    } else if (symptoms.includes("fever") || symptoms.includes("temperature")) {
      condition = "Viral Infection"
      confidence = 80
      description = "Your symptoms indicate a possible viral infection. Rest and hydration are typically recommended."
    } else if (symptoms.includes("cough") || symptoms.includes("throat")) {
      condition = "Upper Respiratory Symptoms"
      confidence = 78
      description = "Your symptoms suggest an upper respiratory condition, possibly viral in nature."
    } else if (symptoms.includes("stomach") || symptoms.includes("nausea")) {
      condition = "Gastrointestinal Distress"
      confidence = 82
      description =
        "Your symptoms indicate gastrointestinal upset, which could be due to various factors including diet or stress."
    }

    // Adjust recommendation based on severity and duration
    if (severity >= 8 || duration.includes("More than 2 weeks")) {
      recommendation = "urgent"
    } else if (severity >= 6 || duration.includes("1-2 weeks")) {
      recommendation = "consult"
    }

    setDiagnosis({
      condition,
      confidence,
      recommendation,
      description,
      severity,
      duration: responses.duration,
    })
  }

  const trajectoryData = [
    { day: "Day 1", withTreatment: 100, withoutTreatment: 100 },
    { day: "Day 2", withTreatment: 85, withoutTreatment: 95 },
    { day: "Day 3", withTreatment: 70, withoutTreatment: 90 },
    { day: "Day 4", withTreatment: 55, withoutTreatment: 85 },
    { day: "Day 5", withTreatment: 40, withoutTreatment: 80 },
    { day: "Day 6", withTreatment: 25, withoutTreatment: 75 },
    { day: "Day 7", withTreatment: 15, withoutTreatment: 70 },
    { day: "Day 8", withTreatment: 10, withoutTreatment: 65 },
    { day: "Day 9", withTreatment: 5, withoutTreatment: 60 },
    { day: "Day 10", withTreatment: 0, withoutTreatment: 55 },
  ]

  const getRecommendationConfig = (recommendation) => {
    switch (recommendation) {
      case "urgent":
        return {
          color: "red",
          bgColor: "bg-red-50",
          borderColor: "border-red-200",
          textColor: "text-red-800",
          icon: AlertTriangle,
          title: "Seek Immediate Medical Attention",
          message:
            "Your symptoms warrant prompt medical evaluation. Please consult a healthcare provider as soon as possible.",
        }
      case "consult":
        return {
          color: "yellow",
          bgColor: "bg-yellow-50",
          borderColor: "border-yellow-200",
          textColor: "text-yellow-800",
          icon: Stethoscope,
          title: "Consider Medical Consultation",
          message: "We recommend scheduling an appointment with your healthcare provider to discuss your symptoms.",
        }
      default:
        return {
          color: "green",
          bgColor: "bg-green-50",
          borderColor: "border-green-200",
          textColor: "text-green-800",
          icon: CheckCircle,
          title: "Monitor and Self-Care",
          message:
            "Your symptoms can likely be managed with self-care. Monitor your condition and seek help if symptoms worsen.",
        }
    }
  }

  if (!assessment || !diagnosis) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing your symptoms...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const recommendationConfig = getRecommendationConfig(diagnosis.recommendation)
  const RecommendationIcon = recommendationConfig.icon

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 pt-16 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Your Health Analysis Results</h1>
            <p className="text-lg text-gray-600">Based on your symptoms and responses, here's what we found</p>
          </div>

          {/* Diagnosis Card */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Preliminary Assessment</h2>
                <p className="text-gray-600">AI-powered analysis of your symptoms</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-blue-600 mb-1">{diagnosis.confidence}%</div>
                <div className="text-sm text-gray-500">Confidence</div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3">{diagnosis.condition}</h3>
                <p className="text-gray-600 mb-4">{diagnosis.description}</p>

                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <Target className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-gray-600">Severity Level: {diagnosis.severity}/10</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-blue-500" />
                    <span className="text-sm text-gray-600">Duration: {diagnosis.duration}</span>
                  </div>
                </div>
              </div>

              <div
                className={`p-6 rounded-xl ${recommendationConfig.bgColor} ${recommendationConfig.borderColor} border`}
              >
                <div className="flex items-start space-x-3">
                  <RecommendationIcon className={`h-6 w-6 ${recommendationConfig.textColor} mt-1`} />
                  <div>
                    <h4 className={`font-semibold ${recommendationConfig.textColor} mb-2`}>
                      {recommendationConfig.title}
                    </h4>
                    <p className={`text-sm ${recommendationConfig.textColor}`}>{recommendationConfig.message}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recovery Trajectory */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-6">
              <TrendingUp className="h-6 w-6 text-blue-500" />
              <h2 className="text-2xl font-bold text-gray-900">Recovery Trajectory</h2>
            </div>

            <p className="text-gray-600 mb-8">
              Projected recovery timeline based on similar cases and treatment approaches
            </p>

            <div className="h-80 mb-6">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trajectoryData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis label={{ value: "Symptom Severity (%)", angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="withoutTreatment"
                    stackId="1"
                    stroke="#EF4444"
                    fill="#FEE2E2"
                    name="Without Treatment"
                  />
                  <Area
                    type="monotone"
                    dataKey="withTreatment"
                    stackId="2"
                    stroke="#10B981"
                    fill="#D1FAE5"
                    name="With Recommended Care"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-green-200 border-2 border-green-500 rounded"></div>
                <span className="text-sm text-gray-600">With Recommended Care</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 bg-red-200 border-2 border-red-500 rounded"></div>
                <span className="text-sm text-gray-600">Without Treatment</span>
              </div>
            </div>
          </div>

          {/* Symptom Tags */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Reported Symptoms</h2>

            <div className="flex flex-wrap gap-3">
              {assessment.responses.symptoms
                ?.split(/[,\s]+/)
                .filter((word) => word.length > 2)
                .map((symptom, index) => (
                  <span key={index} className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    {symptom.charAt(0).toUpperCase() + symptom.slice(1)}
                  </span>
                ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => router.push("/planner")}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl font-semibold text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 flex items-center justify-center"
            >
              <Calendar className="h-5 w-5 mr-2" />
              Create Recovery Plan
              <ArrowRight className="h-5 w-5 ml-2" />
            </button>

            <button
              onClick={() => router.push("/dashboard")}
              className="px-8 py-4 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold text-lg hover:border-blue-500 hover:text-blue-600 transition-colors duration-300"
            >
              Save to Dashboard
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
