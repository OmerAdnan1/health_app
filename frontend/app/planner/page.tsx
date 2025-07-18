"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { Calendar, CheckCircle, Target, TrendingUp, Award, ArrowLeft } from "lucide-react"

export default function PlannerPage() {
  const router = useRouter()
  const [recoveryPlan, setRecoveryPlan] = useState(null)
  const [completedTasks, setCompletedTasks] = useState({})

  useEffect(() => {
    // Generate recovery plan based on assessment
    const assessment = localStorage.getItem("healthAssessment")
    if (assessment) {
      const data = JSON.parse(assessment)
      generateRecoveryPlan(data.responses)
    } else {
      // Default plan if no assessment
      generateRecoveryPlan({})
    }
  }, [])

  const generateRecoveryPlan = (responses) => {
    const symptoms = responses.symptoms?.toLowerCase() || ""
    const severity = Number.parseInt(responses.severity) || 5

    let planType = "General Wellness"
    let dailyTasks = []

    // Customize plan based on symptoms
    if (symptoms.includes("headache") || symptoms.includes("head")) {
      planType = "Headache Relief Plan"
      dailyTasks = [
        "Apply cold/warm compress for 15-20 minutes",
        "Practice deep breathing exercises",
        "Stay hydrated (8-10 glasses of water)",
        "Limit screen time and bright lights",
        "Get adequate sleep (7-9 hours)",
        "Gentle neck and shoulder stretches",
      ]
    } else if (symptoms.includes("fever") || symptoms.includes("temperature")) {
      planType = "Recovery from Viral Infection"
      dailyTasks = [
        "Rest and avoid strenuous activities",
        "Drink plenty of fluids",
        "Monitor temperature regularly",
        "Take prescribed medications as directed",
        "Eat light, nutritious meals",
        "Practice good hygiene",
      ]
    } else if (symptoms.includes("cough") || symptoms.includes("throat")) {
      planType = "Respiratory Recovery Plan"
      dailyTasks = [
        "Use humidifier or steam inhalation",
        "Drink warm liquids (tea, broth)",
        "Avoid irritants (smoke, strong odors)",
        "Practice gentle breathing exercises",
        "Get plenty of rest",
        "Take throat lozenges as needed",
      ]
    } else {
      dailyTasks = [
        "Maintain regular sleep schedule",
        "Stay hydrated throughout the day",
        "Eat balanced, nutritious meals",
        "Practice stress management techniques",
        "Engage in light physical activity",
        "Monitor symptoms and progress",
      ]
    }

    const plan = {
      type: planType,
      duration: "7 days",
      dailyTasks,
      days: Array.from({ length: 7 }, (_, index) => ({
        day: index + 1,
        date: new Date(Date.now() + index * 24 * 60 * 60 * 1000).toLocaleDateString(),
        tasks: dailyTasks.map((task, taskIndex) => ({
          id: `day${index + 1}_task${taskIndex}`,
          description: task,
          completed: false,
          priority: taskIndex < 3 ? "high" : "medium",
        })),
      })),
    }

    setRecoveryPlan(plan)
  }

  const toggleTask = (dayIndex, taskId) => {
    setCompletedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }))
  }

  const getDayProgress = (day) => {
    const totalTasks = day.tasks.length
    const completed = day.tasks.filter((task) => completedTasks[task.id]).length
    return Math.round((completed / totalTasks) * 100)
  }

  const getOverallProgress = () => {
    if (!recoveryPlan) return 0
    const totalTasks = recoveryPlan.days.reduce((sum, day) => sum + day.tasks.length, 0)
    const completedCount = Object.values(completedTasks).filter(Boolean).length
    return Math.round((completedCount / totalTasks) * 100)
  }

  if (!recoveryPlan) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <Header />
        <main className="flex-1 pt-16 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Creating your personalized recovery plan...</p>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 pt-16 p-4 sm:p-6 lg:p-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <button
                onClick={() => router.back()}
                className="flex items-center text-blue-600 hover:text-blue-700 mb-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Results
              </button>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">{recoveryPlan.type}</h1>
              <p className="text-lg text-gray-600">Your personalized {recoveryPlan.duration} recovery journey</p>
            </div>

            <div className="text-right">
              <div className="text-3xl font-bold text-green-600 mb-1">{getOverallProgress()}%</div>
              <div className="text-sm text-gray-500">Complete</div>
            </div>
          </div>

          {/* Progress Overview */}
          <div className="grid md:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <Calendar className="h-6 w-6 text-blue-500" />
                <span className="font-semibold text-gray-900">Duration</span>
              </div>
              <p className="text-2xl font-bold text-blue-600">{recoveryPlan.duration}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <Target className="h-6 w-6 text-green-500" />
                <span className="font-semibold text-gray-900">Daily Tasks</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{recoveryPlan.dailyTasks.length}</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <TrendingUp className="h-6 w-6 text-purple-500" />
                <span className="font-semibold text-gray-900">Progress</span>
              </div>
              <p className="text-2xl font-bold text-purple-600">{getOverallProgress()}%</p>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-lg">
              <div className="flex items-center space-x-3 mb-2">
                <Award className="h-6 w-6 text-yellow-500" />
                <span className="font-semibold text-gray-900">Completed</span>
              </div>
              <p className="text-2xl font-bold text-yellow-600">
                {Object.values(completedTasks).filter(Boolean).length}
              </p>
            </div>
          </div>

          {/* Daily Plans */}
          <div className="space-y-6">
            {recoveryPlan.days.map((day, dayIndex) => {
              const progress = getDayProgress(day)
              const isToday = dayIndex === 0 // Simulate current day

              return (
                <div
                  key={day.day}
                  className={`bg-white rounded-2xl shadow-lg p-8 ${
                    isToday ? "ring-2 ring-blue-500 ring-opacity-50" : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-white ${
                          progress === 100 ? "bg-green-500" : isToday ? "bg-blue-500" : "bg-gray-400"
                        }`}
                      >
                        {progress === 100 ? <CheckCircle className="h-6 w-6" /> : day.day}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          Day {day.day}
                          {isToday && (
                            <span className="ml-2 px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                              Today
                            </span>
                          )}
                        </h3>
                        <p className="text-gray-600">{day.date}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900 mb-1">{progress}%</div>
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            progress === 100 ? "bg-green-500" : "bg-blue-500"
                          }`}
                          style={{ width: `${progress}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    {day.tasks.map((task, taskIndex) => (
                      <div
                        key={task.id}
                        className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                          completedTasks[task.id]
                            ? "bg-green-50 border-green-200"
                            : "bg-gray-50 border-gray-200 hover:border-blue-300"
                        }`}
                      >
                        <div className="flex items-start space-x-3">
                          <button
                            onClick={() => toggleTask(dayIndex, task.id)}
                            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              completedTasks[task.id]
                                ? "bg-green-500 border-green-500"
                                : "border-gray-300 hover:border-blue-500"
                            }`}
                          >
                            {completedTasks[task.id] && <CheckCircle className="h-3 w-3 text-white" />}
                          </button>
                          <div className="flex-1">
                            <p
                              className={`text-sm ${
                                completedTasks[task.id] ? "text-green-800 line-through" : "text-gray-700"
                              }`}
                            >
                              {task.description}
                            </p>
                            <div className="flex items-center space-x-2 mt-2">
                              <span
                                className={`px-2 py-1 text-xs font-medium rounded-full ${
                                  task.priority === "high" ? "bg-red-100 text-red-800" : "bg-yellow-100 text-yellow-800"
                                }`}
                              >
                                {task.priority} priority
                              </span>
                              {completedTasks[task.id] && (
                                <span className="flex items-center text-xs text-green-600">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Summary Card */}
          <div className="bg-gradient-to-r from-blue-600 to-green-600 rounded-2xl p-8 text-white">
            <div className="text-center">
              <h2 className="text-2xl font-bold mb-4">Keep Up the Great Work!</h2>
              <p className="text-lg mb-6 opacity-90">
                Consistency is key to recovery. Complete your daily tasks and track your progress.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => router.push("/dashboard")}
                  className="px-6 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
                >
                  View Dashboard
                </button>
                <button
                  onClick={() => router.push("/chatbot")}
                  className="px-6 py-3 border-2 border-white text-white rounded-xl font-semibold hover:bg-white hover:text-blue-600 transition-colors"
                >
                  New Assessment
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
