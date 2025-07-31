# Health App

A comprehensive health monitoring and diagnosis application with AI-powered chatbot functionality.

## Project Structure

\`\`\`
health_app/
├── backend/           # Express.js API server
│   ├── src/
│   │   ├── apis/      # API endpoints (Gemini, Infermedica)
│   │   ├── config/    # Database configuration
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   └── server.ts  # Main server file
│   └── package.json
├── frontend/          # Next.js React application
│   ├── app/           # Next.js app directory
│   │   ├── chatbot/   # AI chatbot with Gemini integration
│   │   ├── dashboard/ # User dashboard
│   │   ├── login/     # Authentication
│   │   └── ...
│   ├── components/    # React components
│   └── package.json
└── package.json       # Root workspace configuration
\`\`\`

## Features

- 🤖 **AI-Powered Chatbot**: Symptom analysis using Infermedica API
- 🧠 **Gemini Integration**: Enhanced medical information and treatment suggestions
- 📊 **Health Dashboard**: Track and monitor health metrics
- 🔐 **User Authentication**: Secure login and user management
- 📱 **Responsive Design**: Mobile-friendly interface

## Quick Start

### Prerequisites
- Node.js (v18 or higher)
- npm or pnpm

### Installation

1. Clone the repository
\`\`\`bash
git clone <repository-url>
cd health_app
\`\`\`

2. Install dependencies for both frontend and backend
\`\`\`bash
npm run install:all
\`\`\`

3. Set up environment variables
\`\`\`bash
# In backend/ directory, create .env file:
cp backend/.env.example backend/.env
# Add your API keys for Infermedica and Gemini
\`\`\`

4. Start development servers
\`\`\`bash
npm run dev
\`\`\`

This will start:
- Backend server on http://localhost:5000
- Frontend application on http://localhost:3000

### Individual Commands

\`\`\`bash
# Frontend only
npm run dev:frontend

# Backend only  
npm run dev:backend

# Build both
npm run build

# Start production
npm run start
\`\`\`

## API Keys Required

1. **Infermedica API**: For symptom analysis and medical diagnosis
   - Get API keys from https://developer.infermedica.com/
   - Add to backend/.env as `INFERMEDICA_APP_ID` and `INFERMEDICA_APP_KEY`

2. **Google Gemini API**: For enhanced medical information
   - Get API key from Google AI Studio
   - Add to backend/.env as `GEMINI_API_KEY`

## Technologies Used

### Backend
- Express.js
- TypeScript
- Axios (API calls)
- CORS
- dotenv

### Frontend  
- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Lucide React (icons)

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

[Your License Here]
