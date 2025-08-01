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
import {
  getDiagnosis,
  getParseResult,
  askGemini,
  getGeographicRiskFactors,
  smartStopLogic,
  normalizeText,
  type EvidenceItem,
  type Condition,
  type InfermedicaQuestion,
  type InfermedicaChoice,
  type InfermedicaQuestionItem,
  type InitialQuestion,
} from "../../lib/api/healthAPI"

// Type Definitions
type Message = {
  id: number
  content: string | InfermedicaQuestion
  sender: "bot" | "user"
  timestamp: Date
}

// Helper function to safely parse API responses
// const parseJsonResponse = async (response: Response) => {
//   try {
//     const text = await response.text()
//     if (!response.ok) {
//       try {
//         const errorData = JSON.parse(text)
//         throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`)
//       } catch (jsonError) {
//         throw new Error(`API error: ${response.status} ${response.statusText}${text ? `: ${text}` : ""}`)
//       }
//     }
//     return text ? JSON.parse(text) : {}
//   } catch (error) {
//     console.error("Error parsing JSON response:", error)
//     throw error
//   }
// }

// Helper function to normalize text input for better parsing
// const normalizeText = (input: string): string => {
//   return input.trim().replace(/\s+/g, " ").toLowerCase()
// }

export default function ChatbotPage() {
  const router = useRouter()
  const [userAge, setUserAge] = useState<number | null>(null)
  const [userSex, setUserSex] = useState<"male" | "female" | "other" | null>(null)
  const [userLocation, setUserLocation] = useState<string | null>(null)

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
  const MAX_DIAGNOSIS_QUESTIONS = 18 // Increased from 8 for better accuracy
  const [diagnosisQuestionCount, setDiagnosisQuestionCount] = useState(0)
  const [showMaxQuestionsChoice, setShowMaxQuestionsChoice] = useState<boolean>(false)
  const [continuePastMaxQuestions, setContinuePastMaxQuestions] = useState<boolean>(false)
  const [emergencySymptoms, setEmergencySymptoms] = useState<string[]>([])

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
      id: "location",
      question: "What is your current location or recent travel history?",
      type: "select",
      options: [
        "United States/Canada",
        "Europe",
        "Asia",
        "Africa",
        "South America",
        "Australia/Oceania",
        "Middle East",
        "No recent travel",
      ],
      tips: [
        "Location helps identify region-specific conditions",
        "Recent travel can indicate exposure to different diseases",
        "This helps with accurate risk assessment",
      ],
    },
    {
      id: "symptoms",
      question:
        "What symptoms are you experiencing? Please describe them in detail including when they started, how severe they are, and what makes them better or worse.",
      type: "text",
      tips: [
        "Include WHEN symptoms started (hours/days/weeks ago)",
        "Describe the SEVERITY (mild, moderate, severe)",
        "Mention what makes symptoms BETTER or WORSE",
        "Include ALL related symptoms, even minor ones",
        "Be specific about LOCATION (which part of body)",
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

  // Display current conditions with probabilities and additional details
  const displayConditionsUpdate = (conditions: Condition[]) => {
    if (conditions && conditions.length > 0) {
      const sortedConditions = conditions.sort((a, b) => b.probability - a.probability)
      let conditionsMessage = "📊 Current possible conditions based on your symptoms:\n\n"

      sortedConditions.slice(0, 3).forEach((condition, index) => {
        const percentage = (condition.probability * 100).toFixed(1)
        const emoji = index === 0 ? "🔴" : index === 1 ? "🟡" : "🟢"
        conditionsMessage += `${emoji} ${condition.common_name || condition.name}: ${percentage}%`

        // Add severity information if available
        if (condition.details?.severity) {
          conditionsMessage += ` (${condition.details.severity})`
        }

        // Add acuteness information if available
        if (condition.details?.acuteness) {
          conditionsMessage += ` [${condition.details.acuteness}]`
        }

        conditionsMessage += "\n"

        // Add description if available
        if (condition.details?.description) {
          conditionsMessage += `   ℹ️ ${condition.details.description.substring(0, 100)}${condition.details.description.length > 100 ? "..." : ""}\n`
        }
      })

      conditionsMessage += "\n💡 These are preliminary assessments. Let's continue with more questions for accuracy."
      addBotMessage(conditionsMessage)

      // Show emergency warning if any emergency symptoms have been detected so far
      if (emergencySymptoms.length > 0) {
        const emergencyWarning = `🚨 **IMPORTANT NOTICE**: Emergency symptoms have been detected during this assessment:\n\n${emergencySymptoms.map((symptom) => `⚠️ ${symptom}`).join("\n")}\n\n**While we continue the assessment for completeness, please consider seeking immediate medical attention if symptoms are severe or worsening.**`
        setTimeout(() => {
          addBotMessage(emergencyWarning)
        }, 1500)
      }
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
      // No source attribute for evidence gathered during dynamic interview per Infermedica docs
    }))

    console.log(`Adding ${newEvidenceToAdd.length} dynamic interview evidence items from questions:`, newEvidenceToAdd)

    setTempGroupedSelections({})

    const combinedEvidence = [
      ...evidence.filter((item) => !newEvidenceToAdd.some((newItem) => newItem.id === item.id)),
      ...newEvidenceToAdd,
    ]

    setEvidence(combinedEvidence)

    setTimeout(async () => {
      try {
        const nextDiagnosisResult = await getDiagnosis(combinedEvidence, userAge, userSex, interviewId)
        setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2))
        setCurrDiagnosisConditions(nextDiagnosisResult.conditions || [])
        setCurrDiagnosisQuestions(nextDiagnosisResult.question || null)
        setDiagnosisQuestionCount((prev) => prev + 1)

        // Smart stop logic
        const shouldStop = smartStopLogic(
          nextDiagnosisResult,
          diagnosisQuestionCount + 1,
          MAX_DIAGNOSIS_QUESTIONS,
          continuePastMaxQuestions,
          setShowMaxQuestionsChoice,
          setEmergencySymptoms,
          evidence,
        )
        setIsDiagnosisComplete(shouldStop)

        setIsTyping(false)

        if (nextDiagnosisResult.conditions && nextDiagnosisResult.conditions.length > 0) {
          displayConditionsUpdate(nextDiagnosisResult.conditions)
        }

        if (shouldStop) {
          if (showMaxQuestionsChoice) {
            // Show choice message instead of ending diagnosis
            const choiceMessage = {
              type: "max_questions_choice",
              questionCount: diagnosisQuestionCount + 1,
              conditions: nextDiagnosisResult.conditions || [],
            }
            addBotMessage(choiceMessage as any)
          } else {
            displayFinalDiagnosis(nextDiagnosisResult.conditions)
          }
        } else if (nextDiagnosisResult.question) {
          setTimeout(() => {
            addBotMessage(nextDiagnosisResult.question!)
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
        const nextDiagnosisResult = await getDiagnosis(currentEvidence, userAge, userSex, interviewId)
        setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2))
        setCurrDiagnosisConditions(nextDiagnosisResult.conditions || [])
        setCurrDiagnosisQuestions(nextDiagnosisResult.question || null)
        setDiagnosisQuestionCount((prev) => prev + 1)

        // Smart stop logic
        const shouldStop = smartStopLogic(
          nextDiagnosisResult,
          diagnosisQuestionCount + 1,
          MAX_DIAGNOSIS_QUESTIONS,
          continuePastMaxQuestions,
          setShowMaxQuestionsChoice,
          setEmergencySymptoms,
          evidence,
        )
        setIsDiagnosisComplete(shouldStop)

        setIsTyping(false)

        if (nextDiagnosisResult.conditions && nextDiagnosisResult.conditions.length > 0) {
          displayConditionsUpdate(nextDiagnosisResult.conditions)
        }

        if (shouldStop) {
          if (showMaxQuestionsChoice) {
            // Show choice message instead of ending diagnosis
            const choiceMessage = {
              type: "max_questions_choice",
              questionCount: diagnosisQuestionCount + 1,
              conditions: nextDiagnosisResult.conditions || [],
            }
            addBotMessage(choiceMessage as any)
          } else {
            displayFinalDiagnosis(nextDiagnosisResult.conditions)
          }
        } else if (nextDiagnosisResult.question) {
          setTimeout(() => {
            addBotMessage(nextDiagnosisResult.question!)
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
      } else if (currentFixedQuestion.id === "location") {
        setUserLocation(value)
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

          const normalizedInput = normalizeText(value)
          console.log("Normalized Input:", normalizedInput)
          console.log("Using UserAge:", userAge)
          const result = await getParseResult(normalizedInput, userAge, userSex, interviewId)
          if (!result || !Array.isArray(result.mentions)) {
            throw new Error("Received an invalid response format for symptom analysis. Please try again.")
          }

          const initialEvidence: EvidenceItem[] = result.mentions.map((mention: any) => ({
            id: mention.id,
            choice_id: mention.choice_id,
            source: "initial",
          }))

          // Add geographic risk factors based on user location
          const geographicEvidence = getGeographicRiskFactors(userLocation)
          const allInitialEvidence = [...initialEvidence, ...geographicEvidence]

          console.log(`Created ${initialEvidence.length} initial evidence items from symptoms:`, initialEvidence)
          console.log(`Added ${geographicEvidence.length} geographic risk factors:`, geographicEvidence)

          if (initialEvidence.length === 0) {
            addBotMessage(
              "I couldn't identify any symptoms from your description. Could you please rephrase or provide more details? For example, 'I have a headache and a fever.'",
            )
            setIsTyping(false)
            return
          }

          setEvidence(allInitialEvidence)
          const diagnosis = await getDiagnosis(allInitialEvidence, userAge, userSex, interviewId)

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
                          if (diagnosis.question) {
                            addBotMessage(diagnosis.question!)
                          }
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

  // Function to identify emergency symptoms from evidence and conditions
  // const identifyEmergencySymptoms = (diagnosisResult: DiagnosisResponse, currentEvidence: EvidenceItem[]): string[] => {
  //   const emergencyKeywords = [
  //     'severe chest pain', 'difficulty breathing', 'loss of consciousness', 'severe headache',
  //     'stroke symptoms', 'heart attack', 'severe bleeding', 'poisoning', 'severe burns',
  //     'severe allergic reaction', 'suicidal thoughts', 'severe abdominal pain',
  //     'difficulty swallowing', 'severe shortness of breath', 'chest tightness',
  //     'cardiac arrest', 'respiratory distress', 'anaphylaxis', 'seizure'
  //   ]

  //   const detectedEmergencies: string[] = []

  //   // Check API emergency flag
  //   if ((diagnosisResult as any).has_emergency_evidence) {
  //     detectedEmergencies.push('Emergency evidence detected by medical AI')
  //   }

  //   // Check conditions for emergency indicators
  //   // if (diagnosisResult.conditions) {
  //   //   diagnosisResult.conditions.forEach(condition => {
  //   //     const conditionName = (condition.common_name || condition.name).toLowerCase()
  //   //     const description = condition.details?.description?.toLowerCase() || ''

  //   //     // Check for emergency conditions
  //   //     if (condition.details?.acuteness === 'chronic_with_exacerbation' ||
  //   //         condition.details?.acuteness === 'acute' ||
  //   //         condition.details?.severity === 'high') {

  //   //       emergencyKeywords.forEach(keyword => {
  //   //         if (conditionName.includes(keyword) || description.includes(keyword)) {
  //   //           detectedEmergencies.push(`${condition.common_name || condition.name} (${keyword})`)
  //   //         }
  //   //       })
  //   //     }
  //   //   })
  //   // }

  //   return [...new Set(detectedEmergencies)] // Remove duplicates
  // }

  // Smart stop logic function
  // const smartStopLogic = (diagnosisResult: DiagnosisResponse, currentQuestionCount: number): boolean => {
  //   const conditions = diagnosisResult.conditions || []
  //   const apiShouldStop = diagnosisResult.should_stop

  //   console.log("Smart Stop Analysis:", {
  //     questionCount: currentQuestionCount,
  //     apiShouldStop,
  //     conditionsCount: conditions.length,
  //     topProbability: conditions[0]?.probability || 0,
  //     hasQuestion: !!diagnosisResult.question
  //   })

  //   // EMERGENCY DETECTION: Collect emergency symptoms but continue diagnosis
  //   const detectedEmergencies = identifyEmergencySymptoms(diagnosisResult, evidence)
  //   if (detectedEmergencies.length > 0) {
  //     console.log("🚨 EMERGENCY SYMPTOMS DETECTED:", detectedEmergencies)
  //     setEmergencySymptoms(prev => {
  //       const combined = [...prev, ...detectedEmergencies]
  //       return [...new Set(combined)] // Remove duplicates
  //     })
  //     // Don't stop - continue with diagnosis to gather more information
  //   }

  //   // HIGH CONFIDENCE STOP: If we have a very confident diagnosis
  //   if (conditions.length > 0) {
  //     const topCondition = conditions[0]
  //     const secondCondition = conditions[1]

  //     // Stop if top condition has very high probability (>85%)
  //     if (topCondition.probability > 0.85) {
  //       console.log("🎯 HIGH CONFIDENCE STOP: Top condition >85%", topCondition.probability)
  //       return true
  //     }

  //     // Stop if top condition is significantly higher than second (gap >40%)
  //     if (secondCondition && (topCondition.probability - secondCondition.probability) > 0.4) {
  //       console.log("📊 CLEAR LEADER STOP: Large gap between top conditions")
  //       return true
  //     }

  //     // Stop if we have good confidence (>70%) AND API suggests stopping
  //     if (topCondition.probability > 0.7 && apiShouldStop) {
  //       console.log("✅ GOOD CONFIDENCE + API STOP")
  //       return true
  //     }
  //   }

  //   // MINIMUM QUESTIONS: Don't stop before asking at least 3 questions (unless emergency)
  //   if (currentQuestionCount < 3) {
  //     console.log("🔄 CONTINUE: Need minimum 3 questions")
  //     return false
  //   }

  //   // API GUIDANCE: Trust API if it strongly suggests stopping after minimum questions
  //   if (apiShouldStop && currentQuestionCount >= 5) {
  //     console.log("🤖 API GUIDANCE STOP: API suggests stopping after sufficient questions")
  //     return true
  //   }

  //   // QUESTION AVAILABILITY: If no more questions available, stop
  //   if (!diagnosisResult.question) {
  //     console.log("❓ NO MORE QUESTIONS: Stopping due to lack of questions")
  //     return true
  //   }

  //   // MAXIMUM QUESTIONS: Show choice to user instead of hard stop
  //   if (currentQuestionCount >= MAX_DIAGNOSIS_QUESTIONS && !continuePastMaxQuestions) {
  //     console.log("🔚 MAX QUESTIONS REACHED: Showing user choice")
  //     setShowMaxQuestionsChoice(true)
  //     return true // Temporarily stop to show choice
  //   }

  //   // EXTENDED MAXIMUM: Hard limit for continued diagnosis (50% higher than original)
  //   if (continuePastMaxQuestions && currentQuestionCount >= Math.floor(MAX_DIAGNOSIS_QUESTIONS * 1.5)) {
  //     console.log("🛑 EXTENDED MAX REACHED: Final hard stop")
  //     return true
  //   }

  //   // CONVERGENCE CHECK: If probabilities haven't changed much in recent questions
  //   if (currentQuestionCount >= 6 && conditions.length > 0) {
  //     const topProbability = conditions[0].probability
  //     // This could be enhanced to track probability changes over time
  //     if (topProbability > 0.6) {
  //       console.log("📈 CONVERGENCE STOP: Stable probabilities with good confidence")
  //       return true
  //     }
  //   }

  //   console.log("➡️ CONTINUE: No stop conditions met")
  //   return false
  // }

  // Handle user choice when max questions are reached
  const handleEndDiagnosis = () => {
    setShowMaxQuestionsChoice(false)
    setIsDiagnosisComplete(true)
    displayFinalDiagnosis(currDiagnosisConditions)
  }

  const handleContinueDiagnosis = async () => {
    setShowMaxQuestionsChoice(false)
    setContinuePastMaxQuestions(true)

    // Continue with current evidence and show the next question
    if (currDiagnosisQuestions) {
      addBotMessage("Continuing with more detailed questions to improve accuracy...")
      setTimeout(() => {
        addBotMessage(currDiagnosisQuestions)
      }, 1500)
    } else {
      // If no current question, try to get the next one
      await proceedWithDiagnosis(evidence)
    }
  }

  // API calls
  // const getDiagnosis = async (currentEvidence: EvidenceItem[]) => {
  //   if (userAge === null || userSex === null || currentEvidence.length === 0) {
  //     throw new Error("Diagnosis prerequisites are missing (age, sex, or initial evidence).")
  //   }

  //   if (!interviewId) {
  //     throw new Error("Interview ID is missing.")
  //   }

  //   // Deduplicate evidence
  //   const uniqueEvidenceMap = new Map<string, EvidenceItem>()
  //   currentEvidence.forEach(item => {
  //     if (!uniqueEvidenceMap.has(item.id)) {
  //       uniqueEvidenceMap.set(item.id, item)
  //     }
  //   })
  //   const dedupedEvidence = Array.from(uniqueEvidenceMap.values())

  //   // Ensure all evidence has proper source according to Infermedica API
  //   const normalizedEvidence = dedupedEvidence.map(item => ({
  //     ...item,
  //     // Keep existing source if present, otherwise omit for dynamic interview evidence
  //     ...(item.source && { source: item.source })
  //   }))

  //   console.log(`Sending diagnosis with ${normalizedEvidence.length} evidence items:`, {
  //     initialEvidence: normalizedEvidence.filter(e => e.source === "initial").length,
  //     dynamicEvidence: normalizedEvidence.filter(e => !e.source).length,
  //     otherSources: normalizedEvidence.filter(e => e.source && e.source !== "initial").length
  //   })

  //   const payload = {
  //     age: { value: userAge, unit: "year" },
  //     sex: userSex,
  //     evidence: normalizedEvidence,
  //     evaluated_at: new Date().toISOString().split("T")[0],  // Optional but helps timeline logic
  //     extras: {
  //       enable_triage_advanced_mode: true,
  //       enable_conditions_details: true,
  //       enable_evidence_details: true
  //     }
  //   }

  //   try {
  //     const res = await fetch("http://localhost:5001/api/infermedica/diagnosis", {
  //       method: "POST",
  //       headers: {
  //         "Content-Type": "application/json",
  //         "Interview-Id": interviewId
  //       },
  //       body: JSON.stringify(payload),
  //     })
  //     return await parseJsonResponse(res)
  //   } catch (error) {
  //     console.error("Diagnosis API call failed:", error)
  //     throw error
  //   }
  // }

  //   const getParseResult = async (responseString: string) => {
  //     if (userAge === null || userSex === null) {
  //       throw new Error("Parsing prerequisites are missing (age or sex).")
  //     }

  //     const finalInterviewId = interviewId || uuidv4()

  //     console.log("Using User Age:", userAge)

  //     const payload = {
  //       "age.value": userAge,
  //       "age.unit": "year",
  //       sex: userSex,
  //       text: responseString,
  //       context: [], // can populate this from previous input (optional)
  //       include_tokens: true, // Set to true to get better parsing details
  //       correct_spelling: true,
  //       concept_types: ["symptom", "risk_factor"], // capture more context
  //       interviewId: finalInterviewId,
  //     }

  //     try {
  //       const res = await fetch("http://localhost:5001/api/infermedica/parse", {
  //         method: "POST",
  //         headers: {
  //           "Content-Type": "application/json",
  //           "Interview-Id": finalInterviewId,
  //         },
  //         body: JSON.stringify(payload),
  //       })

  //       const data = await parseJsonResponse(res)

  //       // Filter out low-relevance mentions to improve quality
  //       if (data.mentions) {
  //         data.mentions = data.mentions.filter((m: any) => {
  //           // Keep mentions with higher relevance or confidence
  //           return m.relevance ? m.relevance > 0.4 : true
  //         })
  //       }

  //       return data
  //     } catch (error) {
  //       console.error("API call to /parse failed:", error)
  //       throw error
  //     }
  //   }

  //   // Geographic risk factors mapping based on Infermedica documentation
  //   const getGeographicRiskFactors = (location: string | null): EvidenceItem[] => {
  //     if (!location || location === "No recent travel") return []

  //     const riskFactors: EvidenceItem[] = []

  //     switch (location) {
  //       case "United States/Canada":
  //         riskFactors.push({ id: "p_13", choice_id: "present", source: "predefined" })
  //         break
  //       case "Europe":
  //         riskFactors.push({ id: "p_15", choice_id: "present", source: "predefined" })
  //         break
  //       case "Asia":
  //         riskFactors.push({ id: "p_236", choice_id: "present", source: "predefined" })
  //         break
  //       case "Africa":
  //         // Using Central Africa as default, could be refined further
  //         riskFactors.push({ id: "p_17", choice_id: "present", source: "predefined" })
  //         break
  //       case "South America":
  //         riskFactors.push({ id: "p_14", choice_id: "present", source: "predefined" })
  //         break
  //       case "Australia/Oceania":
  //         riskFactors.push({ id: "p_19", choice_id: "present", source: "predefined" })
  //         break
  //       case "Middle East":
  //         riskFactors.push({ id: "p_21", choice_id: "present", source: "predefined" })
  //         break
  //     }

  //     return riskFactors
  //   }

  //   async function askGemini(prompt: string) {
  //     const res = await fetch("http://localhost:5001/api/gemini", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ prompt }),
  //     })
  //     const data = await res.json()
  //     return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"
  //   }

  // Enhanced final diagnosis display
  // const displayFinalDiagnosis = async (conditions: Condition[]) => {
  //   // Create a structured final diagnosis message
  //   const finalDiagnosisContent = {
  //     type: "final_diagnosis",
  //     conditions: conditions || [],
  //     emergencySymptoms: emergencySymptoms,
  //   }

  //   addBotMessage(finalDiagnosisContent as any)

  //   // Show emergency warning if any emergency symptoms were detected
  //   if (emergencySymptoms.length > 0) {
  //     const emergencyMessage = `⚠️ **URGENT MEDICAL ATTENTION REQUIRED**\n\nThe following emergency indicators were detected during your assessment:\n\n${emergencySymptoms.map(symptom => `• ${symptom}`).join('\n')}\n\n🚨 **Please contact emergency services (911) or visit the nearest emergency room immediately!** 🚨\n\nDo not delay seeking medical attention. These symptoms may indicate serious medical conditions that require immediate professional care.`

  //     setTimeout(() => {
  //       addBotMessage(emergencyMessage)
  //     }, 1000)
  //   }

  //   // If there is a top condition, ask Gemini for more info and treatment
  //   if (conditions && conditions.length > 0) {
  //     const topCondition = conditions.reduce(
  //       (max: Condition, cond: Condition) => (cond.probability > max.probability ? cond : max),
  //       conditions[0],
  //     )
  //     // Custom prompt for Gemini
  //     const geminiPrompt = `Provide a brief explanation and common treatment methods with headings in maximum 500 words for the medical condition "${topCondition.common_name || topCondition.name}". Please include what it is, typical symptoms, and standard treatments.`

  //     // Ask Gemini and display the response
  //     const geminiResponse = await askGemini(geminiPrompt)
  //     const delay = emergencySymptoms.length > 0 ? 3000 : 1500 // Longer delay if emergency message shown
  //     setTimeout(() => {
  //       addBotMessage(
  //         `**More information about ${topCondition.common_name || topCondition.name}:**\n\n${geminiResponse}`,
  //       )
  //     }, delay)
  //   }
  // }

  const displayFinalDiagnosis = async (conditions: Condition[]) => {
    // Store diagnosis data for results page
    const diagnosisData = {
      conditions: conditions || [],
      emergencySymptoms: emergencySymptoms,
      userAge,
      userSex,
      userLocation,
      evidence,
      timestamp: new Date().toISOString(),
      questionCount: diagnosisQuestionCount,
    }

    // Store in localStorage for results page
    localStorage.setItem("diagnosisResults", JSON.stringify(diagnosisData))

    // Show completion message and redirect
    addBotMessage("✅ Assessment complete! Redirecting you to your detailed results...")
    
    setTimeout(() => {
      router.push("/results")
    }, 2000)
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
                      ) : typeof message.content === "object" &&
                        (message.content as any).type === "max_questions_choice" ? (
                        // Max Questions Choice Display
                        <div className="space-y-6">
                          <div className="text-center">
                            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-500 to-red-500 rounded-full mb-4">
                              <AlertTriangle className="h-8 w-8 text-white" />
                            </div>
                            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                              Maximum Questions Reached
                            </h2>
                            <p className="text-gray-600 dark:text-gray-400">
                              We've asked {(message.content as any).questionCount} questions. What would you like to do?
                            </p>
                          </div>

                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                            <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                              <TrendingUp className="h-5 w-5 mr-2" />
                              Current Assessment
                            </h3>
                            {(message.content as any).conditions && (message.content as any).conditions.length > 0 ? (
                              <div className="space-y-2">
                                {(message.content as any).conditions
                                  .slice(0, 3)
                                  .map((condition: any, index: number) => {
                                    const percentage = (condition.probability * 100).toFixed(1)
                                    const emoji = index === 0 ? "🔴" : index === 1 ? "🟡" : "🟢"
                                    return (
                                      <div key={condition.id} className="flex justify-between items-center">
                                        <span className="text-sm text-blue-800 dark:text-blue-200">
                                          {emoji} {condition.common_name || condition.name}
                                        </span>
                                        <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                                          {percentage}%
                                        </span>
                                      </div>
                                    )
                                  })}
                              </div>
                            ) : (
                              <p className="text-sm text-blue-800 dark:text-blue-200">
                                No specific conditions identified yet.
                              </p>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
                              <div className="flex items-start space-x-3">
                                <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                                    End Diagnosis Now
                                  </h4>
                                  <p className="text-sm text-green-800 dark:text-green-200 leading-relaxed mb-3">
                                    Get results based on current information. Good choice if you have a clear leading
                                    condition.
                                  </p>
                                  <button
                                    onClick={handleEndDiagnosis}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                                  >
                                    End Diagnosis
                                  </button>
                                </div>
                              </div>
                            </div>

                            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                              <div className="flex items-start space-x-3">
                                <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                                <div>
                                  <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                                    Continue for Better Accuracy
                                  </h4>
                                  <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed mb-3">
                                    Ask more questions to improve diagnosis accuracy. Will continue until we reach high
                                    confidence (85%+) or API recommends stopping.
                                  </p>
                                  <button
                                    onClick={handleContinueDiagnosis}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                                  >
                                    Continue Diagnosis
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
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
                    setUserLocation(null)
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
                    setShowMaxQuestionsChoice(false)
                    setContinuePastMaxQuestions(false)
                    setEmergencySymptoms([])

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

// Speech Recognition Interfaces
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string
  readonly message: string
}

interface SpeechGrammarList {
  addFromString(grammar: string, weight?: number): void
  addFromURI(uri: string, weight?: number): void
  length: number
  [index: number]: SpeechGrammar
}

interface SpeechGrammar {
  src: string
  weight: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  grammars: SpeechGrammarList
  interimResults: boolean
  lang: string
  maxAlternatives: number
  serviceURI: string

  onstart: ((this: SpeechRecognition, ev: Event) => any) | null
  onend: ((this: SpeechRecognition, ev: Event) => any) | null
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null

  start(): void
  stop(): void
  abort(): void
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition
  new (): SpeechRecognition
}

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof webkitSpeechRecognition
  }
}
