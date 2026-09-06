const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'adiloxyt21@gmail.com';
const SITE_ORIGIN = (process.env.SITE_ORIGIN || '').replace(/\/$/, '');
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const rateMap = globalThis.__m4qriRateMap || new Map();
globalThis.__m4qriRateMap = rateMap;

function clean(value, max) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(value) && value.length <= 254;
}
function clientIp(req) {
  return String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
}
function rateAllowed(ip) {
  const now = Date.now();
  const current = rateMap.get(ip);
  if (!current || now - current.start >= RATE_WINDOW_MS) {
    rateMap.set(ip, { start: now, count: 1 });
    return true;
  }
  current.count += 1;
  return current.count <= RATE_MAX;
}
function validOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  if (SITE_ORIGIN) return origin === SITE_ORIGIN;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ success: false });
  }
  if (!validOrigin(req)) return res.status(403).json({ success: false });
  if (!rateAllowed(clientIp(req))) return res.status(429).json({ success: false });

  const rawSize = Buffer.byteLength(JSON.stringify(req.body || {}));
  if (rawSize > 16 * 1024) return res.status(413).json({ success: false });

  const body = req.body || {};
  const honey = clean(body._honey, 200);
  if (honey) return res.status(200).json({ success: true });

  const name = clean(body.Name, 80);
  const email = clean(body.Email, 254);
  const company = clean(body.Company, 120) || 'Not provided';
  const budget = clean(body.Budget, 40) || 'Not selected';
  const details = clean(body['Project Details'], 3000);
  const started = Number(body._started || 0);
  const budgets = new Set(['< 10k MAD', '10–25k MAD', '25–60k MAD', '60k+ MAD', 'Not selected']);
  const filledTooFast = Number.isFinite(started) && started > 0 && Date.now() - started < 1500;

  if (name.length < 2 || !validEmail(email) || details.length < 20 || !budgets.has(budget) || filledTooFast) {
    return res.status(400).json({ success: false });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const upstream = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(CONTACT_EMAIL)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: `NEW BOOK A CALL — ${name.replace(/[\r\n]/g, ' ')}`,
        _template: 'box',
        _replyto: email,
        Name: name,
        Email: email,
        Company: company,
        Budget: budget,
        'Project Details': details
      }),
      signal: controller.signal
    });
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.success === false) return res.status(502).json({ success: false });
    return res.status(200).json({ success: true });
  } catch {
    return res.status(502).json({ success: false });
  } finally {
    clearTimeout(timeout);
  }
      }
    
