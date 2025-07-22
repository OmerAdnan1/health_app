"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { Send, Bot, User, Lightbulb, CheckCircle, Volume2, VolumeX } from "lucide-react"
import { v4 as uuidv4 } from "uuid"

// Type Definitions (ensuring consistency)
type Message = {
  id: number
  content: string | InfermedicaQuestion // Content can be string or structured question
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
  type: "single" | "grouped_single" | "grouped_multiple" // Added specific types
  text: string
  items: InfermedicaQuestionItem[]
}

type EvidenceItem = {
  id: string
  choice_id: "present" | "absent" | "unknown"
}

// New type for initial fixed questions
type InitialQuestion = {
    id: string;
    question: string;
    type: "age" | "select" | "text";
    options?: string[]; // For 'select' type
    tips: string[];
}

// Helper function to safely parse API responses
const parseJsonResponse = async (response: Response) => {
    try {
        const text = await response.text();
        if (!response.ok) {
            // If response is not OK (e.g., 400, 500), try to parse JSON for error messages
            try {
                const errorData = JSON.parse(text);
                throw new Error(errorData.message || `API error: ${response.status} ${response.statusText}`);
            } catch (jsonError) {
                // If text is not JSON or empty, throw generic error with status
                throw new Error(`API error: ${response.status} ${response.statusText}${text ? `: ${text}` : ''}`);
            }
        }
        // If response is OK, try to parse JSON. If text is empty, return an empty object.
        return text ? JSON.parse(text) : {};
    } catch (error) {
        console.error("Error parsing JSON response:", error);
        // Re-throw to be caught by the calling function (e.g., getDiagnosis, getParseResult)
        throw error;
    }
};

