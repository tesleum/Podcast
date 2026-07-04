const { GoogleGenAI } = require("@google/genai");
require('dotenv/config');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
  try {
    const interaction = await ai.interactions.create({
      model: "gemini-3.1-flash-tts-preview",
      input: "Say the following Persian text naturally and normally:\n\nسلام",
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [
          { speaker: "Speaker", voice: "Aoede" }
        ]
      }
    });
    console.log("Success, data length:", interaction.output_audio?.data?.length);
  } catch (e) {
    console.error("Error:");
    console.error(e);
  }
}
run();
