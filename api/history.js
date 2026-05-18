export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Missing start or end date parameters' });
  }

  try {
    const url = `https://api.frankfurter.app/${start}..${end}?from=USD&to=BRL,EUR`;
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ error: `Frankfurter API Error: ${response.status}`, details: errorData });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('History proxy error:', err);
    return res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
}
