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

    // Filter out the 'name' field from evidence items for Infermedica API
    const filteredEvidence = evidence.map((item: any) => ({
      id: item.id,
      choice_id: item.choice_id,
      ...(item.source && { source: item.source }) // Only include source if it exists
    }));

    // Prepare the payload for Infermedica
    const diagnosisPayload = {
      sex,
      age,
      evidence: filteredEvidence,
      ...(extras && { extras }),
      ...(evaluated_at && { evaluated_at })
    };

    console.log("Sending to Infermedica Diagnosis API:", diagnosisPayload);
    console.log("Filtered evidence items:", JSON.stringify(filteredEvidence.map((e: any) => ({ id: e.id, choice_id: e.choice_id, source: e.source })), null, 2));

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

    // Filter out the 'name' field from evidence items for Infermedica API
    const filteredEvidence = evidence.map((item: any) => ({
      id: item.id,
      choice_id: item.choice_id,
      ...(item.source && { source: item.source }) // Only include source if it exists
    }));

    const explainPayload = {
      sex,
      age,
      evidence: filteredEvidence,
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

// 7. Infermedica /triage endpoint
router.post('/triage', async (req: Request, res: Response) => {
  try {
    const { age, sex, evidence, interviewId } = req.body;

    console.log("Received Triage Request:", {
      age,
      sex,
      evidenceCount: evidence?.length || 0
    });

    if (!age || !sex || !evidence) {
      return res.status(400).json({ error: 'Age, sex, and evidence are required for triage.' });
    }

    // Filter out the 'name' field from evidence items for Infermedica API
    const filteredEvidence = evidence.map((item: any) => ({
      id: item.id,
      choice_id: item.choice_id,
      ...(item.source && { source: item.source })
    }));

    const triagePayload = {
      age,
      sex,
      evidence: filteredEvidence,
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

    const response = await axios.post(
      `${INFERMEDICA_BASE_URL}/triage`,
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

// 8. Infermedica /conditions/{id} endpoint - Get condition details
router.get('/conditions/:id', async (req: Request, res: Response) => {
  try {
    const conditionId = req.params.id;
    const { interviewId, age, sex } = req.query;

    console.log("Received Condition Request:", { conditionId, age, sex });

    if (!conditionId) {
      return res.status(400).json({ error: 'Condition ID is required.' });
    }

    // Build query parameters - age and sex are required by Infermedica
    const queryParams: any = {};
    if (age) queryParams['age.value'] = age;
    if (sex) queryParams['sex'] = sex;

    const response = await axios.get(
      `${INFERMEDICA_BASE_URL}/conditions/${conditionId}`,
      {
        headers: getInfermedicaHeaders(interviewId as string),
        params: queryParams
      }
    );

    console.log("Infermedica Condition Response received");
    console.log("Response Data:", response.data);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /conditions:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 9. Infermedica /conditions endpoint - List all conditions
router.get('/conditions', async (req: Request, res: Response) => {
  try {
    const { interviewId, ...queryParams } = req.query;

    console.log("Received Conditions List Request:", { queryParams });

    const response = await axios.get(
      `${INFERMEDICA_BASE_URL}/conditions`,
      {
        headers: getInfermedicaHeaders(interviewId as string),
        params: queryParams
      }
    );

    console.log("Infermedica Conditions List Response received");
    console.log("Response Data:", response.data);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /conditions list:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 10. Infermedica /risk_factors/{id} endpoint - Get risk factor details
router.get('/risk_factors/:id', async (req: Request, res: Response) => {
  try {
    const riskFactorId = req.params.id;
    const { interviewId, age, sex } = req.query;

    console.log("Received Risk Factor Request:", { riskFactorId, age, sex });

    if (!riskFactorId) {
      return res.status(400).json({ error: 'Risk factor ID is required.' });
    }

    // Build query parameters - age and sex are required by Infermedica
    const queryParams: any = {};
    if (age) queryParams['age.value'] = age;
    if (sex) queryParams['sex'] = sex;

    const response = await axios.get(
      `${INFERMEDICA_BASE_URL}/risk_factors/${riskFactorId}`,
      {
        headers: getInfermedicaHeaders(interviewId as string),
        params: queryParams
      }
    );

    console.log("Infermedica Risk Factor Response received");
    console.log("Response Data:", response.data);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /risk_factors:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// 11. Infermedica /risk_factors endpoint - List all risk factors
router.get('/risk_factors', async (req: Request, res: Response) => {
  try {
    const { interviewId, ...queryParams } = req.query;

    console.log("Received Risk Factors List Request:", { queryParams });

    const response = await axios.get(
      `${INFERMEDICA_BASE_URL}/risk_factors`,
      {
        headers: getInfermedicaHeaders(interviewId as string),
        params: queryParams
      }
    );

    console.log("Infermedica Risk Factors List Response received");
    console.log("Response Data:", response.data);
    res.json(response.data);
  } catch (error: any) {
    console.error('Error proxying /risk_factors list:', error.message);
    if (error.response) {
      console.error('Infermedica Error Response:', error.response.data);
      return res.status(error.response.status).json(error.response.data);
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});


export default router;
