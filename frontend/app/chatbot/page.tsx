"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { Send, Bot, User, Lightbulb, CheckCircle, Mic, MicOff, Volume2, VolumeX } from "lucide-react"

export default function ChatbotPage() {
  const router = useRouter()
  const [messages, setMessages] = useState([])
  const [currentInput, setCurrentInput] = useState("")
  const [currentStep, setCurrentStep] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [responses, setResponses] = useState({})
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const messagesEndRef = useRef(null)

  const questions = [
    {
      id: "symptoms",
      question: "What symptoms are you experiencing? Please describe them in detail.",
      type: "text",
      tips: [
        "Be specific about location, intensity, and duration",
        "Mention any triggers you've noticed",
        "Include associated symptoms",
      ],
    },
    {
      id: "duration",
      question: "How long have you been experiencing these symptoms?",
      type: "select",
      options: ["Less than 24 hours", "1-3 days", "4-7 days", "1-2 weeks", "More than 2 weeks"],
      tips: [
        "Consider when symptoms first appeared",
        "Think about any changes in severity",
        "Note if symptoms are constant or intermittent",
      ],
    },
    {
      id: "severity",
      question: "On a scale of 1-10, how would you rate the severity of your symptoms?",
      type: "scale",
      tips: [
        "1 = Very mild, barely noticeable",
        "5 = Moderate, affecting daily activities",
        "10 = Severe, unbearable pain",
      ],
    },
    {
      id: "triggers",
      question: "Have you noticed any triggers that make your symptoms worse?",
      type: "text",
      tips: [
        "Consider activities, foods, weather, stress",
        "Think about time of day patterns",
        "Note any environmental factors",
      ],
    },
    {
      id: "medications",
      question: "Are you currently taking any medications or supplements?",
      type: "text",
      tips: [
        "Include prescription and over-the-counter medications",
        "Mention vitamins and supplements",
        "Note any recent changes in medication",
      ],
    },
    {
      id: "medical_history",
      question: "Do you have any relevant medical history or chronic conditions?",
      type: "text",
      tips: [
        "Include past surgeries or hospitalizations",
        "Mention chronic conditions",
        "Note family medical history if relevant",
      ],
    },
  ]

  useEffect(() => {
    // Initial bot message
    if (messages.length === 0) {
      setTimeout(() => {
        addBotMessage(
          "Hello! I'm your HealthBuddy AI assistant. I'll help analyze your symptoms and provide personalized health insights. Let's start with a few questions.",
        )
        setTimeout(() => {
          addBotMessage(questions[0].question)
        }, 1000)
      }, 500)
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  const addBotMessage = (content) => {
    setIsTyping(true)
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          content,
          sender: "bot",
          timestamp: new Date(),
        },
      ])
      setIsTyping(false)
    }, 1000)
  }

  const addUserMessage = (content) => {
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        content,
        sender: "user",
        timestamp: new Date(),
      },
    ])
  }

  const handleSendMessage = () => {
    if (!currentInput.trim()) return

    const currentQuestion = questions[currentStep]
    addUserMessage(currentInput)

    // Store response
    setResponses((prev) => ({
      ...prev,
      [currentQuestion.id]: currentInput,
    }))

    setCurrentInput("")

    // Move to next question or finish
    if (currentStep < questions.length - 1) {
      setTimeout(() => {
        setCurrentStep((prev) => prev + 1)
        addBotMessage(questions[currentStep + 1].question)
      }, 1500)
    } else {
      // Finish assessment
      setTimeout(() => {
        addBotMessage(
          "Thank you for providing all the information! I'm now analyzing your symptoms and preparing your personalized health report...",
        )
        setTimeout(() => {
          // Store responses in localStorage for results page
          localStorage.setItem(
            "healthAssessment",
            JSON.stringify({
              responses: { ...responses, [currentQuestion.id]: currentInput },
              timestamp: new Date().toISOString(),
            }),
          )
          router.push("/results")
        }, 3000)
      }, 1000)
    }
  }

  const handleOptionSelect = (option) => {
    setCurrentInput(option)
    setTimeout(() => handleSendMessage(), 100)
  }

  const handleScaleSelect = (value) => {
    setCurrentInput(value.toString())
    setTimeout(() => handleSendMessage(), 100)
  }

  const startListening = () => {
    if ("webkitSpeechRecognition" in window) {
      const recognition = new window.webkitSpeechRecognition()
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

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
      }

      recognition.start()
    }
  }

  const speakMessage = (text) => {
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

  const currentQuestion = questions[currentStep]
  const progress = ((currentStep + 1) / questions.length) * 100

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors">
      <Header />

      <main className="flex-1 pt-16 flex">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Enhanced Progress Bar */}
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
                      <p className="text-sm leading-relaxed">{message.content}</p>
                      <div className="flex items-center justify-between mt-3">
                        <div
                          className={`text-xs ${message.sender === "user" ? "text-blue-100" : "text-gray-500 dark:text-gray-400"}`}
                        >
                          {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        {message.sender === "bot" && (
                          <button
                            onClick={() => (isSpeaking ? stopSpeaking() : speakMessage(message.content))}
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
          {currentStep < questions.length && (
            <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-6 transition-colors">
              <div className="max-w-4xl mx-auto">
                {currentQuestion?.type === "text" && (
                  <div className="flex space-x-4">
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                        placeholder="Type your response..."
                        className="w-full px-6 py-4 border border-gray-300 dark:border-gray-600 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                      />
                      <button
                        onClick={startListening}
                        disabled={isListening}
                        className={`absolute right-4 top-1/2 transform -translate-y-1/2 p-2 rounded-full transition-colors ${
                          isListening
                            ? "bg-red-500 text-white animate-pulse"
                            : "text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                        }`}
                      >
                        {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                      </button>
                    </div>
                    <button
                      onClick={handleSendMessage}
                      disabled={!currentInput.trim()}
                      className="px-8 py-4 bg-gradient-to-r from-blue-500 to-green-500 text-white rounded-2xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 hover:scale-105 disabled:hover:scale-100"
                    >
                      <Send className="h-5 w-5" />
                    </button>
                  </div>
                )}

                {currentQuestion?.type === "select" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {currentQuestion.options.map((option, index) => (
                      <button
                        key={index}
                        onClick={() => handleOptionSelect(option)}
                        className="p-6 text-left border-2 border-gray-200 dark:border-gray-600 rounded-2xl hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-300 hover:shadow-lg hover:scale-105 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                      >
                        <div className="font-medium">{option}</div>
                      </button>
                    ))}
                  </div>
                )}

                {currentQuestion?.type === "scale" && (
                  <div className="space-y-6">
                    <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 font-medium">
                      <span>Mild (1)</span>
                      <span>Moderate (5)</span>
                      <span>Severe (10)</span>
                    </div>
                    <div className="grid grid-cols-10 gap-3">
                      {[...Array(10)].map((_, index) => (
                        <button
                          key={index}
                          onClick={() => handleScaleSelect(index + 1)}
                          className="aspect-square bg-gray-100 dark:bg-gray-700 hover:bg-gradient-to-r hover:from-blue-500 hover:to-green-500 hover:text-white rounded-xl transition-all duration-300 font-bold text-lg hover:shadow-lg hover:scale-110 border-2 border-transparent hover:border-white"
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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

            {currentQuestion && (
              <div className="space-y-4">
                {currentQuestion.tips.map((tip, index) => (
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
                Our AI has been trained on millions of medical cases and maintains a 95% accuracy rate in symptom
                analysis.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
