// src/server.ts

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import axios from 'axios';
import cors from 'cors';
// If you need UUIDs for Interview-Id, you'd install 'uuid' and import like this:
// import { v4 as uuidv4 } from 'uuid';

const app = express();

// Middleware
app.use(cors()); // <-- Enable CORS for all routes FIRST
app.use(express.json()); // <-- Enable parsing JSON request bodies

import infermedicaRoutes from "./apis/infermedica";
app.use("/api/infermedica", infermedicaRoutes); // <-- Register routes AFTER middleware

// Infermedica API Credentials from environment variables
const INFERMEDICA_APP_ID = process.env.INFERMEDICA_APP_ID;
const INFERMEDICA_APP_KEY = process.env.INFERMEDICA_APP_KEY;
const INFERMEDICA_BASE_URL = process.env.INFERMEDICA_BASE_URL || 'https://api.infermedica.com/v3';

// Basic validation for credentials (add more robust checking as needed)
if (!INFERMEDICA_APP_ID || !INFERMEDICA_APP_KEY) {
    console.error('ERROR: Infermedica API credentials (APP_ID, APP_KEY) are missing in .env');
    process.exit(1); // Exit if critical credentials are not set
}

// --- Infermedica API Proxy Endpoints ---

// Helper function to create Infermedica headers
// You might manage Interview-Id in your frontend and pass it, or generate here.
// For simplicity, let's generate a new one per request here for now.
// For a real app, you'd likely manage this per user session.
const getInfermedicaHeaders = (interviewId?: string) => {
    // If uuid is not installed, comment out the uuidv4() line below and use a fixed string for testing
    // Or install uuid: npm install uuid @types/uuid

    const idToUse = "68f38d1c-674a-4e41-877e-f3a491691d46";

    return {
        'App-Id': INFERMEDICA_APP_ID,
        'App-Key': INFERMEDICA_APP_KEY,
        'Content-Type': 'application/json',
        'Interview-Id': interviewId || idToUse,
        'Dev-Mode': 'true' // Recommended for development/testing
    } as Record<string, string>; // Type assertion for string keys/values
};

