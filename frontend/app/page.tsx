"use client"
import { useState, useEffect } from "react"
import Link from "next/link"
import Header from "../components/Header"
import Footer from "../components/Footer"
import FloatingActionButton from "../components/FloatingActionButton"
import HealthMetrics from "../components/HealthMetrics"
import {
  MessageCircle,
  TrendingUp,
  Calendar,
  Shield,
  ArrowRight,
  Sparkles,
  Users,
  Award,
  Zap,
  Brain,
  Star,
} from "lucide-react"

export default function HomePage() {
  const [isVisible, setIsVisible] = useState(false)
  const [currentTestimonial, setCurrentTestimonial] = useState(0)

  useEffect(() => {
    setIsVisible(true)

    // Auto-rotate testimonials
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const features = [
    {
      icon: Brain,
      title: "AI-Powered Diagnosis",
      description: "Advanced machine learning algorithms analyze your symptoms with 95% accuracy.",
      color: "from-purple-500 to-pink-500",
      stats: "95% Accuracy",
    },
    {
      icon: TrendingUp,
      title: "Predictive Analytics",
      description: "Forecast health trends and prevent issues before they become serious.",
      color: "from-blue-500 to-cyan-500",
      stats: "7-Day Forecast",
    },
    {
      icon: Calendar,
      title: "Smart Recovery Plans",
      description: "Personalized recovery roadmaps that adapt to your progress in real-time.",
      color: "from-green-500 to-emerald-500",
      stats: "Adaptive Plans",
    },
    {
      icon: Shield,
      title: "Privacy First",
      description: "Military-grade encryption ensures your health data stays completely private.",
      color: "from-red-500 to-orange-500",
      stats: "256-bit Encryption",
    },
  ]

  const stats = [
    { number: "50K+", label: "Active Users", icon: Users },
    { number: "98%", label: "Satisfaction Rate", icon: Star },
    { number: "24/7", label: "AI Availability", icon: Zap },
    { number: "15+", label: "Health Conditions", icon: Award },
  ]

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Teacher",
      content:
        "HealthBuddy helped me identify my symptoms early and get the right treatment. The AI is incredibly accurate!",
      rating: 5,
    },
    {
      name: "Dr. Michael Chen",
      role: "Family Physician",
      content:
        "I recommend HealthBuddy to my patients. It's a great tool for initial symptom assessment and health tracking.",
      rating: 5,
    },
    {
      name: "Emily Rodriguez",
      role: "Nurse",
      content: "The recovery plans are fantastic. My patients love how personalized and easy to follow they are.",
      rating: 5,
    },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex flex-col transition-colors">
      <Header />
      <FloatingActionButton />

      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 dark:bg-blue-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-30 animate-pulse"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-green-200 dark:bg-green-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-30 animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-60 h-60 bg-purple-200 dark:bg-purple-800 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-20 animate-pulse"
          style={{ animationDelay: "4s" }}
        ></div>
      </div>

      <main className="flex-1 pt-16 relative z-10">
        {/* Hero Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-6xl mx-auto">
            <div
              className={`text-center transition-all duration-1000 ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}
            >
              <div className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-100 to-green-100 dark:from-blue-900/30 dark:to-green-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium mb-8 border border-blue-200 dark:border-blue-700">
                <Sparkles className="h-4 w-4 mr-2 animate-pulse" />
                Next-Generation AI Health Assistant
              </div>

              <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
                Your Health,
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-green-600 bg-clip-text text-transparent block animate-gradient bg-300%">
                  Reimagined
                </span>
              </h1>

              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 max-w-4xl mx-auto leading-relaxed">
                Experience the future of healthcare with our AI-powered platform that provides instant health insights,
                personalized recovery plans, and intelligent symptom analysis.
              </p>

              <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
                <Link href="/chatbot">
                  <button className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-2xl font-semibold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-600 transform scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-300"></div>
                    <span className="relative flex items-center">
                      <MessageCircle className="mr-3 h-6 w-6" />
                      Start AI Health Chat
                      <ArrowRight className="ml-3 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </button>
                </Link>

                <Link href="/dashboard">
                  <button className="px-8 py-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-2xl font-semibold text-lg hover:border-blue-500 dark:hover:border-blue-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 hover:shadow-lg">
                    View Live Demo
                  </button>
                </Link>
              </div>

              {/* Health Metrics Preview */}
              <div className="max-w-4xl mx-auto">
                <HealthMetrics />
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
          <div className="max-w-6xl mx-auto">
            <div className="grid md:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center group hover:scale-105 transition-transform duration-300">
                  <div className="inline-flex p-4 bg-gradient-to-r from-blue-500 to-green-500 rounded-2xl mb-4 group-hover:shadow-lg transition-shadow">
                    <stat.icon className="h-8 w-8 text-white" />
                  </div>
                  <div className="text-4xl font-bold text-gray-900 dark:text-white mb-2">{stat.number}</div>
                  <div className="text-gray-600 dark:text-gray-400 font-medium">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Enhanced Features Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
                Revolutionary Health Technology
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                Cutting-edge AI meets intuitive design to deliver the most advanced health management platform ever
                created.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="group relative bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-500 border border-gray-100 dark:border-gray-700 overflow-hidden"
                >
                  {/* Gradient background */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}
                  ></div>

                  <div className="relative z-10">
                    <div className="flex items-center justify-between mb-6">
                      <div
                        className={`inline-flex p-4 rounded-2xl bg-gradient-to-r ${feature.color} shadow-lg group-hover:scale-110 transition-transform duration-300`}
                      >
                        <feature.icon className="h-8 w-8 text-white" />
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-500 dark:text-gray-400">Performance</div>
                        <div className="font-bold text-gray-900 dark:text-white">{feature.stats}</div>
                      </div>
                    </div>

                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:bg-clip-text group-hover:from-blue-600 group-hover:to-green-600 transition-all duration-300">
                      {feature.title}
                    </h3>

                    <p className="text-gray-600 dark:text-gray-300 leading-relaxed text-lg">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-green-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-black/10"></div>
          <div className="max-w-4xl mx-auto relative z-10">
            <div className="text-center mb-12">
              <h2 className="text-4xl font-bold text-white mb-4">Trusted by Healthcare Professionals</h2>
              <p className="text-blue-100 text-xl">See what our users are saying about HealthBuddy</p>
            </div>

            <div className="relative">
              <div className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 border border-white/20">
                <div className="text-center">
                  <div className="flex justify-center mb-4">
                    {[...Array(testimonials[currentTestimonial].rating)].map((_, i) => (
                      <Star key={i} className="h-6 w-6 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-xl text-white mb-6 leading-relaxed">
                    "{testimonials[currentTestimonial].content}"
                  </blockquote>
                  <div className="text-blue-100">
                    <div className="font-semibold">{testimonials[currentTestimonial].name}</div>
                    <div className="text-sm">{testimonials[currentTestimonial].role}</div>
                  </div>
                </div>
              </div>

              {/* Testimonial indicators */}
              <div className="flex justify-center mt-6 space-x-2">
                {testimonials.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentTestimonial(index)}
                    className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      index === currentTestimonial ? "bg-white" : "bg-white/50"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Enhanced CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="relative bg-gradient-to-r from-gray-900 to-gray-800 dark:from-gray-800 dark:to-gray-700 rounded-3xl p-12 text-center text-white overflow-hidden">
              {/* Animated background pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-green-600 animate-pulse"></div>
              </div>

              <div className="relative z-10">
                <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to Transform Your Health?</h2>
                <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                  Join thousands of users who trust HealthBuddy for intelligent health management and personalized care.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/chatbot">
                    <button className="px-8 py-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-2xl font-semibold text-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
                      Start Free Assessment
                    </button>
                  </Link>
                  <Link href="/dashboard">
                    <button className="px-8 py-4 border-2 border-white/30 text-white rounded-2xl font-semibold text-lg hover:bg-white/10 transition-all duration-300">
                      Explore Features
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
