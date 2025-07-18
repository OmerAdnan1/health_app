# Health App Backend

A Node.js/Express backend API for the Health Buddy application.

## Features

- User authentication (register/login)
- Health metrics tracking
- User profile management
- RESTful API design
- MongoDB integration
- JWT authentication
- Input validation
- Error handling

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or cloud)
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Copy environment variables:
   \`\`\`bash
   cp .env.example .env
   \`\`\`

4. Update the `.env` file with your configuration

5. Start the development server:
   \`\`\`bash
   npm run dev
   \`\`\`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/profile` - Get current user profile

### Users
- `PUT /api/users/profile` - Update user profile
- `DELETE /api/users/account` - Delete user account

### Health Metrics
- `POST /api/health/metrics` - Add health metric
- `GET /api/health/metrics` - Get health metrics
- `GET /api/health/summary` - Get health summary
- `DELETE /api/health/metrics/:id` - Delete health metric

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests

## Project Structure

\`\`\`
backend/
├── src/
│   ├── config/         # Database configuration
│   ├── controllers/    # Route controllers
│   ├── middleware/     # Custom middleware
│   ├── models/         # Database models
│   ├── routes/         # API routes
│   ├── types/          # TypeScript types
│   └── server.ts       # Main server file
├── dist/               # Compiled JavaScript
└── package.json
