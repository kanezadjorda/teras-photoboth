export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const token = req.query.token || req.query.id;
  if (!token) {
    return res.status(400).json({ error: 'Parameter token diperlukan' });
  }

  const cleanToken = String(token).replace(/[^a-zA-Z0-9_-]/g, '');
  const r2Base = process.env.R2_PUBLIC_URL || 'https://pub-f2c72d0cfc074ddf87a90bc99aec28ed.r2.dev';
  const targetUrl = `${r2Base.replace(/\/+$/, '')}/sessions/${cleanToken}/meta.json`;

  try {
    const response = await fetch(targetUrl, { cache: 'no-store' });
    if (!response.ok) {
      return res.status(response.status).json({
        error: 'Sesi belum ditemukan atau foto masih dalam antrean upload',
        status: response.status
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (err) {
    console.error('[Vercel API meta] Fetch error:', err);
    return res.status(500).json({ error: 'Gagal mengambil metadata: ' + err.message });
  }
}
