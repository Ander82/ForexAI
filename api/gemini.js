// Vercel Serverless Function - Proxy seguro para Gemini API
// A API key fica nas Environment Variables do Vercel, NUNCA exposta ao browser

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.GEMINI_API_KEY;

  if (!API_KEY) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured on server' });
  }

  try {
    const { prompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2 }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ error: `Gemini API Error: ${response.status}`, details: errorData });
    }

    const data = await response.json();

    // Extract text from response (Gemini 2.5 has thinking + text parts)
    const parts = data.candidates[0].content.parts;
    const textPart = parts.filter(p => p.text !== undefined).pop();
    const text = textPart ? textPart.text : parts[0].text;

    return res.status(200).json({ text });
  } catch (err) {
    console.error('Gemini proxy error:', err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
