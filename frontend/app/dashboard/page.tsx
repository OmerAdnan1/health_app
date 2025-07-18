"use client"
import { useState, useEffect } from "react"
import Header from "../../components/Header"
import Footer from "../../components/Footer"
import { Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"
import { Calendar, TrendingUp, Activity, Clock, Filter, Search, Plus, CheckCircle } from "lucide-react"

export default function DashboardPage() {
  const [consultations, setConsultations] = useState([])
  const [filter, setFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    // Mock consultation data
    const mockConsultations = [
      {
        id: 1,
        date: "2024-01-15",
        condition: "Tension Headache",
        severity: 6,
        status: "completed",
        confidence: 85,
        recommendation: "monitor",
        progress: 90,
      },
      {
        id: 2,
        date: "2024-01-10",
        condition: "Upper Respiratory Symptoms",
        severity: 4,
        status: "completed",
        confidence: 78,
        recommendation: "consult",
        progress: 75,
      },
      {
        id: 3,
        date: "2024-01-05",
        condition: "Gastrointestinal Distress",
        severity: 7,
        status: "in-progress",
        confidence: 82,
        recommendation: "monitor",
        progress: 45,
      },
      {
        id: 4,
        date: "2024-01-01",
        condition: "General Wellness Check",
        severity: 2,
        status: "completed",
        confidence: 90,
        recommendation: "monitor",
        progress: 100,
      },
    ]
    setConsultations(mockConsultations)
  }, [])

  const healthTrendData = [
    { month: "Oct", consultations: 2, avgSeverity: 4.5 },
    { month: "Nov", consultations: 3, avgSeverity: 5.2 },
    { month: "Dec", consultations: 1, avgSeverity: 3.0 },
    { month: "Jan", consultations: 4, avgSeverity: 4.8 },
  ]

  const filteredConsultations = consultations.filter((consultation) => {
    const matchesFilter = filter === "all" || consultation.status === filter
    const matchesSearch = consultation.condition.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesFilter && matchesSearch
  })

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800"
      case "in-progress":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getRecommendationColor = (recommendation) => {
    switch (recommendation) {
      case "urgent":
        return "text-red-600"
      case "consult":
        return "text-yellow-600"
      default:
        return "text-green-600"
    }
  }

  const stats = {
    totalConsultations: consultations.length,
    avgSeverity: consultations.reduce((sum, c) => sum + c.severity, 0) / consultations.length || 0,
    completedPlans: consultations.filter((c) => c.status === "completed").length,
    avgConfidence: consultations.reduce((sum, c) => sum + c.confidence, 0) / consultations.length || 0,
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      <main className="flex-1 pt-16 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Health Dashboard</h1>
              <p className="text-lg text-gray-600">Track your health consultations and recovery progress</p>
            </div>

            <button className="mt-4 md:mt-0 px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300 flex items-center">
              <Plus className="h-5 w-5 mr-2" />
              New Consultation
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Total Consultations</p>
                  <p className="text-3xl font-bold">{stats.totalConsultations}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm font-medium">Avg Confidence</p>
                  <p className="text-3xl font-bold">{Math.round(stats.avgConfidence)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm font-medium">Completed Plans</p>
                  <p className="text-3xl font-bold">{stats.completedPlans}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-200" />
              </div>
            </div>

            <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm font-medium">Avg Severity</p>
                  <p className="text-3xl font-bold">{Math.round(stats.avgSeverity * 10) / 10}/10</p>
                </div>
                <Clock className="h-8 w-8 text-orange-200" />
              </div>
            </div>
          </div>

          {/* Health Trends Chart */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Health Trends</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={healthTrendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Bar yAxisId="left" dataKey="consultations" fill="#3B82F6" name="Consultations" />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="avgSeverity"
                    stroke="#EF4444"
                    strokeWidth={3}
                    name="Avg Severity"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Filters and Search */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
              <div className="flex items-center space-x-4">
                <Filter className="h-5 w-5 text-gray-500" />
                <div className="flex space-x-2">
                  {["all", "completed", "in-progress"].map((filterOption) => (
                    <button
                      key={filterOption}
                      onClick={() => setFilter(filterOption)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filter === filterOption
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search consultations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Consultations List */}
          <div className="space-y-4">
            {filteredConsultations.map((consultation) => (
              <div
                key={consultation.id}
                className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-shadow"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">{consultation.condition}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(consultation.status)}`}
                      >
                        {consultation.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-6 text-sm text-gray-600">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>{new Date(consultation.date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Activity className="h-4 w-4" />
                        <span>Severity: {consultation.severity}/10</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="h-4 w-4" />
                        <span>Confidence: {consultation.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className="text-sm text-gray-500 mb-1">Recovery Progress</div>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${consultation.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{consultation.progress}%</span>
                      </div>
                    </div>

                    <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {filteredConsultations.length === 0 && (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No consultations found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm
                  ? "Try adjusting your search terms"
                  : "Start your first health consultation to see your data here"}
              </p>
              <button className="px-6 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                Start New Consultation
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
