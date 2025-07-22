export default function Header({ className = "" }) {
  return (
    <header
      className={`bg-white/95 backdrop-blur-sm dark:bg-gray-900/95 border-b border-gray-200/50 dark:border-gray-700/50 transition-colors ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Rest of the header content remains the same */}
        </div>
      </div>
    </header>
  )
}
