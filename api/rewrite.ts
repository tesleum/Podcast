import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, tone = 'informal' } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required" });
    }

    let promptInstructions = "Rewrite the following Persian text to be very natural, conversational, and informal (عامیانه), exactly as if a friendly Iranian presenter is speaking it in a YouTube video. Keep the core meaning, but make it sound spoken, engaging, and less formal.";
    if (tone === 'formal') {
       promptInstructions = "Rewrite the following Persian text to be very formal, professional, and official (رسمی). Keep the core meaning, but make it sound like an official news anchor or corporate presentation.";
    } else if (tone === 'promotional') {
       promptInstructions = "Rewrite the following Persian text to be promotional, enthusiastic, and persuasive (تبلیغاتی). Make it sound like a compelling advertisement or marketing pitch.";
    } else if (tone === 'friendly') {
       promptInstructions = "Rewrite the following Persian text to be warm, friendly, and approachable (دوستانه). Make it sound like talking to a good friend.";
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{
        role: "user",
        parts: [{ text: `${promptInstructions}\n\nText:\n${text}` }]
      }],
    });

    const rewrittenText = response.text;
    res.status(200).json({ text: rewrittenText });
  } catch (error: any) {
    console.error("Rewrite error:", error);
    res.status(500).json({ error: "An error occurred during text rewrite", details: error.message });
  }
}
