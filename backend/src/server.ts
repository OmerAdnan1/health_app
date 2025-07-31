// src/server.ts

// Load environment variables from .env file
import dotenv from 'dotenv';
dotenv.config();

import express, { Request, Response } from 'express';
import cors from 'cors';

const app = express();

// Middleware
app.use(cors()); // Enable CORS for all routes
app.use(express.json()); // Enable parsing JSON request bodies

// API Routes
import infermedicaRoutes from "./apis/infermedica";
import geminiRouter from "./apis/gemini";

app.use("/api/infermedica", infermedicaRoutes);
app.use("/api", geminiRouter);

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ 
        status: 'Backend API is running!',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
    });
});

// 404 handler for unknown routes
app.use('*', (req: Request, res: Response) => {
    res.status(404).json({ 
        error: 'Route not found',
        path: req.originalUrl 
    });
});

// Start the server
const port = process.env.PORT || 5001;
app.listen(port, () => {
    console.log(`🚀 Health App Backend API listening at http://localhost:${port}`);
    console.log(`📱 Health check: http://localhost:${port}/api/health`);
    
    // Environment validation
    const requiredEnvVars = ['INFERMEDICA_APP_ID', 'INFERMEDICA_APP_KEY', 'GEMINI_API_KEY'];
    const missingVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missingVars.length > 0) {
        console.warn(`⚠️  Missing environment variables: ${missingVars.join(', ')}`);
        console.warn('⚠️  Some features may not work correctly. Check your .env file.');
    } else {
        console.log('✅ All required environment variables are set');
    }
});

export default app;
