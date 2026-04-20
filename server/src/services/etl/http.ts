// ============================================================
// HTTP helper para collectors
// - User-Agent sensato
// - Timeout configurable
// - 1 retry suave en errores de red
// ============================================================

const UA = 'Mozilla/5.0 (compatible; PointAndinaIntranetBot/1.0; +https://pointandina.pe)';

export interface FetchOptions {
  timeout?: number;        // ms, default 20000
  accept?: string;
  retries?: number;        // default 1
}

export async function fetchWithRetry(url: string, opts: FetchOptions = {}): Promise<Response> {
  const timeout = opts.timeout || 20000;
  const accept = opts.accept || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8';
  const maxRetries = opts.retries ?? 1;

  let lastErr: any = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': UA,
          Accept: accept,
          'Accept-Language': 'es-PE,es;q=0.9,en;q=0.8',
        },
        signal: controller.signal,
      });
      clearTimeout(t);
      if (!res.ok && res.status >= 500 && attempt < maxRetries) {
        // retry server errors
        lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
        await sleep(800 * (attempt + 1));
        continue;
      }
      return res;
    } catch (err: any) {
      clearTimeout(t);
      lastErr = err;
      if (attempt < maxRetries) {
        await sleep(800 * (attempt + 1));
        continue;
      }
      throw err;
    }
  }
  throw lastErr || new Error('fetchWithRetry: unknown error');
}

export async function fetchText(url: string, opts?: FetchOptions): Promise<string> {
  const res = await fetchWithRetry(url, opts);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} -> ${url}`);
  return await res.text();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
