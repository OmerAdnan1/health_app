"use client"
import { useState } from "react"
import { MessageCircle, Phone, Mail, X, Zap } from "lucide-react"

export default function FloatingActionButton() {
  const [isOpen, setIsOpen] = useState(false)

  const actions = [
    { icon: MessageCircle, label: "Quick Chat", color: "bg-blue-500 hover:bg-blue-600" },
    { icon: Phone, label: "Emergency", color: "bg-red-500 hover:bg-red-600" },
    { icon: Mail, label: "Contact", color: "bg-green-500 hover:bg-green-600" },
  ]

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Action Buttons */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 space-y-3 animate-in slide-in-from-bottom duration-300">
          {actions.map((action, index) => (
            <div
              key={index}
              className="flex items-center space-x-3 animate-in slide-in-from-right duration-300"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <span className="bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-lg text-sm font-medium shadow-lg border border-gray-200 dark:border-gray-700 whitespace-nowrap">
                {action.label}
              </span>
              <button
                className={`p-3 ${action.color} text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300`}
              >
                <action.icon className="h-5 w-5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-110 transition-all duration-300 relative overflow-hidden group"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-green-600 to-blue-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
        <div className="relative">{isOpen ? <X className="h-6 w-6" /> : <Zap className="h-6 w-6" />}</div>
      </button>
    </div>
  )
}
