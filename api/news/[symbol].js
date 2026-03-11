const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol) return res.status(400).json({ error: 'Missing symbol' });

  const ak = req.headers['apca-api-key-id'];
  const as = req.headers['apca-api-secret-key'];
  if (!ak || !as) return res.status(401).json({ error: 'Missing Alpaca API headers' });

  const limit = req.query.limit || '5';
  const url = `https://data.alpaca.markets/v1beta1/news?symbols=${encodeURIComponent(symbol)}&limit=${limit}&sort=desc`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { 'APCA-API-KEY-ID': ak, 'APCA-API-SECRET-KEY': as }
    });
    clearTimeout(timer);
    if (!r.ok) return res.status(r.status).json({ error: `Alpaca returned ${r.status}` });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    return res.status(200).json(data);
  } catch (e) {
    clearTimeout(timer);
    return res.status(502).json({ error: e.name === 'AbortError' ? 'Timeout' : e.message });
  }
};
