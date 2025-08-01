import express, { Request, Response } from "express";
import axios from "axios";

const router = express.Router();

// Get Infermedica configuration from environment variables
const INFERMEDICA_APP_ID = process.env.INFERMEDICA_APP_ID;
const INFERMEDICA_APP_KEY = process.env.INFERMEDICA_APP_KEY;
const INFERMEDICA_BASE_URL = process.env.INFERMEDICA_BASE_URL || 'https://api.infermedica.com/v3';

// Validation for required credentials
if (!INFERMEDICA_APP_ID || !INFERMEDICA_APP_KEY) {
  console.error('ERROR: Infermedica API credentials (APP_ID, APP_KEY) are missing in .env');
}

// Helper function to create Infermedica headers
const getInfermedicaHeaders = (interviewId?: string) => {
  const idToUse = interviewId || "68f38d1c-674a-4e41-877e-f3a491691d46";

  return {
    'App-Id': INFERMEDICA_APP_ID,
    'App-Key': INFERMEDICA_APP_KEY,
    'Content-Type': 'application/json',
    'Interview-Id': idToUse,
    'Dev-Mode': 'true' // Recommended for development/testing
  } as Record<string, string>;
};

// 1. Infermedica /search endpoint
router.get('/search', async (req: Request, res: Response) => {
  try {
    const clientQueryParams = req.query;
    const { interviewId, ...infermedicaQueryParams } = clientQueryParams;

    // Basic validation for required 'phrase'
    if (!infermedicaQueryParams.phrase) {
      return res.status(400).json({ error: 'Phrase is required for search.' });
    }

    // Make the GET request to Infermedica API
    const response = await axios.get(`${INFERMEDICA_BASE_URL}/search`, {
      headers: getInfermedicaHeaders(interviewId as string),
      params: infermedicaQueryParams
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /search:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 2. Infermedica /parse endpoint
router.post("/parse", async (req: Request, res: Response) => {
  try {
    const { text, 'age.value': ageValue, 'age.unit': ageUnit, sex, context, include_tokens, correct_spelling, concept_types, interviewId } = req.body;

    console.log("Received Parse Request:", {
      text,
      ageValue,
      ageUnit,
      sex,
    });

    if (!text || !ageValue || !ageUnit ) {
      return res.status(400).json({ error: 'Text, age, and content are required for parsing.' });
    }

    // Transform the request to match Infermedica API expectations
    const infermedicaPayload = {
      text,
      age: {
        value: ageValue,
        unit: ageUnit
      },
      sex,
      context: context || [],
      include_tokens: include_tokens || false,
      correct_spelling: correct_spelling !== false, // default to true
      concept_types: concept_types || ["symptom", "risk_factor"]
    };

    console.log("Sending to Infermedica:", infermedicaPayload);

    const response = await axios.post(
      `${INFERMEDICA_BASE_URL}/parse`,
      infermedicaPayload,
      {
        headers: getInfermedicaHeaders(interviewId as string)
      }
    );

    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /parse:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 3. Infermedica /diagnosis endpoint
router.post('/diagnosis', async (req: Request, res: Response) => {
  try {
    const { sex, age, evidence, extras, evaluated_at, interviewId } = req.body;

    console.log("Received Diagnosis Request:", {
      sex,
      age,
      evidenceCount: evidence?.length,
      initialEvidenceCount: evidence?.filter((e: any) => e.source === "initial").length || 0,
      dynamicEvidenceCount: evidence?.filter((e: any) => !e.source).length || 0,
      extras,
      evaluated_at
    });

    if (!sex || !age || !evidence) {
      return res.status(400).json({ error: 'Sex, age, and evidence are required for diagnosis.' });
    }

    // Prepare the payload for Infermedica
    const diagnosisPayload = {
      sex,
      age,
      evidence,
      ...(extras && { extras }),
      ...(evaluated_at && { evaluated_at })
    };

    console.log("Sending to Infermedica Diagnosis API:", diagnosisPayload);
    console.log("Evidence items with source field:", JSON.stringify(evidence.map((e: any) => ({ id: e.id, choice_id: e.choice_id, source: e.source })), null, 2));

    const response = await axios.post(`${INFERMEDICA_BASE_URL}/diagnosis`, 
      diagnosisPayload, 
      {
        headers: getInfermedicaHeaders(interviewId as string)
      }
    );

    console.log("Infermedica Diagnosis Response received");
    console.log("Response Data:", response.data);

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

// 4. Infermedica /symptoms endpoint
router.get('/symptoms', async (req: Request, res: Response) => {
  try {
    const clientQueryParams = req.query;
    const { interviewId, "age.value": ageValue, "age.unit": ageUnit, ...infermedicaQueryParams } = clientQueryParams;

    if (!ageValue || !ageUnit) {
      return res.status(400).json({ error: 'Age is required for symptoms.' });
    }

    const response = await axios.get(`${INFERMEDICA_BASE_URL}/symptoms`, {
      headers: getInfermedicaHeaders(interviewId as string),
      params: clientQueryParams
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /symptoms:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 5. Infermedica /Triage endpoint
router.post('/triage', async (req: Request, res: Response) => {
  try {
    const { age, sex, symptoms, interviewId } = req.body;

    console.log("Received Triage Request:", {
      age,
      sex,
      symptomsCount: symptoms?.length || 0
    });

    if (!age || !sex || !symptoms) {
      return res.status(400).json({ error: 'Age, sex, and symptoms are required for triage.' });
    }

    // Prepare the payload for Infermedica
    const triagePayload = {
      age,
      sex,
      symptoms,
      extras: {
          enable_explanations: true,
          enable_evidence_details: true,
          enable_conditions_details: true,
          enable_triage_advanced_mode: true,
          include_condition_ranking: true,
          enable_symptom_duration: true,
          enable_red_flags: true,
          enable_prevalence: true,
          enable_severity: true
      }
    };

    console.log("Sending to Infermedica Triage API:", triagePayload);
    
    const response = await axios.post(`${INFERMEDICA_BASE_URL}/triage`, 
      triagePayload,
      {
        headers: getInfermedicaHeaders(interviewId as string)
      }
    );

    console.log("Infermedica Triage Response received");
    console.log("Response Data:", response.data);

    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /triage:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 6. Infermedica /explain endpoint
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { age, sex, evidence, condition_id, interviewId } = req.body;

    console.log("Received Explain Request:", {
      age,
      sex,
      evidenceCount: evidence?.length || 0,
      targetCondition: condition_id
    });

    if (!age || !sex || !evidence || !condition_id) {
      return res.status(400).json({ error: 'Age, sex, evidence, and condition_id are required for explanation.' });
    }

    const explainPayload = {
      sex,
      age,
      evidence,
      target: condition_id
    };

    console.log("Sending to Infermedica Explain API:", explainPayload);

    const response = await axios.post(
      `${INFERMEDICA_BASE_URL}/explain`,
      explainPayload,
      {
        headers: getInfermedicaHeaders(interviewId as string)
      }
    );

    console.log("Infermedica Explain Response received");
    console.log("Response Data:", response.data);

    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /explain:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


export default router;
