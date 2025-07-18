"use client"
import { useState, useEffect } from "react"
import { Heart, Activity, Thermometer, Droplets } from "lucide-react"

export default function HealthMetrics() {
  const [metrics, setMetrics] = useState({
    heartRate: 72,
    steps: 8432,
    temperature: 98.6,
    hydration: 65,
  })

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setMetrics((prev) => ({
        heartRate: prev.heartRate + (Math.random() - 0.5) * 4,
        steps: prev.steps + Math.floor(Math.random() * 10),
        temperature: 98.6 + (Math.random() - 0.5) * 0.4,
        hydration: Math.min(100, prev.hydration + Math.random() * 2),
      }))
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  const metricCards = [
    {
      icon: Heart,
      label: "Heart Rate",
      value: Math.round(metrics.heartRate),
      unit: "bpm",
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-900/20",
    },
    {
      icon: Activity,
      label: "Steps",
      value: metrics.steps.toLocaleString(),
      unit: "today",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20",
    },
    {
      icon: Thermometer,
      label: "Temperature",
      value: metrics.temperature.toFixed(1),
      unit: "°F",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-900/20",
    },
    {
      icon: Droplets,
      label: "Hydration",
      value: Math.round(metrics.hydration),
      unit: "%",
      color: "text-cyan-500",
      bgColor: "bg-cyan-50 dark:bg-cyan-900/20",
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metricCards.map((metric, index) => (
        <div
          key={index}
          className={`${metric.bgColor} rounded-2xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-all duration-300 hover:scale-105`}
        >
          <div className="flex items-center justify-between mb-3">
            <metric.icon className={`h-6 w-6 ${metric.color}`} />
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {metric.value}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400 ml-1">{metric.unit}</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">{metric.label}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
