
import { GoogleGenAI } from "@google/genai";
import { TableRow } from "../types";

export const analyzeDataWithGemini = async (data: TableRow[]) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    Analyze the following business data records and provide a brief executive summary.
    Identify any potential anomalies in "amount" or "status" and suggest if any approvals look risky.
    Data: ${JSON.stringify(data.map(d => ({ title: d.title, amount: d.amount, status: d.status, region: d.region })))}
    Return the response as a clear, professional summary with bullet points.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return "AI Analysis temporarily unavailable. Please check your network connection.";
  }
};
