import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import 'dotenv/config';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API route for TTS
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voice = 'Aoede', isMultiSpeaker = false, speakers = [] } = req.body;

      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }

      if (isMultiSpeaker) {
        const promptText = `Speak this exact Persian conversation naturally and with perfect native Iranian pronunciation and accent:\n\n${text}`;
        try {
          const interaction = await (ai as any).interactions.create({
            model: "gemini-3.1-flash-tts-preview",
            input: promptText,
            response_modalities: ['audio'],
            generation_config: {
              speech_config: speakers
            }
          });
          
          const base64Audio = interaction.output_audio?.data;
          if (base64Audio) {
            res.json({ audio: base64Audio });
          } else {
            res.status(500).json({ error: "Failed to generate multi-speaker audio" });
          }
        } catch (e: any) {
          if (e.status === 429 || (e.message && e.message.includes('429'))) {
            return res.status(429).json({ error: "سهمیه تولید صدای شما برای امروز به پایان رسیده است. لطفاً فردا دوباره تلاش کنید یا ارتقا دهید." });
          }
          throw e;
        }
      } else {
        const promptText = `Speak this exact Persian text naturally and with perfect native Iranian pronunciation and accent:\n\n${text}`;
        
        try {
          const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-tts-preview",
            contents: [{ parts: [{ text: promptText }] }],
            config: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: voice },
                },
              },
            },
          });

          const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
          
          if (base64Audio) {
            res.json({ audio: base64Audio });
          } else {
            res.status(500).json({ error: "Failed to generate audio" });
          }
        } catch (e: any) {
          if (e.status === 429 || (e.message && e.message.includes('429'))) {
            return res.status(429).json({ error: "سهمیه تولید صدای شما برای امروز به پایان رسیده است. لطفاً فردا دوباره تلاش کنید یا ارتقا دهید." });
          }
          throw e;
        }
      }
    } catch (error: any) {
      console.error("TTS generation error:", error);
      if (error.status === 429 || (error.message && error.message.includes('429'))) {
        res.status(429).json({ error: "سهمیه تولید صدای شما برای امروز به پایان رسیده است. لطفاً فردا دوباره تلاش کنید یا اکانت خود را ارتقا دهید." });
      } else {
        res.status(500).json({ error: "خطا در تولید صدا. لطفاً دوباره تلاش کنید." });
      }
    }
  });

  // API route for rewrite
  app.post("/api/rewrite", async (req, res) => {
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
      res.json({ text: rewrittenText });
    } catch (error) {
      console.error("Rewrite error:", error);
      res.status(500).json({ error: "An error occurred during text rewrite" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
