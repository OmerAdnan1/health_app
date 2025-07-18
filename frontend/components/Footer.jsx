import { AlertTriangle, Heart, Shield, Clock } from "lucide-react"

export default function Footer() {
  const features = [
    { icon: Heart, text: "HIPAA Compliant" },
    { icon: Shield, text: "End-to-End Encrypted" },
    { icon: Clock, text: "24/7 Available" },
  ]

  return (
    <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 mt-auto transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Medical Disclaimer */}
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 mb-8">
          <div className="flex items-start space-x-4">
            <div className="flex-shrink-0">
              <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-xl">
                <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">Important Medical Disclaimer</h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                HealthBuddy provides AI-powered health insights for informational purposes only. This is not a
                substitute for professional medical advice, diagnosis, or treatment. Always consult qualified healthcare
                professionals for medical concerns. In emergencies, contact your local emergency services immediately.
              </p>
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="flex flex-wrap justify-center items-center gap-8 mb-8">
          {features.map((feature, index) => (
            <div key={index} className="flex items-center space-x-2 text-gray-600 dark:text-gray-400">
              <feature.icon className="h-5 w-5 text-green-500" />
              <span className="text-sm font-medium">{feature.text}</span>
            </div>
          ))}
        </div>

        {/* Copyright */}
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            &copy; 2024 HealthBuddy. All rights reserved. Made with ❤️ for better health.
          </p>
        </div>
      </div>
    </footer>
  )
}
