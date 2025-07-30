import express from "express";
import axios from "axios";

const router = express.Router();

router.post("/gemini", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY; // Load from environment variables
    
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured" });
    }
    
    const prompt = req.body.prompt;

    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }]
      },
      {
        headers: {
          "Content-Type": "application/json"
        }
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error("Gemini API error:", error?.response?.data || error.message || error);
    res.status(500).json({ error: error?.response?.data || error.message || "Unknown error" });
  }
});

export default router;