export default function ChatbotPage() {
  const router = useRouter()
  const [userAge, setUserAge] = useState<number | null>(null)
  const [userSex, setUserSex] = useState<"male" | "female" | "other" | null>(null)

  const [messages, setMessages] = useState<Message[]>([])
  const [currentInput, setCurrentInput] = useState<string>("")
  const [currentStep, setCurrentStep] = useState<number>(0)
  const [isTyping, setIsTyping] = useState<boolean>(false)
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false)
  const [diagnosisResult, setDiagnosisResult] = useState<string | null>(null) // Raw JSON for debugging if needed
  const [evidence, setEvidence] = useState<EvidenceItem[]>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [interviewId, setInterviewId] = useState<string | null>(null)

  const [currDiagnosisQuestions, setCurrDiagnosisQuestions] = useState<InfermedicaQuestion | null>(null) // Explicitly type
  const [currDiagnosisConditions, setCurrDiagnosisConditions] = useState<any[]>([])
  const [isDiagnosisComplete, setIsDiagnosisComplete] = useState<boolean>(false)
  const [tempGroupedSelections, setTempGroupedSelections] = useState<Record<string, "present" | "absent" | "unknown">>({});
  const MAX_DIAGNOSIS_QUESTIONS = 8;
  const [diagnosisQuestionCount, setDiagnosisQuestionCount] = useState(0);

  // Initial fixed questions for the bot
  const questions: InitialQuestion[] = [
    {
      id: "age_input",
      question: "Hi. Please tell me your age.",
      type: "age",
      tips: [
        "Tell your exact age.",
        "Units should be in years.",
        "Do not tell an exaggerated age as it may lead to wrong diagnosis.",
      ],
    },
    {
      id: "sex_input",
      question: "What is your gender?",
      type: "select",
      options: ["male", "female", "other"],
      tips: [
        "Please specify your gender clearly.",
        "If you prefer not to say, select 'other'.",
        "This helps us provide better insights.",
      ],
    },
    {
      id: "symptoms",
      question: "What symptoms are you experiencing? Please describe them in detail.",
      type: "text",
      tips: [
        "Be specific about location, intensity, and duration.",
        "Mention any triggers you've noticed.",
        "Include associated symptoms.",
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
        }, 1500) // Give user a bit more time after intro
      }, 500)
    }
  }, []) // Empty dependency array means this runs once on mount

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
    }, 100) // Simulate typing delay
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

    // Handles confirmation for grouped_multiple questions
  const handleGroupedMultipleConfirm = async () => {
    setIsTyping(true);
    addUserMessage("Confirmed selections.");

    const newEvidenceToAdd: EvidenceItem[] = Object.entries(tempGroupedSelections).map(([id, choice_id]) => ({
        id,
        choice_id,
    }));

    setTempGroupedSelections({});

    setEvidence((prevEvidence) => {
        const filteredPrevEvidence = prevEvidence.filter(item => !newEvidenceToAdd.some(newItem => newItem.id === item.id));
        const combinedEvidence = [...filteredPrevEvidence, ...newEvidenceToAdd];

        setTimeout(async () => {
            try {
                // FINAL VERDICT LOGIC
                if (diagnosisQuestionCount + 1 >= MAX_DIAGNOSIS_QUESTIONS) {
                    const finalDiagnosisResult = await getDiagnosis(combinedEvidence);
                    setDiagnosisResult(JSON.stringify(finalDiagnosisResult, null, 2));
                    setCurrDiagnosisConditions(finalDiagnosisResult.conditions || []);
                    setIsDiagnosisComplete(true);
                    setCurrDiagnosisQuestions(null);
                    setDiagnosisQuestionCount(prev => prev + 1);

                    if (finalDiagnosisResult.conditions && finalDiagnosisResult.conditions.length > 0) {
                        const topCondition = finalDiagnosisResult.conditions.reduce(
                            (max: { probability: number }, cond: { probability: number }) =>
                                cond.probability > max.probability ? cond : max,
                            finalDiagnosisResult.conditions[0]
                        );
                        addBotMessage(
                            `Final verdict: ${topCondition.name}\n\n` +
                            "\nPlease consult a healthcare professional for confirmation and treatment."
                        );
                    } else {
                        addBotMessage("No significant condition detected. Please consult a healthcare professional.");
                    }
                    setIsTyping(false);
                    return;
                }

                // Normal diagnosis flow
                const nextDiagnosisResult = await getDiagnosis(combinedEvidence);
                setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2));
                setCurrDiagnosisConditions(nextDiagnosisResult.conditions || []);
                setIsDiagnosisComplete(nextDiagnosisResult.should_stop);
                setCurrDiagnosisQuestions(nextDiagnosisResult.question || null);
                setDiagnosisQuestionCount(prev => prev + 1);

                setIsTyping(false);
                if (nextDiagnosisResult.should_stop) {
                    displayFinalDiagnosis(nextDiagnosisResult.conditions);
                } else if (nextDiagnosisResult.question) {
                    addBotMessage(nextDiagnosisResult.question);
                } else {
                    addBotMessage("The diagnosis process needs more information, but I couldn't generate the next question. Please consult a healthcare professional.");
                }
            } catch (error) {
                console.error("Error during grouped_multiple diagnosis confirmation:", error);
                const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                addBotMessage(`An error occurred: ${errorMessage}. Please try again.`);
                setIsTyping(false);
            }
        }, 1000);
        return combinedEvidence;
    });
  };

  // Main message handling logic
  const handleSendMessage = async (input?: string) => {
    const value = input !== undefined ? input : currentInput
    if (!value.trim()) return

    // Clear currentInput immediately for all types of responses
    setCurrentInput("")

    // --- Handling Initial Fixed Questions (Age, Sex) ---
    // This block runs if we are still within the 'questions' array flow AND NOT on the last question (symptoms)
    if (currentStep < questions.length - 1) {
        const currentQuestion = questions[currentStep];

        // Add user message for these initial, user-typed/selected inputs
        addUserMessage(value);

        if (currentQuestion.id === "age_input") {
            const age = parseInt(value, 10);
            if (isNaN(age) || age <= 0 || age > 120) {
                addBotMessage("Please enter a valid age in years (e.g., 30).");
                return;
            }
            setUserAge(age);
            setCurrentStep(currentStep + 1);
            setTimeout(() => {
                addBotMessage(questions[currentStep + 1].question);
            }, 1000);
            return;
        }
        else if (currentQuestion.id === "sex_input") {
            const sex = value.toLowerCase();
            if (!["male", "female", "other"].includes(sex)) {
                addBotMessage("Please select from 'male', 'female', or 'other'.");
                return;
            }
            setUserSex(sex as "male" | "female" | "other");
            if (!interviewId) {
                setInterviewId(uuidv4()); // Initialize interview ID
            }
            setCurrentStep(currentStep + 1);
            setTimeout(() => {
                addBotMessage(questions[currentStep + 1].question);
            }, 1000);
            return;
        }
    }
    // --- Handling Initial Symptoms Question (the last fixed question) ---
    // This block runs when currentStep is exactly `questions.length - 1`
    else if (currentStep === questions.length - 1 && questions[currentStep].id === "symptoms") {
        const currentQuestion = questions[currentStep];

        // Add user message for symptoms description
        addUserMessage(value);

        if (value.length < 10) {
            addBotMessage("Please provide a more detailed description of your symptoms (at least 10 characters).");
            return;
        }

        try {
            addBotMessage("Thank you for sharing your symptoms. Please wait while I analyze them.");
            setIsTyping(true);

            // Fetch parse result
            const result = await getParseResult(value);
            if (!result || !Array.isArray(result.mentions)) {
                throw new Error("Received an invalid response format for symptom analysis. Please try again.");
            }
            console.log("Parse result:", result);

            const initialEvidence: EvidenceItem[] = result.mentions.map((mention: any) => ({
                id: mention.id,
                choice_id: mention.choice_id,
            }));

            // NEW CHECK HERE: If no symptoms were parsed
            if (initialEvidence.length === 0) {
                addBotMessage("I couldn't identify any symptoms from your description. Could you please rephrase or provide more details? For example, 'I have a headache and a fever.'");
                setIsTyping(false);
                return; // Stop here, don't call getDiagnosis
            }

            setEvidence(initialEvidence); // This updates the state, but we don't rely on it for the immediate API call

            // Pass initialEvidence directly to getDiagnosis to avoid state update timing issues
            const diagnosis = await getDiagnosis(initialEvidence);
            if (!diagnosis) {
                 throw new Error("No diagnosis data received from the API. The server might be busy or experienced an error.");
            }
            // If diagnosis is not complete, it MUST provide a question
            if (diagnosis.should_stop === false && !diagnosis.question) {
                throw new Error("Diagnosis flow encountered an unexpected state: Expected a question but none was provided.");
            }

            console.log("Initial diagnosis result:", diagnosis);

            setDiagnosisResult(JSON.stringify(diagnosis, null, 2)); // Store raw result for debugging
            setCurrDiagnosisConditions(diagnosis.conditions || []);
            setIsDiagnosisComplete(diagnosis.should_stop);
            setCurrDiagnosisQuestions(diagnosis.question || null);

            setIsTyping(false);
            setCurrentStep(currentStep + 1);

            if (diagnosis.should_stop) {
                displayFinalDiagnosis(diagnosis.conditions);
            } else if (diagnosis.question) {
                addBotMessage(diagnosis.question); // Ask the first Infermedica question
            } else {
                addBotMessage("The diagnosis process encountered an unexpected state. Please consult a healthcare professional.");
            }
        } catch (error) {
            console.error("Error during initial diagnosis process:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            addBotMessage(`An error occurred: ${errorMessage}. Please try again.`);
            setIsTyping(false);
        }
        return; // Exit after handling symptoms
    }
    // --- Handling Infermedica Diagnosis Questions ---
    // This block runs when we are past the initial fixed questions AND
    // there's an active diagnosis question from Infermedica AND it's not complete yet.
    if (currDiagnosisQuestions && !isDiagnosisComplete) {
        const parts = value.split(':');
        if (parts.length === 2) {
            const itemId = parts[0];
            const choiceId = parts[1] as "present" | "absent" | "unknown";
            if (!["present", "absent", "unknown"].includes(choiceId)) {
                addBotMessage("Invalid answer. Please select one of the provided options.");
                return;
            }

            // For single/grouped_single questions, proceed with immediate API call
            const newEvidence = [...evidence.filter(item => item.id !== itemId), { id: itemId, choice_id: choiceId }];
            setEvidence(newEvidence);

            setIsTyping(true);
            setTimeout(async () => {
                try {
                    // FINAL VERDICT LOGIC
                    if (diagnosisQuestionCount + 1 >= MAX_DIAGNOSIS_QUESTIONS) {
                        const finalDiagnosisResult = await getDiagnosis(newEvidence);
                        setDiagnosisResult(JSON.stringify(finalDiagnosisResult, null, 2));
                        setCurrDiagnosisConditions(finalDiagnosisResult.conditions || []);
                        setIsDiagnosisComplete(true);
                        setCurrDiagnosisQuestions(null);
                        setDiagnosisQuestionCount(prev => prev + 1);

                        // Find the condition with highest probability
                        if (finalDiagnosisResult.conditions && finalDiagnosisResult.conditions.length > 0) {
                            const topCondition = finalDiagnosisResult.conditions.reduce(
                                (max: { probability: number }, cond: { probability: number }) =>
                                    cond.probability > max.probability ? cond : max,
                                finalDiagnosisResult.conditions[0]
                            );
                            addBotMessage(
                                `Final Diagnosis: **${topCondition.name}**\n\n` +
                                "Please consult a healthcare professional for confirmation and treatment."
                            );
                        } else {
                            addBotMessage("No significant condition detected. Please consult a healthcare professional.");
                        }
                        setIsTyping(false);
                        return;
                    }

                    // Normal diagnosis flow
                    const nextDiagnosisResult = await getDiagnosis(newEvidence);
                    setDiagnosisResult(JSON.stringify(nextDiagnosisResult, null, 2));
                    setCurrDiagnosisConditions(nextDiagnosisResult.conditions || []);
                    setIsDiagnosisComplete(nextDiagnosisResult.should_stop);
                    setCurrDiagnosisQuestions(nextDiagnosisResult.question || null);
                    setDiagnosisQuestionCount(prev => prev + 1);

                    setIsTyping(false);
                    if (nextDiagnosisResult.should_stop) {
                        displayFinalDiagnosis(nextDiagnosisResult.conditions);
                    } else if (nextDiagnosisResult.question) {
                        addBotMessage(nextDiagnosisResult.question);
                    } else {
                        addBotMessage("The diagnosis process needs more information, but I couldn't generate the next question. Please consult a healthcare professional.");
                    }
                } catch (error) {
                    console.error("Error during subsequent diagnosis:", error);
                    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
                    addBotMessage(`An error occurred: ${errorMessage}. Please try again.`);
                    setIsTyping(false);
                }
            }, 1000);
        } else {
            // This is a free-text input while Infermedica questions are active
            addBotMessage("Please use the provided buttons to answer the health questions. Typing free-text is not supported during this phase.");
        }
    }
    // Handles scenario where diagnosis is complete and user tries to type again
    else if (isDiagnosisComplete) {
        addBotMessage("The diagnosis is complete. Please click 'Start a New Diagnosis' if you wish to begin a new assessment. 🔄");
    }
    else {
        // This should not happen, but if it does, we handle it gracefully
        addBotMessage("An unexpected state occurred. Please try again or refresh the page.");
    }
  };

  // Infermedica API calls
  const getDiagnosis = async (currentEvidence: EvidenceItem[]) => {
    if (userAge === null || userSex === null || currentEvidence.length === 0) {
      throw new Error("Diagnosis prerequisites (age, sex, or symptoms) are missing. Cannot proceed with diagnosis.");
    }

    const payload = {
      age: {
        value: userAge,
        unit: "year",
      },
      sex: userSex,
      evidence: currentEvidence,
      interview_id: interviewId || uuidv4(),
    };

    try {
      console.log("DEBUG: Sending payload to /diagnosis:", JSON.stringify(payload, null, 2));
      const res = await fetch("http://localhost:5000/api/infermedica/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await parseJsonResponse(res); // Use helper for parsing and error handling
    } catch (error) {
      console.error("API call to /diagnosis failed:", error);
      throw error; // Re-throw for handleSendMessage to catch
    }
  };

  const getParseResult = async (responseString: string) => {
    if (userAge === null || userSex === null) {
      throw new Error("Parsing prerequisites (age or sex) are missing. Cannot parse symptoms.");
    }

    const payload = {
      age: { value: userAge, unit: "year" },
      sex: userSex,
      text: responseString,
      context: [],
      include_tokens: true,
      correct_spelling: true,
      concept_types: ["symptom"],
      interviewId: interviewId || uuidv4(),
    };

    try {
      const res = await fetch("http://localhost:5000/api/infermedica/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await parseJsonResponse(res); // Use helper for parsing and error handling
    } catch (error) {
      console.error("API call to /parse failed:", error);
      throw error; // Re-throw for handleSendMessage to catch
    }
  };

  // Displays the final diagnosis message
  const displayFinalDiagnosis = (conditions: any[]) => {
      let finalMessage = "Based on the information provided, here are the potential conditions:\n\n";

      if (conditions && conditions.length > 0) {
          // Sort by probability and take top 3
          conditions.sort((a, b) => b.probability - a.probability);
          conditions.slice(0, 3).forEach((condition: any) => {
              finalMessage += `**${condition.name}**: ${ (condition.probability * 100).toFixed(2)}% probability.\n`;
          });
          finalMessage += "\n\n**Disclaimer**: This AI assistant provides insights based on the information you've shared and is not a substitute for professional medical advice. Always consult a qualified healthcare professional for an accurate diagnosis and treatment plan. Your health is important! 🩺";
      } else {
          finalMessage = "Based on the information provided, I couldn't identify a specific condition at this time. It's important to remember that AI diagnosis is not a substitute for professional medical advice. Please consult a qualified healthcare professional for a complete diagnosis. Your well-being is our priority. 🙏";
      }
      addBotMessage(finalMessage);
  };

  // Define currentQuestion here to make it accessible in JSX
  const currentQuestion = questions[currentStep];

  // Calculate progress for the initial fixed questions only
  const progress = ((currentStep + 1) / questions.length) * 100

  // Text-to-Speech
  const speakMessage = (text: string) => {
    if ("speechSynthesis" in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onstart = () => setIsSpeaking(true)
      utterance.onend = () => setIsSpeaking(false)
      speechSynthesis.speak(utterance)
    } else {
        console.warn("Speech synthesis not supported in this browser.");
    }
  }

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      speechSynthesis.cancel()
      setIsSpeaking(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors">
      <Header />

      <main className="flex-1 pt-16 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Enhanced Progress Bar */}
          {currentStep < questions.length && !isDiagnosisComplete ? ( // Only show progress for initial questions
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 transition-colors">
                <div className="max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Health Assessment</h1>
                            <p className="text-gray-600 dark:text-gray-400">Powered by advanced machine learning</p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{Math.round(progress)}%</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Complete</div>
                        </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Assessment Progress</span>
                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {currentStep + 1} of {questions.length}
                        </span>
                    </div>

                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                        <div
                        className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500 relative overflow-hidden"
                        style={{ width: `${progress}%` }}
                        >
                        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
          ) : (
            // Display a status message when in Infermedica diagnosis or diagnosis complete
            <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 transition-colors text-center">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AI Health Assessment</h1>
                {isDiagnosisComplete ? (
                    <p className="text-gray-600 dark:text-gray-400">Diagnosis Complete! Review the results below. ✅</p>
                ) : (
                    <p className="text-gray-600 dark:text-gray-400">Continuing Diagnosis... Please answer the questions. 🔍</p>
                )}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="max-w-4xl mx-auto space-y-6">
              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`flex items-start space-x-3 max-w-2xl ${message.sender === "user" ? "flex-row-reverse space-x-reverse" : ""}`}
                  >
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${
                        message.sender === "user"
                          ? "bg-gradient-to-r from-blue-500 to-blue-600"
                          : "bg-gradient-to-r from-green-500 to-blue-500"
                      }`}
                    >
                      {message.sender === "user" ? (
                        <User className="h-5 w-5 text-white" />
                      ) : (
                        <Bot className="h-5 w-5 text-white" />
                      )}
                    </div>
                    <div
                      className={`px-6 py-4 rounded-2xl shadow-lg border transition-all duration-300 hover:shadow-xl ${
                        message.sender === "user"
                          ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white border-blue-200"
                          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200"
                      }`}
                    >
                      {/* Conditional rendering based on message.content type */}
                      {typeof message.content === "string" ? (
                        // Render plain text message
                        <p className="text-sm leading-relaxed">{message.content}</p>
                      ) : (
                        // Render structured Infermedica question
                        // Use an IIFE for proper type narrowing
                        (() => {
                            const questionContent: InfermedicaQuestion = message.content;
                            return (
                                <div>
                                    {/* Main question text */}
                                    <p className="text-sm font-semibold leading-relaxed mb-2">
                                        {questionContent.text}
                                    </p>

                                    {/* Render items and their choices if available */}
                                    {questionContent.items && questionContent.items.length > 0 && (
                                        <div className="space-y-3 mt-2">
                                            {questionContent.items.map((item: InfermedicaQuestionItem) => (
                                                <div key={item.id} className="border-t border-gray-200 dark:border-gray-700 pt-3">
                                                    {/* Item name (e.g., "Very sensitive to light") */}
                                                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-2">
                                                        {item.name}
                                                    </p>
                                                    {/* Choices for each item (Yes, No, Don't know buttons) */}
                                                    <div className="flex flex-wrap gap-2">
                                                        {item.choices.map((choice: InfermedicaChoice) => (
                                                            <button
                                                                key={choice.id}
                                                                // Fix 3: Update button onClick handlers to differentiate question types
                                                                onClick={() => {
                                                                    if (questionContent.type === 'grouped_multiple') {
                                                                        // Only update local state - NO API call here
                                                                        setTempGroupedSelections((prev) => ({
                                                                            ...prev,
                                                                            [item.id]: choice.id,
                                                                        }));
                                                                    } else {
                                                                        // For single/grouped_single questions - immediate API call
                                                                        handleSendMessage(`${item.id}:${choice.id}`);
                                                                    }
                                                                }}
                                                                className={`px-4 py-2 rounded-full text-xs font-medium transition-colors
                                                                            ${questionContent.type === 'grouped_multiple' && tempGroupedSelections[item.id] === choice.id
                                                                                ? 'bg-blue-600 text-white dark:bg-blue-500' // Highlight selected for grouped_multiple
                                                                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                                                                            }
                                                                            hover:bg-blue-500 hover:text-white dark:hover:bg-blue-600`}
                                                            >
                                                                {choice.label}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                            {/* "Confirm Selections" button for grouped_multiple questions */}
                                            {questionContent.type === 'grouped_multiple' && (
                                                <div className="mt-4 text-center">
                                                    <button
                                                        onClick={handleGroupedMultipleConfirm} // Fix 4: Ensure handleGroupedMultipleConfirm is the ONLY path for grouped_multiple API calls
                                                        disabled={Object.keys(tempGroupedSelections).length === 0}
                                                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-full font-semibold
                                                                   hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        Confirm Selections
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })()
                      )}

                      <div className="flex items-center justify-between mt-3">
                        <div
                          className={`text-xs ${message.sender === "user" ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}
                        >
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {message.sender === "bot" && (
                          <button
                            onClick={() => (isSpeaking ? stopSpeaking() : speakMessage(
                                typeof message.content === "string" ? message.content : message.content.text
                            ))}
                            className="text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
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
                  <div className="flex items-start space-x-3 max-w-2xl">
                    <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-blue-500 flex items-center justify-center shadow-lg">
                      <Bot className="h-5 w-5 text-white" />
                    </div>
                    <div className="px-6 py-4 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg">
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

          {/* Enhanced Input Area */}
          {/* Conditionally render input based on the current state of the conversation */}
          {(!currDiagnosisQuestions || isDiagnosisComplete) ? ( // Fix for line 665
              <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 transition-colors">
                  <div className="max-w-4xl mx-auto">
                      {/* Render text input for 'symptoms' (and potentially other text types) or 'age' */}
                      {(currentStep < questions.length && (currentQuestion?.type === "text" || currentQuestion?.type === "age")) && (
                          <div className="flex space-x-4">
                              <div className="flex-1 relative">
                                  <input
                                      type={currentQuestion?.type === "age" ? "number" : "text"}
                                      min={currentQuestion?.type === "age" ? 0 : undefined}
                                      value={currentInput}
                                      onChange={(e) => setCurrentInput(e.target.value)}
                                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                                      placeholder={currentQuestion?.type === "age" ? "Enter your age in years" : "Type your response..."}
                                      className="w-full px-6 py-4 border border-gray-300 dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                                  />
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

                      {/* Render select buttons for 'sex_input' */}
                      {currentStep < questions.length && currentQuestion?.type === "select" && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {currentQuestion.options?.map((option, index) => (
                                  <button
                                      key={index}
                                      onClick={() => handleSendMessage(option)}
                                      className="p-6 text-left border-2 border-gray-200 dark:border-gray-600 rounded-2xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 hover:shadow-lg hover:scale-105 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                                  >
                                      <div className="font-medium">{option}</div>
                                  </button>
                              ))}
                          </div>
                      )}

                      {/* When diagnosis is complete, offer to start a new diagnosis */}
                      {isDiagnosisComplete && (
                          <div className="text-center mt-6">
                              <button
                                  onClick={() => {
                                      // Reset all relevant states to restart the process
                                      setUserAge(null);
                                      setUserSex(null);
                                      setMessages([]);
                                      setCurrentInput("");
                                      setCurrentStep(0);
                                      setIsTyping(false);
                                      setIsSpeaking(false);
                                      setDiagnosisResult(null);
                                      setEvidence([]);
                                      setInterviewId(null);
                                      setCurrDiagnosisQuestions(null);
                                      setCurrDiagnosisConditions([]);
                                      setIsDiagnosisComplete(false);
                                      setTempGroupedSelections({}); // Reset temporary selections
                                      // Re-initiate initial bot message for a fresh start
                                      setTimeout(() => {
                                          addBotMessage(
                                              "Hello! I'm your HealthBuddy AI assistant. I'll help analyze your symptoms and provide personalized health insights. Let's start with a few questions.",
                                          );
                                          setTimeout(() => {
                                              addBotMessage(questions[0].question);
                                          }, 1000);
                                      }, 500);
                                  }}
                                  className="px-8 py-4 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-2xl hover:shadow-lg transition-all duration-300 hover:scale-105"
                              >
                                  Start a New Diagnosis 🔄
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          ) : (
              // If Infermedica is currently asking questions (currDiagnosisQuestions is not null/false and not complete),
              // we don't show a generic input box. The user interacts with the buttons in the chat message.
              <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 text-center text-gray-500 dark:text-gray-400">
                  Please select an option from the question above to continue the diagnosis. 👆
              </div>
          )}
        </div>

        {/* Enhanced Tips Sidebar */}
        <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 p-6 hidden lg:block transition-colors">
          <div className="sticky top-24 space-y-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-xl">
                <Lightbulb className="h-5 w-5 text-white" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">Helpful Tips</h3>
            </div>

            {/* Display tips for current question */}
            {currentStep < questions.length && questions[currentStep]?.tips && (
              <div className="space-y-4">
                {questions[currentStep].tips.map((tip, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800"
                  >
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{tip}</p>
                  </div>
                ))}
              </div>
            )}
            {!(currentStep < questions.length && questions[currentStep]?.tips) && (
                 <div className="space-y-4">
                    <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            Answer all questions accurately for the best diagnosis.
                        </p>
                    </div>
                    <div className="flex items-start space-x-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                            If unsure, select "Don't know" or "Unknown".
                        </p>
                    </div>
                 </div>
            )}


            <div className="p-6 bg-gradient-to-r from-blue-50 to-green-50 dark:from-blue-900/20 dark:to-green-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
              <h4 className="font-bold text-blue-900 dark:text-blue-100 mb-3 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                Privacy & Security
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-200 leading-relaxed">
                Your health information is encrypted with military-grade security. We never share your data with third
                parties and comply with all HIPAA regulations.
              </p>
            </div>

            <div className="p-6 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-2xl border border-purple-200 dark:border-purple-800">
              <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-3">AI Accuracy</h4>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">95%</div>
              <p className="text-sm text-purple-800 dark:text-purple-200">
                Our AI has been trained on millions of medical cases and maintains a high accuracy rate in symptom
                analysis.
              </p>
            </div>
          </div>
        </div>
      </main>

      
    </div>
  )
}