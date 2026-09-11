const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const apiKey = process.env.AI_API_KEY;
if (!apiKey) {
  console.warn('WARNING: AI_API_KEY environment variable is missing.');
}

const ai = new GoogleGenAI({ apiKey: apiKey || 'DUMMY_KEY' });

/**
 * Generate a response from Gemini model using full context history.
 * @param {Array} historyMessages - Database rows of past messages [{sender: 'user'|'assistant', content: '...'}]
 * @param {string} userMessage - Latest incoming user message
 * @returns {Promise<string>} Generated response string
 */
async function generateChatResponse(historyMessages, userMessage) {
  try {
    const modelName = process.env.AI_MODEL || 'gemini-2.5-flash';
    const systemInstruction = process.env.SYSTEM_PROMPT || 'You are a helpful AI assistant.';

    // Format historical messages into GoogleGenAI contents structure
    const contents = [];

    for (const msg of historyMessages) {
      contents.push({
        role: msg.sender === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      });
    }

    // Append the new incoming user prompt
    contents.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const response = await ai.models.generateContent({
      model: modelName,
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        maxOutputTokens: 2048
      }
    });

    if (response && response.text) {
      return response.text;
    }

    throw new Error('Received an empty response from AI model.');
  } catch (error) {
    console.error('Error generating AI response:', error.message || error);
    throw new Error('AI service error: Unable to process request at this time.');
  }
}

module.exports = {
  generateChatResponse
};
