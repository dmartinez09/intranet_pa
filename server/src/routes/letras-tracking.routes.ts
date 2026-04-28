import { Router } from 'express';
import { getDbPool, sql } from '../config/database';

/**
 * Tracking pixel público para emails de letras.
 * Endpoint PÚBLICO (sin auth) — debe ser llamado por clientes de email
 * cuando renderizan la imagen 1x1 embebida.
 *
 * Token formato: base64url(JSON({h:historyId,r:recipient,role:to|cc}))
 */

const router = Router();

// 1x1 transparent GIF (43 bytes)
const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

function decodeToken(token: string): { h: number; r: string; role: string } | null {
  try {
    const cleaned = token.replace(/\.gif$/, '');
    const json = Buffer.from(cleaned, 'base64url').toString('utf-8');
    const obj = JSON.parse(json);
    if (typeof obj.h !== 'number' || typeof obj.r !== 'string') return null;
    return obj;
  } catch { return null; }
}

/** Detecta proxies de email (Gmail/Outlook) que pre-cargan imágenes. */
function detectProxy(ua: string | undefined, ip: string): boolean {
  if (!ua) return false;
  const u = ua.toLowerCase();
  return (
    u.includes('googleimageproxy') ||
    u.includes('ggpht') ||
    u.includes('outlook') && u.includes('safelinks') ||
    u.includes('mimecast') ||
    /^66\.249\./.test(ip)   // Google IP range
  );
}

router.get('/letras/:token', async (req, res) => {
  // Siempre devolver el pixel (incluso ante errores) para no romper email clients
  const sendPixel = () => {
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.status(200).send(PIXEL_GIF);
  };

  try {
    const tokenRaw = String(req.params.token || '');
    const tok = decodeToken(tokenRaw);
    if (!tok) { sendPixel(); return; }

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            || req.socket.remoteAddress
            || '';
    const ua = req.headers['user-agent'] || '';
    const proxied = detectProxy(ua as string, ip);

    const pool = await getDbPool();
    await pool.request()
      .input('h', sql.BigInt, tok.h)
      .input('r', sql.NVarChar(320), tok.r)
      .input('rl', sql.VarChar(10), tok.role || 'to')
      .input('ip', sql.NVarChar(64), ip.substring(0, 64))
      .input('ua', sql.NVarChar(500), String(ua).substring(0, 500))
      .input('px', sql.Bit, proxied ? 1 : 0)
      .query(`
        INSERT INTO dbo.intranet_letras_email_opens
          (history_id, recipient, recipient_role, ip_address, user_agent, is_proxied)
        VALUES (@h, @r, @rl, @ip, @ua, @px);
      `);
    console.log(`[letras-tracking] open: history=${tok.h} recipient=${tok.r} proxy=${proxied}`);
  } catch (err: any) {
    console.error('[letras-tracking] error:', err?.message || err);
  }

  sendPixel();
});

export default router;
