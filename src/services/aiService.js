/**
 * Service to handle AI interactions using Gemini API
 */
class AIService {
    constructor() {
        this.apiKey = localStorage.getItem('GEMINI_API_KEY') || '';
    }

    setApiKey(key) {
        this.apiKey = key;
        localStorage.setItem('GEMINI_API_KEY', key);
    }

    getApiKey() {
        return this.apiKey;
    }

    /**
     * Queries Gemini to translate natural language into BIM model filters or actions
     * @param {string} prompt User's natural language question
     * @param {Array} propertyNames List of available properties in the model for context
     */
    async queryModel(prompt, propertyNames) {
        if (!this.apiKey) throw new Error('Gemini API Key is missing. Please provide it in the settings.');

        const systemPrompt = `
You are a BIM Specialist AI assistant for an Analytical Hub.
Your task is to translate natural language queries into filter conditions for a 3D model.

Available BIM Properties in this model:
${propertyNames.join(', ')}

Users will ask things like:
- "Show me all steel columns"
- "Highlight high-cost items"
- "Find Revit Category: Walls"

You must respond ONLY with a JSON object in this format:
{
    "explanation": "Brief explanation of what I found",
    "filters": [
        { "attribute": "Category", "operator": "equals", "value": "Walls" }
    ],
    "logicalOperator": "AND"
}

Operator options: "equals", "contains", "not_equals".
If you can't satisfy the request with the available properties, return an empty filters array and explain why.
`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: systemPrompt + "\n\nUser Query: " + prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        topP: 0.8,
                        topK: 40,
                        maxOutputTokens: 1000,
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Failed to call Gemini API');
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!textResponse) throw new Error('Empty response from AI');

            return JSON.parse(textResponse);
        } catch (error) {
            console.error('[AIService] Query failed:', error);
            throw error;
        }
    }

    /**
     * Debug method to list available models for the API key
     */
    async getAvailableModels() {
        if (!this.apiKey) return [];
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${this.apiKey}`);
            if (!response.ok) return [];
            const data = await response.json();
            return data.models?.map(m => m.name.replace('models/', '')) || [];
        } catch (e) {
            console.error('Failed to list models:', e);
            return [];
        }
    }
}

export const aiService = new AIService();
export default aiService;
