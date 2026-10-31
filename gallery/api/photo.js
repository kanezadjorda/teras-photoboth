export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const key = req.query.key;
  if (!key) {
    return res.status(400).send('Parameter key diperlukan');
  }

  const cleanKey = String(key).replace(/^\/+/, '');
  const r2Base = process.env.R2_PUBLIC_URL || 'https://pub-f2c72d0cfc074ddf87a90bc99aec28ed.r2.dev';
  const targetUrl = `${r2Base.replace(/\/+$/, '')}/${cleanKey}`;

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) {
      return res.status(response.status).send('File foto tidak ditemukan di R2');
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');

    if (req.query.download === '1') {
      const filename = cleanKey.split('/').pop() || 'photo.jpg';
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return res.status(200).send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[Vercel API photo] Fetch error:', err);
    return res.status(500).send('Gagal mengunduh foto: ' + err.message);
  }
}
