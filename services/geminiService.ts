
import { GoogleGenAI } from "@google/genai";

// Initialize Gemini with the API key from environment variables.
// Always use a named parameter and assume the key is present as per guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateWhatsAppMessage = async (memberName: string, expiryDate: string, type: 'REMINDER' | 'WELCOME' | 'OFFER') => {
  try {
    const prompt = `
      Act as a professional and friendly gym manager.
      Write a short, engaging WhatsApp message for a member named "${memberName}".
      
      Context:
      ${type === 'REMINDER' ? `Their membership expires on ${new Date(expiryDate).toLocaleDateString()}. Remind them to renew.` : ''}
      ${type === 'WELCOME' ? `They just joined! Welcome them to the gym family.` : ''}
      ${type === 'OFFER' ? `Offer them a 10% discount if they renew within 24 hours.` : ''}
      
      Requirements:
      - Include emojis.
      - Keep it under 50 words.
      - Don't include subject lines or quotes.
    `;

    // Use gemini-3-flash-preview for basic text tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Extract text output using the .text property.
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Hey! Just a reminder about your gym membership. See you soon! 💪";
  }
};

export const getAIWorkoutTip = async (duration: number) => {
  try {
    // Use gemini-3-flash-preview for basic text tasks.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Give me one single, powerful, and scientific workout tip for someone who has been working out for ${duration} days. Keep it short (max 1 sentence).`,
    });
    // Extract text output using the .text property.
    return response.text;
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Consistency is key to progress.";
  }
};
