"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Activity, Moon, Sun, Bell, Settings, Menu, X } from "lucide-react"
import { useTheme } from "./ThemeProvider"
import { useState } from "react"

export default function Header({ className = "" }) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useTheme()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [notifications] = useState(3) // Mock notification count

  const navItems = [
    { href: "/", label: "Home" },
    { href: "/chatbot", label: "AI Chat" },
    { href: "/dashboard", label: "Dashboard" },
    { href: "/planner", label: "Planner" },
  ]

  return (
    <header
      className={`fixed top-0 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 z-50 transition-colors ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="relative">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-green-500 rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-lg">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-green-500 rounded-xl blur opacity-30 group-hover:opacity-50 transition-opacity"></div>
            </div>
            <div>
              <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
                HealthBuddy
              </span>
              <div className="text-xs text-gray-500 dark:text-gray-400 -mt-1">AI Health Assistant</div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                  pathname === item.href
                    ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                    : "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                }`}
              >
                {item.label}
                {pathname === item.href && (
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-blue-500 rounded-full"></div>
                )}
              </Link>
            ))}
          </nav>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-3">
            {/* Notifications */}
            <button className="relative p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <Bell className="h-5 w-5" />
              {notifications > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
                  {notifications}
                </span>
              )}
            </button>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-all duration-300 hover:scale-110"
            >
              {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </button>

            {/* Settings */}
            <button className="hidden md:block p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">
              <Settings className="h-5 w-5" />
            </button>

            {/* Login Button */}
            <Link href="/login">
              <button className="hidden md:block px-4 py-2 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl font-medium hover:shadow-lg transform hover:scale-105 transition-all duration-300">
                Sign In
              </button>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200 dark:border-gray-700 animate-in slide-in-from-top duration-300">
            <div className="space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    pathname === item.href
                      ? "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30"
                      : "text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              <Link
                href="/login"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block px-4 py-3 bg-gradient-to-r from-blue-600 to-green-600 text-white rounded-xl font-medium text-center"
              >
                Sign In
              </Link>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
