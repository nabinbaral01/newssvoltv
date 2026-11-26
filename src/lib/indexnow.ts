import { SITE_URL } from './site';

/**
 * IndexNow: tells Bing (and through it Yahoo, DuckDuckGo and ChatGPT search),
 * Yandex, Naver and Seznam that a URL changed, the moment it changes, instead
 * of waiting for their next crawl. One POST to api.indexnow.org reaches every
 * participating engine. Google does not take part; it reads the sitemaps.
 *
 * The key is not a secret. The protocol proves ownership by requiring the same
 * key to be served from the site itself, at public/<key>.txt.
 */
export const INDEXNOW_KEY = '72eb56d7f136ac87e568bc1e0eaca161';

/** Only the real site pings. Local and preview builds would submit URLs that do not exist. */
function enabled(): boolean {
  if (process.env.INDEXNOW_DISABLED === 'true') return false;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') return false;
  return /^https:\/\//.test(SITE_URL) && !/localhost|127\.0\.0\.1/.test(SITE_URL);
}

/**
 * Never throws: a search-engine outage must not turn a publish into an error.
 * Callers run it inside after(), so the editor is not kept waiting either.
 */
export async function notifyIndexNow(paths: string[]): Promise<void> {
  if (!enabled() || !paths.length) return;

  const host = new URL(SITE_URL).host;
  const urlList = [...new Set(paths)].map((p) => `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`);

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
        urlList: urlList.slice(0, 10_000),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    // 200 and 202 both mean accepted; anything else is logged, not raised.
    if (res.status !== 200 && res.status !== 202) {
      console.warn(`[indexnow] ${res.status} for ${urlList.length} URL(s)`);
    }
  } catch (error) {
    console.warn('[indexnow] ping failed:', error instanceof Error ? error.message : error);
  }
}
