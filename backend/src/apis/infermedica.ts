import express from "express"
import axios from "axios"

const router = express.Router()

router.post("/parse", async (req, res) => {
  try {
    const infermedicaUrl = "https://api.infermedica.com/v3/parse"
    const response = await axios.post(
      infermedicaUrl,
      req.body,
      {
        headers: {
          "App-Id": "9214ff2e",
          "App-Key": "e0b532d652bcc557a431818961bcae81",
          "Content-Type": "application/json",
        },
      }
    )
    res.json(response.data)
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
})

export default router