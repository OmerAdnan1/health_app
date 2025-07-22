"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { Send, Bot, User, Lightbulb, CheckCircle, Mic, MicOff, Volume2, VolumeX, Activity, TrendingUp } from "lucide-react"
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
  type: "single" | "grouped_single" | "grouped_multiple" | "group_multiple" // Infermedica uses both 'grouped_multiple' and 'group_multiple'
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
  const [currentStep, setCurrentStep] = useState<number>(0) // For fixed initial questions
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [responses, setResponses] = useState<Record<string, string>>({}) // To store all raw user responses
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null) // For raw API response debugging
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]) // Accumulates all evidence for Infermedica
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [interviewId, setInterviewId] = useState<string | null>(null) // Unique ID for the diagnostic session

  const [currDiagnosisQuestions, setCurrDiagnosisQuestions] = useState<InfermedicaQuestion | null>(null) // Current question from Infermedica
  const [currDiagnosisConditions, setCurrDiagnosisConditions] = useState<Condition[]>([]) // Current conditions from Infermedica
  const [isDiagnosisComplete, setIsDiagnosisComplete] = useState<boolean>(false) // Flag for diagnosis completion
  const [tempGroupedSelections, setTempGroupedSelections] = useState<Record<string, "present" | "absent" | "unknown">>(
    {},
  ) // For multi-select questions
  const MAX_DIAGNOSIS_QUESTIONS = 8 // Limit for diagnosis questions to prevent infinite loops
  const [diagnosisQuestionCount, setDiagnosisQuestionCount] = useState(0) // Counter for diagnosis questions asked

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
          addBotMessage(questions[0].question) // Asks the first fixed question (age)
        }, 1500)
      }, 500)
    }
  }, [])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
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
    }, 800)
  }

  // Add user message
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
  }

  // Display current conditions with probabilities
  const displayConditionsUpdate = (conditions: Condition[]) => {
    if (conditions && conditions.length > 0) {
      const sortedConditions = conditions.sort((a, b) => b.probability - a.probability)
      let conditionsMessage = "**Current possible conditions based on your symptoms:**\n\n"

      sortedConditions.slice(0, 3).forEach((condition, index) => {
        const percentage = (condition.probability * 100).toFixed(1)
        const emoji = index === 0 ? "🔴" : index === 1 ? "🟡" : "🟢"
        conditionsMessage += `${emoji} **${condition.common_name || condition.name}**: ${percentage}%\n`
      })

      conditionsMessage += "\n*These are preliminary assessments. Let's continue with more questions for accuracy.*"
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
    if (!currDiagnosisQuestions) return // Should not happen if button is visible

    const allAnswered = areAllItemsAnswered(currDiagnosisQuestions, tempGroupedSelections)

    if (!allAnswered) {
      const unansweredCount = currDiagnosisQuestions.items.length - Object.keys(tempGroupedSelections).length
      addBotMessage(
        `Please answer all ${currDiagnosisQuestions.items.length} questions. You have ${unansweredCount} remaining.`,
      )
      return
    }

    setIsTyping(true)
    addUserMessage("Confirmed selections.") // User message for confirmation

    const newEvidenceToAdd: EvidenceItem[] = Object.entries(tempGroupedSelections).map(([id, choice_id]) => ({
      id,
      choice_id: choice_id as "present" | "absent" | "unknown",
    }))

    setTempGroupedSelections({}) // Clear temporary selections

    // Combine new evidence with existing, filtering out old choices for the same items
    const combinedEvidence = [...evidence.filter(
      (item) => !newEvidenceToAdd.some((newItem) => newItem.id === item.id)
    ), ...newEvidenceToAdd];

    setEvidence(combinedEvidence); // Update the main evidence state

    // Proceed with diagnosis after a short delay for UI update
    setTimeout(async () => {
      try {
        // Check if max questions reached before making API call
        if (diagnosisQuestionCount + 1 >= MAX_DIAGNOSIS_QUESTIONS) {
          const finalDiagnosisResult = await getDiagnosis(combinedEvidence)
          setDiagnosisResult(JSON.stringify(finalDiagnosisResult, null, 2))
          setCurrDiagnosisConditions(finalDiagnosisResult.conditions || [])
          setIsDiagnosisComplete(true)
          setCurrDiagnosisQuestions(null) // Clear question as diagnosis is complete
          setDiagnosisQuestionCount((prev) => prev + 1)

          displayFinalDiagnosis(finalDiagnosisResult.conditions)
          setIsTyping(false)
          return
        }

        const nextDiagnosisResult = await getDiagnosis(combinedEvidence) // Pass updated evidence
        setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2))
        setCurrDiagnosisConditions(nextDiagnosisResult.conditions || [])
        setIsDiagnosisComplete(nextDiagnosisResult.should_stop)
        setCurrDiagnosisQuestions(nextDiagnosisResult.question || null)
        setDiagnosisQuestionCount((prev) => prev + 1)

        setIsTyping(false)

        // Show current conditions update
        if (nextDiagnosisResult.conditions && nextDiagnosisResult.conditions.length > 0) {
          displayConditionsUpdate(nextDiagnosisResult.conditions)
        }

        if (nextDiagnosisResult.should_stop) {
          displayFinalDiagnosis(nextDiagnosisResult.conditions)
          // Trigger redirection after final display
          setTimeout(() => {
            localStorage.setItem(
              "finalDiagnosisResults",
              JSON.stringify({
                conditions: nextDiagnosisResult.conditions,
                evidence: combinedEvidence, // Save final evidence
                timestamp: new Date().toISOString(),
              }),
            )
            router.push("/results")
          }, 3000)
        } else if (nextDiagnosisResult.question) {
          setTimeout(() => {
            addBotMessage(nextDiagnosisResult.question) // Pass the structured object
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

  // Helper function to proceed with diagnosis (for single/grouped_single types)
  const proceedWithDiagnosis = async (currentEvidence: EvidenceItem[]) => {
    setIsTyping(true)

    // Using setTimeout to allow UI to update with user message first
    setTimeout(async () => {
      try {
        // Check if max questions reached before making API call
        if (diagnosisQuestionCount + 1 >= MAX_DIAGNOSIS_QUESTIONS) {
          const finalDiagnosisResult = await getDiagnosis(currentEvidence)
          setDiagnosisResult(JSON.stringify(finalDiagnosisResult, null, 2))
          setCurrDiagnosisConditions(finalDiagnosisResult.conditions || [])
          setIsDiagnosisComplete(true)
          setCurrDiagnosisQuestions(null) // Clear question as diagnosis is complete
          setDiagnosisQuestionCount((prev) => prev + 1)

          displayFinalDiagnosis(finalDiagnosisResult.conditions)
          setIsTyping(false)
          return
        }

        const nextDiagnosisResult = await getDiagnosis(currentEvidence) // Pass updated evidence
        setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2))
        setCurrDiagnosisConditions(nextDiagnosisResult.conditions || [])
        setIsDiagnosisComplete(nextDiagnosisResult.should_stop)
        setCurrDiagnosisQuestions(nextDiagnosisResult.question || null)
        setDiagnosisQuestionCount((prev) => prev + 1)

        setIsTyping(false)

        // Show conditions update
        if (nextDiagnosisResult.conditions && nextDiagnosisResult.conditions.length > 0) {
          displayConditionsUpdate(nextDiagnosisResult.conditions)
        }

        if (nextDiagnosisResult.should_stop) {
          displayFinalDiagnosis(nextDiagnosisResult.conditions)
          // Trigger redirection after final display
          setTimeout(() => {
            localStorage.setItem(
              "finalDiagnosisResults",
              JSON.stringify({
                conditions: nextDiagnosisResult.conditions,
                evidence: currentEvidence, // Save final evidence
                timestamp: new Date().toISOString(),
              }),
            )
            router.push("/results")
          }, 3000)
        } else if (nextDiagnosisResult.question) {
          setTimeout(() => {
            addBotMessage(nextDiagnosisResult.question) // Pass the structured object
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

    // Clear input field immediately for all types of submissions
    setCurrentInput("")

    // --- CRITICAL: Store ALL user responses in the 'responses' state ---
    // This must happen for every user input, regardless of question type.
    // We use 'questions[currentStep].id' for fixed questions.
    // For dynamic Infermedica questions, we'll store them in 'evidence' and also display in chat,
    // but 'responses' is for the fixed initial questionnaire.
    if (currentStep < questions.length) { // Only update 'responses' for fixed questions
      const currentFixedQuestion = questions[currentStep];
      setResponses((prev) => ({
        ...prev,
        [currentFixedQuestion.id]: value,
      }));
    }
    // For Infermedica questions, the user message is added within the specific handling blocks
    // (e.g., in handleGroupedMultipleConfirm or the Infermedica handling block below)
    // to include the item name/choice label.

    // --- 1. Handle responses to Infermedica's dynamic questions first if active ---
    // This block will be hit when user clicks buttons on Infermedica-generated questions
    if (currDiagnosisQuestions && !isDiagnosisComplete) {
      const parts = value.split(":")
      if (parts.length === 2) {
        const itemId = parts[0]
        const choiceId = parts[1] as "present" | "absent" | "unknown"

        if (!["present", "absent", "unknown"].includes(choiceId)) {
          addBotMessage("Invalid answer. Please select one of the provided options.")
          return
        }

        // Add user message to chat for clarity (e.g., "Fever: Yes")
        const currentQ = currDiagnosisQuestions as InfermedicaQuestion;
        const chosenItem = currentQ?.items.find(item => item.id === itemId);
        const chosenLabel = chosenItem?.choices.find(choice => choice.id === choiceId)?.label || choiceId;
        addUserMessage(chosenItem ? `${chosenItem.name}: ${chosenLabel}` : chosenLabel);

        // Handle different question types (single, grouped_single)
        const questionType = currDiagnosisQuestions.type

        if (questionType === "single" || questionType === "grouped_single") {
          // Single and Grouped Single questions - proceed immediately
          // Filter out any old choice for this item and add the new one
          const newEvidence = [...evidence.filter((item) => item.id !== itemId), { id: itemId, choice_id: choiceId }]
          setEvidence(newEvidence) // Update evidence state
          await proceedWithDiagnosis(newEvidence) // Call the helper to make API call
        } else if (questionType === "grouped_multiple" || questionType === "group_multiple") {
          // This case should ideally not be hit directly by handleSendMessage for grouped_multiple buttons.
          // The onClick for these buttons should only update tempGroupedSelections.
          // handleGroupedMultipleConfirm is responsible for proceeding.
          // If it somehow gets here, we'll just update temp selections and inform the user.
          setTempGroupedSelections((prev) => ({
            ...prev,
            [itemId]: choiceId,
          }))
          addBotMessage("Please confirm all your selections using the 'Confirm All Answers' button.")
        }
      } else {
        // This handles free text input when Infermedica expects button clicks
        addBotMessage("Please use the provided buttons to answer the health questions.")
      }
      return // IMPORTANT: Exit here after handling Infermedica questions
    }

    // --- 2. Handle initial fixed questions (only if Infermedica flow is NOT active) ---
    // This block will only be hit for age, sex, and symptoms questions
    if (currentStep < questions.length) {
      const currentFixedQuestion = questions[currentStep]
      // User message for fixed questions is already added at the top of handleSendMessage

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
          setInterviewId(uuidv4()) // Generate interviewId once sex is set
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

          setEvidence(initialEvidence) // Set initial evidence
          const diagnosis = await getDiagnosis(initialEvidence) // Pass initial evidence to getDiagnosis

          if (!diagnosis) {
            throw new Error("No diagnosis data received from the API.")
          }

          setDiagnosisResult(JSON.stringify(diagnosis, null, 2))
          setCurrDiagnosisConditions(diagnosis.conditions || [])
          setIsDiagnosisComplete(diagnosis.should_stop)
          setCurrDiagnosisQuestions(diagnosis.question || null) // Set the first Infermedica question

          setIsTyping(false)
          // IMPORTANT: DO NOT increment currentStep here. Fixed flow ends.
          // The UI will now be driven by currDiagnosisQuestions and isDiagnosisComplete.

          // Show initial conditions
          if (diagnosis.conditions && diagnosis.conditions.length > 0) {
            displayConditionsUpdate(diagnosis.conditions)
          }

          if (diagnosis.should_stop) {
            displayFinalDiagnosis(diagnosis.conditions)
            // Trigger redirection after final display
            setTimeout(() => {
              localStorage.setItem(
                "finalDiagnosisResults",
                JSON.stringify({
                  conditions: diagnosis.conditions,
                  evidence: initialEvidence, // Save final evidence
                  timestamp: new Date().toISOString(),
                }),
              )
              router.push("/results")
            }, 3000)
          } else if (diagnosis.question) {
            setTimeout(() => {
              addBotMessage(diagnosis.question) // Pass the structured object
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
        return // Exit after handling symptoms
      }
    }

    // --- 3. Handle completion state ---
    if (isDiagnosisComplete) {
      addBotMessage(
        "The diagnosis is complete. Please click 'Start a New Diagnosis' if you wish to begin a new assessment. 🔄",
      )
      return // Exit if diagnosis is already complete
    }

    // --- 4. Fallback for unexpected states ---
    addBotMessage("An unexpected state occurred. Please try again or refresh the page.")
  }

  // API calls
  const getDiagnosis = async (currentEvidence: EvidenceItem[]) => {
    if (userAge === null || userSex === null || currentEvidence.length === 0) {
      throw new Error("Diagnosis prerequisites are missing (age, sex, or initial evidence).")
    }

    // Ensure we have an interview ID set
    if (!interviewId) {
      console.error("Interview ID is not set. This should have been generated after sex_input.")
      throw new Error("An internal error occurred: Interview ID missing.")
    }

    // Deduplicate evidence items if necessary (this logic is good)
    const uniqueEvidenceMap = new Map<string, EvidenceItem>();
    for (const item of currentEvidence) { // Use the passed currentEvidence
      if (!uniqueEvidenceMap.has(item.id)) {
        uniqueEvidenceMap.set(item.id, item);
      }
    }
    const dedupedEvidence = Array.from(uniqueEvidenceMap.values());

    const payload = {
      age: { value: userAge, unit: "year" },
      sex: userSex,
      evidence: dedupedEvidence,
      // interviewId is passed via the backend's headers, not directly in the body for /diagnosis
      // Your backend proxy should extract it from req.body.interviewId if needed for headers.
      // For Infermedica API itself, it's a header.
      // If your backend proxy requires it in the body to pull into headers, add it here:
      // interviewId: interviewId,
    };

    try {
      const res = await fetch("http://localhost:5000/api/infermedica/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json", 'Interview-Id': interviewId }, // Explicitly add Interview-Id header
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

    // Ensure we have an interview ID set
    if (!interviewId) {
      console.error("Interview ID is not set for parse. This should have been generated after sex_input.");
      throw new Error("An internal error occurred: Interview ID missing for parsing.");
    }

    const payload = {
      age: { value: userAge, unit: "year" },
      sex: userSex,
      text: responseString,
      context: [],
      include_tokens: true,
      correct_spelling: true,
      concept_types: ["symptom"],
      interviewId: interviewId, // Pass interviewId for parse
    }

    try {
      const res = await fetch("http://localhost:5000/api/infermedica/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json", 'Interview-Id': interviewId }, // Explicitly add Interview-Id header
        body: JSON.stringify(payload),
      })
      return await parseJsonResponse(res)
    } catch (error) {
      console.error("API call to /parse failed:", error)
      throw error
    }
  }

  // Display final diagnosis
  const displayFinalDiagnosis = (conditions: Condition[]) => {
    let finalMessage = "## 🏥 **Final Health Assessment**\n\n"

    if (conditions && conditions.length > 0) {
      const sortedConditions = conditions.sort((a, b) => b.probability - a.probability)
      finalMessage += "Based on your symptoms, here are the most likely conditions:\n\n"

      sortedConditions.slice(0, 3).forEach((condition, index) => {
        const percentage = (condition.probability * 100).toFixed(1)
        const emoji = index === 0 ? "🔴" : index === 1 ? "🟡" : "🟢"
        finalMessage += `${emoji} **${condition.common_name || condition.name}**: ${percentage}% probability\n`
      })

      finalMessage += "\n---\n\n"
      finalMessage +=
        "**⚠️ Important Disclaimer**: This AI assessment provides insights based on the information you've shared and is not a substitute for professional medical advice. Always consult a qualified healthcare professional for an accurate diagnosis and treatment plan.\n\n"
      finalMessage +=
        "**🩺 Next Steps**: Please schedule an appointment with your healthcare provider to discuss these findings and get proper medical care."
    } else {
      finalMessage =
        "Based on the information provided, I couldn't identify a specific condition at this time. This doesn't mean nothing is wrong - it's important to consult a qualified healthcare professional for a complete evaluation.\n\n**Your health and well-being are important! 🙏**"
    }

    addBotMessage(finalMessage)
  }

  const currentQuestion = questions[currentStep] // Still used for fixed questions

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
      <Header />

      <main className="flex-1 pt-16 flex">
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
          <div className="flex-1 overflow-y-auto p-6">
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
                            if (line.startsWith("**") && line.endsWith("**")) {
                              return (
                                <p key={index} className="font-bold text-sm leading-relaxed">
                                  {line.slice(2, -2)}
                                </p>
                              )
                            } else if (line.startsWith("## ")) {
                              return (
                                <h2 key={index} className="text-lg font-bold mb-2 text-gray-900 dark:text-white">
                                  {line.slice(3)}
                                </h2>
                              )
                            } else if (line === "---") {
                              return <hr key={index} className="my-3 border-gray-300 dark:border-gray-600" />
                            } else if (line.trim()) {
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
                      ) : (
                        (() => {
                          const questionContent: InfermedicaQuestion = message.content
                          const isMultipleType =
                            questionContent.type === "grouped_multiple" || questionContent.type === "group_multiple"

                          return (
                            <div>
                              <p className="text-sm font-semibold leading-relaxed mb-4 text-gray-900 dark:text-white">
                                {questionContent.text}
                              </p>

                              {/* Show question type indicator */}
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
                                                // For 'single' and 'grouped_single', immediately send to handleSendMessage
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
                                    typeof message.content === "string" ? message.content : message.content.text,
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

          {/* Input Area */}
          {/* Show input area if fixed questions are not complete OR if diagnosis is not complete */}
          {(!currDiagnosisQuestions || isDiagnosisComplete) && (
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 border-t border-gray-200/50 dark:border-gray-700/50 p-6 transition-colors">
              <div className="max-w-4xl mx-auto">
                {/* Render input types for fixed questions */}
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
                        {currentQuestion?.type === "text" && ( // Only show mic for text inputs
                          <button
                            onClick={startListening}
                            disabled={isSpeaking} // Disable mic if bot is speaking
                            className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-colors ${
                              isSpeaking
                                ? "bg-gray-400 text-white cursor-not-allowed"
                                : "text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                            }`}
                          >
                            {isSpeaking ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
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

                {isDiagnosisComplete && (
                  <div className="text-center">
                    <button
                      onClick={() => {
                        // Reset all states for a new assessment
                        setUserAge(null)
                        setUserSex(null)
                        setMessages([])
                        setCurrentInput("")
                        setCurrentStep(0) // Reset to first fixed question
                        setIsTyping(false)
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
              </div>
            </div>
          )}

          {/* Message to user when Infermedica questions are active and waiting for button input */}
          {currDiagnosisQuestions && !isDiagnosisComplete && (
            <div className="bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 border-t border-gray-200/50 dark:border-gray-700/50 p-6 text-center text-gray-600 dark:text-gray-400">
              <p className="text-sm">
                {currDiagnosisQuestions.type === "grouped_multiple" || currDiagnosisQuestions.type === "group_multiple"
                  ? "Please answer all questions above, then click 'Confirm All Answers' 👆"
                  : "Please select your answer from the options above to continue 👆"}
              </p>
            </div>
          )}
        </div>

        {/* Enhanced Tips Sidebar */}
        <div className="w-80 bg-white/80 backdrop-blur-sm dark:bg-gray-800/80 border-l border-gray-200/50 dark:border-gray-700/50 p-6 hidden lg:block transition-colors">
          <div className="sticky top-24 space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">Helpful Tips</h3>
            </div>

            {/* Dynamic Tips based on current state */}
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
            ) : (currDiagnosisQuestions && !isDiagnosisComplete) ? (
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
                    {currDiagnosisQuestions.type === "grouped_multiple" ||
                    currDiagnosisQuestions.type === "group_multiple"
                      ? "For multiple choice questions, answer ALL items before confirming."
                      : "For single questions, select one option to continue immediately."}
                  </p>
                </div>
              </div>
            ) : ( // Default tips if no specific question is active
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
