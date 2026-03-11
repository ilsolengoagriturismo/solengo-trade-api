const fetch = require('node-fetch');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const feedUrl = req.query.url;
  if (!feedUrl) return res.status(400).json({ error: 'Missing url parameter' });

  const rss2jsonUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);

  try {
    const r = await fetch(rss2jsonUrl, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!r.ok) return res.status(r.status).json({ error: `RSS proxy returned ${r.status}` });
    const data = await r.json();
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(data);
  } catch (e) {
    clearTimeout(timer);
    return res.status(502).json({ error: e.name === 'AbortError' ? 'Timeout' : e.message });
  }
};
