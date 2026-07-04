import { GoogleGenAI } from "@google/genai";
import 'dotenv/config';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const interaction = await ai.interactions.create({
      model: "gemini-3.1-flash-tts-preview",
      input: "Say the following Persian text naturally and normally:\n\nسلام",
      responseFormat: { type: 'audio' },
      generationConfig: {
        speechConfig: [
          { speaker: "Voice 1", voice: "Aoede" }
        ]
      }
    });
    console.log("Success, data length:", interaction.outputAudio?.data?.length || interaction.output_audio?.data?.length);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
