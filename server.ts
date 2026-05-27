/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Increase JSON payload limits to support base64 loaded photos
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is missing. Please add it to Settings > Secrets.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// 1. Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Word Dictation Backend is running." });
});

// 2. OCR Endpoint: Extract words from a base64 photo
app.post("/api/ocr-words", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      res.status(400).json({ error: "Missing image payload." });
      return;
    }

    const ai = getGeminiClient();

    // Parse base64
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    let mimeType = "image/jpeg";
    let base64Data = image;

    if (matches && matches.length === 3) {
      mimeType = matches[1];
      base64Data = matches[2];
    }

    const imagePart = {
      inlineData: {
        mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: `You are an OCR and English learning assistant. 
Review the attached image and extract all written or printed English vocabulary words or sentences.
Extract individual English study words. For each English word you find, provide:
- The standard English spelling.
- A concise Chinese translation (or inferred meaning from English context if visible).

Return ONLY raw JSON according to the schema. Do not include markdown tags. Limit the extraction up to 30 core study words.`,
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  english: { type: Type.STRING, description: "The English word (e.g. apple)" },
                  chinese: { type: Type.STRING, description: "Chinese meaning (e.g. 苹果)" },
                },
                required: ["english", "chinese"],
              },
            },
          },
          required: ["words"],
        },
      },
    });

    const textResult = response.text || "{}";
    res.json(JSON.parse(textResult));
  } catch (error: any) {
    console.error("OCR API error:", error);
    res.status(500).json({ error: error.message || "Failed to process image OCR" });
  }
});

// 3. Detail Generation Endpoint: For a list of word strings or object
app.post("/api/generate-details", async (req, res) => {
  try {
    const { words } = req.body; // Array of { english: string, chinese?: string }
    if (!words || !Array.isArray(words) || words.length === 0) {
      res.status(400).json({ error: "Missing or invalid words array." });
      return;
    }

    const ai = getGeminiClient();

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `You are a professional dictionary backend and English educator.
For each of the given English words, generate:
1. IPA phonetic symbols (音标, e.g. /ɪɡˈzæmpəl/ or /ˈæpəl/ enclosed in slashes or brackets).
2. Clean, accurate Chinese meaning (e.g. "n. 苹果; v. 珍视"). If a chinese meaning was provided in input list, keep or refine it.
3. An interesting, educational, and high-quality English example sentence containing that word in action.
4. The natural Chinese translation of that example sentence.

List of words to translate:
${JSON.stringify(words)}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            words: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  english: { type: Type.STRING, description: "The original English word" },
                  phonetic: { type: Type.STRING, description: "IPA phonetic symbols" },
                  chinese: { type: Type.STRING, description: "Concise Chinese meaning" },
                  sentence: { type: Type.STRING, description: "Practical example sentence in English" },
                  sentenceTranslation: { type: Type.STRING, description: "The Chinese translation of the sentence" },
                },
                required: ["english", "phonetic", "chinese", "sentence", "sentenceTranslation"],
              },
            },
          },
          required: ["words"],
        },
      },
    });

    const textResult = response.text || "{}";
    res.json(JSON.parse(textResult));
  } catch (error: any) {
    console.error("Detail API error:", error);
    res.status(500).json({ error: error.message || "Failed to generate word details" });
  }
});

async function start() {
  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Word dictation app running on http://localhost:${PORT}`);
  });
}

start();
