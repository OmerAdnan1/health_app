"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import {
  Send,
  Bot,
  User,
  Lightbulb,
  CheckCircle,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Activity,
  TrendingUp,
  Stethoscope,
  AlertTriangle,
  Info,
} from "lucide-react"
import { v4 as uuidv4 } from "uuid"

// Type Definitions
type Message = {
  id: number
  content: string | InfermedicaQuestion
  sender: "bot" | "user"
  timestamp: Date
}

type InfermedicaChoice = {
  id: "present" | "absent" | "unknown"
  label: string
}

type InfermedicaQuestionItem = {
  id: string
  name: string
  choices: InfermedicaChoice[]
}

type InfermedicaQuestion = {
  type: "single" | "group_single" | "group_multiple"
  text: string
  items: InfermedicaQuestionItem[]
}

type EvidenceItem = {
  id: string
  choice_id: "present" | "absent" | "unknown"
}

type Condition = {
  id: string
  name: string
  common_name: string
  probability: number
}

type InitialQuestion = {
  id: string
  question: string
  type: "age" | "select" | "text"
  options?: string[]
  tips: string[]
}

// Helper function to safely parse API responses
const parseJsonResponse = async (response: Response) => {
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

export default function ChatbotPage() {
  const router = useRouter()
  const [userAge, setUserAge] = useState<number | null>(null)
  const [userSex, setUserSex] = useState<"male" | "female" | "other" | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [currentInput, setCurrentInput] = useState<string>("")
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null)
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const [interviewId, setInterviewId] = useState<string | null>(null)

  const [currDiagnosisQuestions, setCurrDiagnosisQuestions] = useState<InfermedicaQuestion | null>(null)
  const [currDiagnosisConditions, setCurrDiagnosisConditions] = useState<Condition[]>([])
  const [isDiagnosisComplete, setIsDiagnosisComplete] = useState<boolean>(false)
  const [tempGroupedSelections, setTempGroupedSelections] = useState<Record<string, "present" | "absent" | "unknown">>(
    {},
  )
  const MAX_DIAGNOSIS_QUESTIONS = 8
  const [diagnosisQuestionCount, setDiagnosisQuestionCount] = useState(0)

  // Initial fixed questions for the bot
  const questions: InitialQuestion[] = [
    {
      id: "age_input",
      question: "Hi! Please tell me your age.",
      type: "age",
      tips: [
        "Tell your exact age in years",
        "This helps provide age-appropriate health insights",
        "Your age information is kept private and secure",
      ],
    },
    {
      id: "sex_input",
      question: "What is your gender?",
      type: "select",
      options: ["male", "female", "other"],
      tips: [
        "This helps provide gender-specific health insights",
        "If you prefer not to specify, select 'other'",
        "Your privacy is our top priority",
      ],
    },
    {
      id: "symptoms",
      question: "What symptoms are you experiencing? Please describe them in detail.",
      type: "text",
      tips: [
        "Be specific about location, intensity, and duration",
        "Mention any triggers you've noticed",
        "Include associated symptoms for better analysis",
      ],
    },
  ]

  // Initial bot message on component mount
  useEffect(() => {
    if (messages.length === 0) {
      setTimeout(() => {
        addBotMessage(
          "Hello! I'm your HealthBuddy AI assistant. I'll help analyze your symptoms and provide personalized health insights. Let's start with a few questions.",
        )
        setTimeout(() => {
          addBotMessage(questions[0].question)
        }, 1500)
      }, 500)
    }
  }, [])

  // Improved scroll behavior - only scroll when user is near bottom
  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      const container = chatContainerRef.current
      const isNearBottom = container.scrollTop + container.clientHeight >= container.scrollHeight - 200

      if (isNearBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
      }
    }
  }

  // Generate unique ID for messages
  const generateUniqueId = () => Date.now() + Math.random()

  // Add bot message with typing indicator
  const addBotMessage = (content: string | InfermedicaQuestion) => {
    setIsTyping(true)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: generateUniqueId(),
          content,
          sender: "bot",
          timestamp: new Date(),
        },
      ])
      setIsTyping(false)
      // Only scroll if user was already near bottom
      setTimeout(scrollToBottom, 100)
    }, 800)
  }

  // Add user message with smart scrolling
  const addUserMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: generateUniqueId(),
        content,
        sender: "user",
        timestamp: new Date(),
      },
    ])
    // Always scroll after user message since they just interacted
    setTimeout(scrollToBottom, 100)
  }

  // Speech recognition function
  const startListening = () => {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
      addBotMessage("Speech recognition is not supported in your browser. Please type your response.")
      return
    }

    const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
    const recognition = new SpeechRecognition()

    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onstart = () => {
      setIsListening(true)
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      setCurrentInput(transcript)
      setIsListening(false)
    }

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error)
      setIsListening(false)
      if (event.error === "not-allowed") {
        addBotMessage("Microphone access was denied. Please enable microphone permissions and try again.")
      }
    }

    recognition.onend = () => {
      setIsListening(false)
    }

    recognition.start()
  }

  // Display current conditions with probabilities
  const displayConditionsUpdate = (conditions: Condition[]) => {
    if (conditions && conditions.length > 0) {
      const sortedConditions = conditions.sort((a, b) => b.probability - a.probability)
      let conditionsMessage = "📊 Current possible conditions based on your symptoms:\n\n"

      sortedConditions.slice(0, 3).forEach((condition, index) => {
        const percentage = (condition.probability * 100).toFixed(1)
        const emoji = index === 0 ? "🔴" : index === 1 ? "🟡" : "🟢"
        conditionsMessage += `${emoji} ${condition.common_name || condition.name}: ${percentage}%\n`
      })

      conditionsMessage += "\n💡 These are preliminary assessments. Let's continue with more questions for accuracy."
      addBotMessage(conditionsMessage)
    }
  }

  // Check if all items in a grouped_multiple question have been answered
  const areAllItemsAnswered = (question: InfermedicaQuestion, selections: Record<string, string>) => {
    if (!question || !question.items) return false
    return question.items.every((item) => selections[item.id] !== undefined)
  }

  // Handles confirmation for grouped_multiple questions
  const handleGroupedMultipleConfirm = async () => {
    if (!currDiagnosisQuestions) return

    const allAnswered = areAllItemsAnswered(currDiagnosisQuestions, tempGroupedSelections)

    if (!allAnswered) {
      const unansweredCount = currDiagnosisQuestions.items.length - Object.keys(tempGroupedSelections).length
      addBotMessage(
        `Please answer all ${currDiagnosisQuestions.items.length} questions. You have ${unansweredCount} remaining.`,
      )
      return
    }

    setIsTyping(true)
    addUserMessage("Confirmed selections.")

    const newEvidenceToAdd: EvidenceItem[] = Object.entries(tempGroupedSelections).map(([id, choice_id]) => ({
      id,
      choice_id: choice_id as "present" | "absent" | "unknown",
    }))

    setTempGroupedSelections({})

    const combinedEvidence = [
      ...evidence.filter((item) => !newEvidenceToAdd.some((newItem) => newItem.id === item.id)),
      ...newEvidenceToAdd,
    ]

    setEvidence(combinedEvidence)

    setTimeout(async () => {
      try {
        if (diagnosisQuestionCount + 1 >= MAX_DIAGNOSIS_QUESTIONS) {
          const finalDiagnosisResult = await getDiagnosis(combinedEvidence)
          setDiagnosisResult(JSON.stringify(finalDiagnosisResult, null, 2))
          setCurrDiagnosisConditions(finalDiagnosisResult.conditions || [])
          setIsDiagnosisComplete(true)
          setCurrDiagnosisQuestions(null)
          setDiagnosisQuestionCount((prev) => prev + 1)

          displayFinalDiagnosis(finalDiagnosisResult.conditions)
          setIsTyping(false)
          return
        }

        const nextDiagnosisResult = await getDiagnosis(combinedEvidence)
        setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2))
        setCurrDiagnosisConditions(nextDiagnosisResult.conditions || [])
        setIsDiagnosisComplete(nextDiagnosisResult.should_stop)
        setCurrDiagnosisQuestions(nextDiagnosisResult.question || null)
        setDiagnosisQuestionCount((prev) => prev + 1)

        setIsTyping(false)

        if (nextDiagnosisResult.conditions && nextDiagnosisResult.conditions.length > 0) {
          displayConditionsUpdate(nextDiagnosisResult.conditions)
        }

        if (nextDiagnosisResult.should_stop) {
          displayFinalDiagnosis(nextDiagnosisResult.conditions)
        } else if (nextDiagnosisResult.question) {
          setTimeout(() => {
            addBotMessage(nextDiagnosisResult.question)
          }, 2000)
        } else {
          addBotMessage(
            "The diagnosis process needs more information, but I couldn't generate the next question. Please consult a healthcare professional.",
          )
        }
      } catch (error) {
        console.error("Error during grouped_multiple diagnosis confirmation:", error)
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred."
        addBotMessage(`An error occurred: ${errorMessage}. Please try again.`)
        setIsTyping(false)
      }
    }, 1000)
  }

  // Helper function to proceed with diagnosis (for single/group_single types)
  const proceedWithDiagnosis = async (currentEvidence: EvidenceItem[]) => {
    setIsTyping(true)

    setTimeout(async () => {
      try {
        if (diagnosisQuestionCount + 1 >= MAX_DIAGNOSIS_QUESTIONS) {
          const finalDiagnosisResult = await getDiagnosis(currentEvidence)
          setDiagnosisResult(JSON.stringify(finalDiagnosisResult, null, 2))
          setCurrDiagnosisConditions(finalDiagnosisResult.conditions || [])
          setIsDiagnosisComplete(true)
          setCurrDiagnosisQuestions(null)
          setDiagnosisQuestionCount((prev) => prev + 1)

          displayFinalDiagnosis(finalDiagnosisResult.conditions)
          setIsTyping(false)
          return
        }

        const nextDiagnosisResult = await getDiagnosis(currentEvidence)
        setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2))
        setCurrDiagnosisConditions(nextDiagnosisResult.conditions || [])
        setIsDiagnosisComplete(nextDiagnosisResult.should_stop)
        setCurrDiagnosisQuestions(nextDiagnosisResult.question || null)
        setDiagnosisQuestionCount((prev) => prev + 1)

        setIsTyping(false)

        if (nextDiagnosisResult.conditions && nextDiagnosisResult.conditions.length > 0) {
          displayConditionsUpdate(nextDiagnosisResult.conditions)
        }

        if (nextDiagnosisResult.should_stop) {
          displayFinalDiagnosis(nextDiagnosisResult.conditions)
        } else if (nextDiagnosisResult.question) {
          setTimeout(() => {
            addBotMessage(nextDiagnosisResult.question)
          }, 2000)
        } else {
          addBotMessage(
            "The diagnosis process needs more information, but I couldn't generate the next question. Please consult a healthcare professional.",
          )
        }
      } catch (error) {
        console.error("Error during diagnosis:", error)
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred."
        addBotMessage(`An error occurred: ${errorMessage}. Please try again.`)
        setIsTyping(false)
      }
    }, 1000)
  }

  // Main message handling logic
  const handleSendMessage = async (input?: string) => {
    const value = input !== undefined ? input : currentInput
    if (!value.trim()) return

    setCurrentInput("")

    // Handle Infermedica questions first
    if (currDiagnosisQuestions && !isDiagnosisComplete) {
      const parts = value.split(":")
      if (parts.length === 2) {
        const itemId = parts[0]
        const choiceId = parts[1] as "present" | "absent" | "unknown"

        if (!["present", "absent", "unknown"].includes(choiceId)) {
          addBotMessage("Invalid answer. Please select one of the provided options.")
          return
        }

        const currentQ = currDiagnosisQuestions as InfermedicaQuestion
        const chosenItem = currentQ?.items.find((item) => item.id === itemId)
        const chosenLabel = chosenItem?.choices.find((choice) => choice.id === choiceId)?.label || choiceId
        addUserMessage(chosenItem ? `${chosenItem.name}: ${chosenLabel}` : chosenLabel)

        const questionType = currDiagnosisQuestions.type

        if (questionType === "single" || questionType === "group_single") {
          const newEvidence = [...evidence.filter((item) => item.id !== itemId), { id: itemId, choice_id: choiceId }]
          setEvidence(newEvidence)
          await proceedWithDiagnosis(newEvidence)
        } else if (questionType === "group_multiple") {
          setTempGroupedSelections((prev) => ({
            ...prev,
            [itemId]: choiceId,
          }))
        }
      } else {
        addBotMessage("Please use the provided buttons to answer the health questions.")
      }
      return
    }

    // Handle initial fixed questions
    if (currentStep < questions.length) {
      const currentFixedQuestion = questions[currentStep]
      addUserMessage(value)

      if (currentFixedQuestion.id === "age_input") {
        const age = Number.parseInt(value, 10)
        if (isNaN(age) || age <= 0 || age > 120) {
          addBotMessage("Please enter a valid age in years (e.g., 30).")
          return
        }
        setUserAge(age)
        setCurrentStep(currentStep + 1)
        setTimeout(() => {
          addBotMessage(questions[currentStep + 1].question)
        }, 1000)
        return
      } else if (currentFixedQuestion.id === "sex_input") {
        const sex = value.toLowerCase()
        if (!["male", "female", "other"].includes(sex)) {
          addBotMessage("Please select from 'male', 'female', or 'other'.")
          return
        }
        setUserSex(sex as "male" | "female" | "other")
        if (!interviewId) {
          setInterviewId(uuidv4())
        }
        setCurrentStep(currentStep + 1)
        setTimeout(() => {
          addBotMessage(questions[currentStep + 1].question)
        }, 1000)
        return
      } else if (currentFixedQuestion.id === "symptoms") {
        if (value.length < 10) {
          addBotMessage("Please provide a more detailed description of your symptoms (at least 10 characters).")
          return
        }

        try {
          addBotMessage("Thank you for sharing your symptoms. Let me analyze them...")
          setIsTyping(true)

          const result = await getParseResult(value)
          if (!result || !Array.isArray(result.mentions)) {
            throw new Error("Received an invalid response format for symptom analysis. Please try again.")
          }

          const initialEvidence: EvidenceItem[] = result.mentions.map((mention: any) => ({
            id: mention.id,
            choice_id: mention.choice_id,
          }))

          if (initialEvidence.length === 0) {
            addBotMessage(
              "I couldn't identify any symptoms from your description. Could you please rephrase or provide more details? For example, 'I have a headache and a fever.'",
            )
            setIsTyping(false)
            return
          }

          setEvidence(initialEvidence)
          const diagnosis = await getDiagnosis(initialEvidence)

          if (!diagnosis) {
            throw new Error("No diagnosis data received from the API.")
          }

          setDiagnosisResult(JSON.stringify(diagnosis, null, 2))
          setCurrDiagnosisConditions(diagnosis.conditions || [])
          setIsDiagnosisComplete(diagnosis.should_stop)
          setCurrDiagnosisQuestions(diagnosis.question || null)

          setIsTyping(false)

          if (diagnosis.conditions && diagnosis.conditions.length > 0) {
            displayConditionsUpdate(diagnosis.conditions)
          }

          if (diagnosis.should_stop) {
            displayFinalDiagnosis(diagnosis.conditions)
          } else if (diagnosis.question) {
            setTimeout(() => {
              addBotMessage(diagnosis.question)
            }, 2000)
          } else {
            addBotMessage(
              "The diagnosis process encountered an unexpected state. Please consult a healthcare professional.",
            )
          }
        } catch (error) {
          console.error("Error during initial diagnosis process:", error)
          const errorMessage = error instanceof Error ? error.message : "An unknown error occurred."
          addBotMessage(`An error occurred: ${errorMessage}. Please try again.`)
          setIsTyping(false)
        }
        return
      }
    }

    if (isDiagnosisComplete) {
      addBotMessage(
        "The diagnosis is complete. Please click 'Start a New Diagnosis' if you wish to begin a new assessment. 🔄",
      )
      return
    }

    addBotMessage("An unexpected state occurred. Please try again or refresh the page.")
  }

  // API calls
  const getDiagnosis = async (currentEvidence: EvidenceItem[]) => {
    if (userAge === null || userSex === null || currentEvidence.length === 0) {
      throw new Error("Diagnosis prerequisites are missing (age, sex, or initial evidence).")
    }

    if (!interviewId) {
      throw new Error("An internal error occurred: Interview ID missing.")
    }

    const uniqueEvidenceMap = new Map<string, EvidenceItem>()
    for (const item of currentEvidence) {
      if (!uniqueEvidenceMap.has(item.id)) {
        uniqueEvidenceMap.set(item.id, item)
      }
    }
    const dedupedEvidence = Array.from(uniqueEvidenceMap.values())

    const payload = {
      age: { value: userAge, unit: "year" },
      sex: userSex,
      evidence: dedupedEvidence,
    }

    try {
      const res = await fetch("http://localhost:5000/api/infermedica/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Interview-Id": interviewId },
        body: JSON.stringify(payload),
      })
      return await parseJsonResponse(res)
    } catch (error) {
      console.error("API call to /diagnosis failed:", error)
      throw error
    }
  }

  const getParseResult = async (responseString: string) => {
    if (userAge === null || userSex === null) {
      throw new Error("Parsing prerequisites are missing (age or sex).")
    }

    if (!interviewId) {
      throw new Error("An internal error occurred: Interview ID missing for parsing.")
    }

    const payload = {
      age: { value: userAge, unit: "year" },
      sex: userSex,
      text: responseString,
      context: [],
      include_tokens: true,
      correct_spelling: true,
      concept_types: ["symptom"],
      interviewId: interviewId,
    }

    try {
      const res = await fetch("http://localhost:5000/api/infermedica/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Interview-Id": interviewId },
        body: JSON.stringify(payload),
      })
      return await parseJsonResponse(res)
    } catch (error) {
      console.error("API call to /parse failed:", error)
      throw error
    }
  }

  // Enhanced final diagnosis display
  const displayFinalDiagnosis = (conditions: Condition[]) => {
    // Create a structured final diagnosis message
    const finalDiagnosisContent = {
      type: "final_diagnosis",
      conditions: conditions || [],
    }

    addBotMessage(finalDiagnosisContent as any)
  }

  const currentQuestion = questions[currentStep]

  // Text-to-Speech
  const speakMessage = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      speechSynthesis.speak(utterance)
    }
  }

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col transition-colors">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-50">
        <Header />
      </div>

      <main className="flex-1 flex mt-16">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Header Section */}
          <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 border-b border-gray-200/50 dark:border-gray-700/50 p-6 transition-colors">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center mb-4">
                <div className="p-3 bg-gradient-to-r from-blue-500 to-green-500 rounded-full mr-4">
                  <Activity className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">AI Health Assessment</h1>
                  <p className="text-gray-600 dark:text-gray-400">Powered by advanced medical AI • Secure & Private</p>
                </div>
              </div>

              {isDiagnosisComplete ? (
                <div className="inline-flex items-center px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full text-sm font-medium">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Assessment Complete
                </div>
              ) : currDiagnosisQuestions ? (
                <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Analyzing Symptoms... ({diagnosisQuestionCount}/{MAX_DIAGNOSIS_QUESTIONS})
                </div>
              ) : (
                <div className="inline-flex items-center px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200 rounded-full text-sm font-medium">
                  <Bot className="h-4 w-4 mr-2" />
                  Initial Assessment
                </div>
              )}
            </div>
          </div>

          {/* Messages */}
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex items-start space-x-4 max-w-3xl ${message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
                  >
                    <div
                      className={`flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                        message.sender === "user"
                          ? "bg-gradient-to-r from-blue-500 to-blue-600"
                          : "bg-gradient-to-r from-green-500 to-blue-500"
                      }`}
                    >
                      {message.sender === "user" ? (
                        <User className="h-6 w-6 text-white" />
                      ) : (
                        <Bot className="h-6 w-6 text-white" />
                      )}
                    </div>
                    <div
                      className={`px-6 py-4 rounded-2xl shadow-lg border transition-all duration-300 hover:shadow-xl ${
                        message.sender === "user"
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-200"
                          : "bg-white/90 backdrop-blur-sm dark:bg-gray-800/90 border-gray-200/50 dark:border-gray-700/50 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {typeof message.content === "string" ? (
                        <div className="prose prose-sm max-w-none">
                          {message.content.split("\n").map((line, index) => {
                            if (line.trim()) {
                              return (
                                <p key={index} className="text-sm leading-relaxed mb-1">
                                  {line}
                                </p>
                              )
                            } else {
                              return <br key={index} />
                            }
                          })}
                        </div>
                      ) : message.content.type === "final_diagnosis" ? (
                        // Enhanced Final Diagnosis Display
                        <div className="space-y-6">
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-500 to-green-500 rounded-full mb-4">
                              <Stethoscope className="h-8 w-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                              Final Health Assessment
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400">Based on your symptoms and responses</p>
                          </div>

                          {message.content.conditions && message.content.conditions.length > 0 ? (
                            <div className="space-y-4">
                              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                                  <TrendingUp className="h-5 w-5 mr-2" />
                                  Most Likely Conditions
                                </h3>
                                <div className="space-y-3">
                                  {message.content.conditions
                                    .sort((a: Condition, b: Condition) => b.probability - a.probability)
                                    .slice(0, 3)
                                    .map((condition: Condition, index: number) => {
                                      const percentage = (condition.probability * 100).toFixed(1)
                                      const bgColor =
                                        index === 0
                                          ? "bg-red-100 dark:bg-red-900/30"
                                          : index === 1
                                            ? "bg-yellow-100 dark:bg-yellow-900/30"
                                            : "bg-green-100 dark:bg-green-900/30"
                                      const textColor =
                                        index === 0
                                          ? "text-red-800 dark:text-red-200"
                                          : index === 1
                                            ? "text-yellow-800 dark:text-yellow-200"
                                            : "text-green-800 dark:text-green-200"

                                      return (
                                        <div
                                          key={condition.id}
                                          className={`${bgColor} rounded-lg p-3 flex items-center justify-between`}
                                        >
                                          <div>
                                            <p className={`font-medium ${textColor}`}>
                                              {condition.common_name || condition.name}
                                            </p>
                                          </div>
                                          <div className={`text-right ${textColor}`}>
                                            <p className="text-lg font-bold">{percentage}%</p>
                                          </div>
                                        </div>
                                      )
                                    })}
                                </div>
                              </div>

                              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                                <div className="flex items-start space-x-3">
                                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                                      Important Disclaimer
                                    </h4>
                                    <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                                      This AI assessment provides insights based on the information you've shared and is
                                      not a substitute for professional medical advice. Always consult a qualified
                                      healthcare professional for an accurate diagnosis and treatment plan.
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                                <div className="flex items-start space-x-3">
                                  <Stethoscope className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                  <div>
                                    <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                                      Next Steps
                                    </h4>
                                    <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed">
                                      Please schedule an appointment with your healthcare provider to discuss these
                                      findings and get proper medical care. Early consultation is always recommended for
                                      your health and well-being.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800 text-center">
                              <Info className="h-12 w-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
                              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                No Specific Condition Identified
                              </h3>
                              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                                Based on the information provided, I couldn't identify a specific condition at this
                                time. This doesn't mean nothing is wrong - it's important to consult a qualified
                                healthcare professional for a complete evaluation.
                              </p>
                              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed mt-2 font-medium">
                                Your health and well-being are important! 🙏
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        // Regular Infermedica Question Display
                        (() => {
                          const questionContent: InfermedicaQuestion = message.content
                          const isMultipleType = questionContent.type === "group_multiple"

                          return (
                            <div>
                              <p className="text-sm font-semibold leading-relaxed mb-4 text-gray-900 dark:text-white">
                                {questionContent.text}
                              </p>

                              <div className="mb-4">
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    isMultipleType
                                      ? "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200"
                                      : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                  }`}
                                >
                                  {isMultipleType ? "Answer all questions below" : "Select one option"}
                                </span>
                              </div>

                              {questionContent.items && questionContent.items.length > 0 && (
                                <div className="space-y-4">
                                  {questionContent.items.map((item: InfermedicaQuestionItem) => (
                                    <div
                                      key={item.id}
                                      className="border-t border-gray-200 dark:border-gray-700 pt-4 first:border-t-0 first:pt-0"
                                    >
                                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3">
                                        {item.name}
                                        {isMultipleType && tempGroupedSelections[item.id] && (
                                          <span className="ml-2 text-green-600 dark:text-green-400">✓</span>
                                        )}
                                      </p>
                                      <div className="flex flex-wrap gap-2">
                                        {item.choices.map((choice: InfermedicaChoice) => (
                                          <button
                                            key={choice.id}
                                            onClick={() => {
                                              if (isMultipleType) {
                                                setTempGroupedSelections((prev) => ({
                                                  ...prev,
                                                  [item.id]: choice.id,
                                                }))
                                              } else {
                                                handleSendMessage(`${item.id}:${choice.id}`)
                                              }
                                            }}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 transform hover:scale-105
                                                        ${
                                                          isMultipleType && tempGroupedSelections[item.id] === choice.id
                                                            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg"
                                                            : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-blue-100 dark:hover:bg-blue-800"
                                                        }`}
                                          >
                                            {choice.label}
                                          </button>
                                        ))}
                                      </div>
                                    </div>
                                  ))}

                                  {isMultipleType && (
                                    <div className="mt-6 text-center border-t border-gray-200 dark:border-gray-700 pt-4">
                                      <div className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                                        Answered: {Object.keys(tempGroupedSelections).length} /{" "}
                                        {questionContent.items.length}
                                      </div>
                                      <button
                                        onClick={handleGroupedMultipleConfirm}
                                        disabled={!areAllItemsAnswered(questionContent, tempGroupedSelections)}
                                        className="px-8 py-3 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-full font-semibold
                                                   hover:shadow-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                                      >
                                        {areAllItemsAnswered(questionContent, tempGroupedSelections)
                                          ? "Confirm All Answers"
                                          : `Answer All Questions (${Object.keys(tempGroupedSelections).length}/${questionContent.items.length})`}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })()
                      )}

                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                        <div
                          className={`text-xs ${message.sender === "user" ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}
                        >
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {message.sender === "bot" && (
                          <button
                            onClick={() =>
                              isSpeaking
                                ? stopSpeaking()
                                : speakMessage(
                                    typeof message.content === "string"
                                      ? message.content
                                      : message.content.text || "Final diagnosis complete",
                                  )
                            }
                            className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                          >
                            {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="flex items-start space-x-4 max-w-3xl">
                    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center shadow-lg">
                      <Bot className="h-6 w-6 text-white" />
                    </div>
                    <div className="px-6 py-4 rounded-2xl bg-white/90 backdrop-blur-sm dark:bg-gray-800/90 border border-gray-200/50 dark:border-gray-700/50 shadow-lg">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 bg-blue-500 rounded-full animate-bounce"></div>
                        <div
                          className="w-3 h-3 bg-green-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.1s" }}
                        ></div>
                        <div
                          className="w-3 h-3 bg-purple-500 rounded-full animate-bounce"
                          style={{ animationDelay: "0.2s" }}
                        ></div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area - Fixed at bottom */}
          <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm dark:bg-gray-800/95 border-t border-gray-200/50 dark:border-gray-700/50 transition-colors">
            {!currDiagnosisQuestions && !isDiagnosisComplete && (
              <div className="p-6">
                <div className="max-w-4xl mx-auto">
                  {currentStep < questions.length &&
                    (currentQuestion?.type === "text" || currentQuestion?.type === "age") && (
                      <div className="flex space-x-4">
                        <div className="flex-1 relative">
                          <input
                            type={currentQuestion?.type === "age" ? "number" : "text"}
                            min={currentQuestion?.type === "age" ? 0 : undefined}
                            value={currentInput}
                            onChange={(e) => setCurrentInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                            placeholder={
                              currentQuestion?.type === "age" ? "Enter your age in years" : "Type your response..."
                            }
                            className="w-full px-6 py-4 border border-gray-300/50 dark:border-gray-600/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/90 dark:bg-gray-700/90 text-gray-900 dark:text-white transition-colors backdrop-blur-sm"
                          />
                          {currentQuestion?.type === "text" && (
                            <button
                              onClick={startListening}
                              disabled={isListening || isSpeaking}
                              className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-colors ${
                                isListening
                                  ? "bg-red-500 text-white animate-pulse"
                                  : isSpeaking
                                    ? "bg-gray-400 text-white cursor-not-allowed"
                                    : "text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                              }`}
                            >
                              {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                            </button>
                          )}
                        </div>
                        <button
                          onClick={() => handleSendMessage()}
                          disabled={!currentInput.trim()}
                          className="px-8 py-4 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-2xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                        >
                          <Send className="h-5 w-5" />
                        </button>
                      </div>
                    )}

                  {currentStep < questions.length && currentQuestion?.type === "select" && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {currentQuestion.options?.map((option, index) => (
                        <button
                          key={index}
                          onClick={() => handleSendMessage(option)}
                          className="p-6 text-center border-2 border-gray-200/50 dark:border-gray-600/50 rounded-2xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 hover:shadow-lg hover:scale-105 bg-white/90 dark:bg-gray-800/90 text-gray-900 dark:text-white backdrop-blur-sm"
                        >
                          <div className="font-medium capitalize">{option}</div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {isDiagnosisComplete && (
              <div className="p-6 text-center">
                <button
                  onClick={() => {
                    // Reset all states for a new assessment
                    setUserAge(null)
                    setUserSex(null)
                    setMessages([])
                    setCurrentInput("")
                    setCurrentStep(0)
                    setIsTyping(false)
                    setIsListening(false)
                    setIsSpeaking(false)
                    setDiagnosisResult(null)
                    setEvidence([])
                    setInterviewId(null)
                    setCurrDiagnosisQuestions(null)
                    setCurrDiagnosisConditions([])
                    setIsDiagnosisComplete(false)
                    setTempGroupedSelections({})
                    setDiagnosisQuestionCount(0)

                    // Restart the conversation flow
                    setTimeout(() => {
                      addBotMessage(
                        "Hello! I'm your HealthBuddy AI assistant. I'll help analyze your symptoms and provide personalized health insights. Let's start with a few questions.",
                      )
                      setTimeout(() => {
                        addBotMessage(questions[0].question)
                      }, 1000)
                    }, 500)
                  }}
                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105"
                >
                  Start New Assessment 🔄
                </button>
              </div>
            )}

            {currDiagnosisQuestions && !isDiagnosisComplete && (
              <div className="p-6 text-center text-gray-600 dark:text-gray-400">
                <p className="text-sm">
                  {currDiagnosisQuestions.type === "group_multiple"
                    ? "Please answer all questions above, then click 'Confirm All Answers' 👆"
                    : "Please select your answer from the options above to continue 👆"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Enhanced Tips Sidebar */}
        <div className="w-80 bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 border-l border-gray-200/50 dark:border-gray-700/50 p-6 hidden lg:block transition-colors overflow-y-auto">
          <div className="space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">Helpful Tips</h3>
            </div>

            {currentStep < questions.length && questions[currentStep]?.tips ? (
              <div className="space-y-4">
                {questions[currentStep].tips.map((tip, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-4 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl border border-blue-100/50 dark:border-blue-800/50 backdrop-blur-sm"
                  >
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            ) : currDiagnosisQuestions && !isDiagnosisComplete ? (
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl border border-blue-100/50 dark:border-blue-800/50 backdrop-blur-sm">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    Answer all questions accurately for the best diagnosis.
                  </p>
                </div>
                <div className="flex items-start space-x-3 p-4 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl border border-blue-100/50 dark:border-blue-800/50 backdrop-blur-sm">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {currDiagnosisQuestions.type === "group_multiple"
                      ? "For multiple choice questions, answer ALL items before confirming."
                      : "For single questions, select one option to continue immediately."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start space-x-3 p-4 bg-blue-50/80 dark:bg-blue-900/20 rounded-xl border border-blue-100/50 dark:border-blue-800/50 backdrop-blur-sm">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    Welcome to HealthBuddy! Start by answering the initial questions.
                  </p>
                </div>
              </div>
            )}

            <div className="p-6 bg-gradient-to-r from-blue-50/80 to-green-50/80 dark:from-blue-900/20 dark:to-green-900/20 rounded-2xl border border-blue-200/50 dark:border-blue-800/50 backdrop-blur-sm">
              <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                Privacy & Security
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                Your health information is encrypted and secure. We never share your data and comply with all privacy
                regulations.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-r from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200/50 dark:border-purple-800/50 backdrop-blur-sm">
              <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-3">AI Accuracy</h4>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">95%</div>
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Our AI maintains high accuracy in symptom analysis based on extensive medical training data.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