// 1. Proxy for Infermedica /search endpoint
app.get('/api/infermedica/search', async (req: Request, res: Response) => {
    try {
        // Capture all query parameters from the client's request
        const clientQueryParams = req.query;
        
        // Extract 'interviewId' separately as it goes into headers, not query params for Infermedica
        const { interviewId, ...infermedicaQueryParams } = clientQueryParams;

        // Basic validation for required 'phrase'
        if (!infermedicaQueryParams.phrase) {
            return res.status(400).json({ error: 'Phrase is required for search.' });
        }

        // Make the GET request to Infermedica API
        const response = await axios.get(`${INFERMEDICA_BASE_URL}/search`, {
            headers: getInfermedicaHeaders(interviewId as string), // Pass interviewId from client if available
            params: infermedicaQueryParams // Pass all other query parameters directly to Infermedica
        });

        // Send Infermedica's response directly back to the client
        res.json(response.data);
    } catch (error: any) { // Use 'any' to safely access error.response
        console.error('Error proxying /search:', error.message);
        if (error.response) {
            // Forward Infermedica's error status and body to the client
            console.error('Infermedica Error Response:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        // Generic server error
        res.status(500).json({ error: 'Internal Server Error' });
    }
});


// 2. Proxy for Infermedica /parse endpoint
app.post("/api/infermedica/parse", async (req, res) => {
  try {
    const infermedicaUrl = "https://api.infermedica.com/v3/parse";
    const { text, 'age.value': ageValue, 'age.unit': ageUnit, content, interviewId } = req.body;

    if ( !text || !ageValue || !ageUnit || !content) {
      return res.status(400).json({ error: 'Text, age, and content are required for diagnosis.' });
    }

    const response = await axios.post(
      infermedicaUrl,
      req.body,
      {
        headers: getInfermedicaHeaders(interviewId as string)
      }
    )
    res.json(response.data)
  } catch (error: any) {
    console.error('Error proxying /parse:', error.message);
        if (error.response) {
            console.error('Infermedica Error Response:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ error: 'Internal Server Error' });
  }
})

// 3. Proxy for Infermedica /diagnosis endpoint
app.post('/api/infermedica/diagnosis', async (req: Request, res: Response) => {
    try {
        const { sex, age, evidence, extras, interviewId } = req.body;

        if (!sex || !age || !evidence) {
            return res.status(400).json({ error: 'Sex, age, and evidence are required for diagnosis.' });
        }

        const response = await axios.post(`${INFERMEDICA_BASE_URL}/diagnosis`, 
            { sex, age, evidence, extras }, 
            {
                headers: getInfermedicaHeaders(interviewId as string)
            }
        );

        res.json(response.data);
    } catch (error: any) {
        console.error('Error proxying /diagnosis:', error.message);
        if (error.response) {
            console.error('Infermedica Error Response:', error.response.data);
            return res.status(error.response.status).json(error.response.data);
        }
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// 4. Proxy for Infermedica /symptoms endpoint
app.get('/api/infermedica/symptoms', async (req: Request, res: Response) => {
    try {
      const clientQueryParams = req.query;
      const { interviewId, "age.value": ageValue, "age.unit": ageUnit, ...infermedicaQueryParams } = clientQueryParams;

      if (!ageValue || !ageUnit) {
        return res.status(400).json({ error: 'Age is required for symptoms.' });
      }

      const response = await axios.get(`${INFERMEDICA_BASE_URL}/symptoms`, {
        headers: getInfermedicaHeaders(interviewId as string),
        params: clientQueryParams // Pass all query parameters directly to Infermedica
      });

      res.json(response.data);
    }
    catch (error: any) {
      console.error('Error proxying /symptoms:', error.message);
      if (error.response) {
          console.error('Infermedica Error Response:', error.response.data);
          return res.status(error.response.status).json(error.response.data);
      }
      res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Basic health check endpoint for the backend
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ status: 'Backend API is running!' });
});

// Start the server
const port = process.env.PORT || 5000;
app.listen(port, () => {
    console.log(`Infermedica Backend API listening at http://localhost:${port}`);
    // Check if App ID is loaded correctly for debugging
    console.log(`Infermedica App ID: ${INFERMEDICA_APP_ID ? 'Loaded' : 'NOT LOADED - Check .env'}`);
});












// import express from "express" // Express framework
// import cors from "cors" // CORS middleware
// import helmet from "helmet" // Security middleware
// import dotenv from "dotenv" // Load environment variables

// import { connectDB } from "./config/database"
// import { errorHandler } from "./middleware/errorHandler"
// import userRoutes from "./routes/users"
// import healthRoutes from "./routes/health"
// import infermedicaRoutes from "./apis/infermedica"

// // Load environment variables
// dotenv.config()

// const app = express()
// const PORT = process.env.PORT || 5000

// // Connect to database
// connectDB()

// // Middleware
// app.use(helmet())
// app.use(
//   cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//     credentials: true,
//   }),
// )
// app.use(express.json({ limit: "10mb" }))
// app.use(express.urlencoded({ extended: true }))

// // Routes
// app.use("/api/users", userRoutes)
// app.use("/api/health", healthRoutes)
// app.use("/api/infermedica", infermedicaRoutes)

// // Health check endpoint
// app.get("/api/health-check", (req, res) => {
//   res.json({
//     status: "OK",
//     timestamp: new Date().toISOString(),
//     environment: process.env.NODE_ENV || "development",
//   })
// })

// // Error handling middleware
// app.use(errorHandler)

// // 404 handler
// app.use("*", (req, res) => {
//   res.status(404).json({ message: "Route not found" })
// })

// app.listen(PORT, () => {
//   console.log(`🚀 Server running on port ${PORT}`)
//   console.log(`📱 Health check: http://localhost:${PORT}/api/health-check`)
// })

// export default app
