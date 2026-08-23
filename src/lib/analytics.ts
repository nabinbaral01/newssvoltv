import { DeviceType } from '@prisma/client';
import crypto from 'node:crypto';
import { UAParser } from 'ua-parser-js';

/**
 * Server-side enrichment for the first-party beacon.
 *
 * Two rules run through everything here:
 *   1. Raw IP addresses are never persisted. They are salted-hashed on arrival
 *      and the plaintext is dropped before the row is written.
 *   2. Rotating ANALYTICS_SALT anonymises the whole history, which is the
 *      cheapest possible "delete my identifiers" lever.
 */
const SALT = process.env.ANALYTICS_SALT ?? 'volt-dev-salt';

export const VISITOR_COOKIE = 'volt_vid';
export const SESSION_COOKIE = 'volt_sid';
export const SESSION_TTL_MINUTES = 30;

export function hash(value: string): string {
  return crypto.createHmac('sha256', SALT).update(value).digest('hex').slice(0, 32);
}

/** Client IP from the usual proxy headers. Used only to derive a hash. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') ?? headers.get('cf-connecting-ip') ?? '0.0.0.0';
}

export type GeoInfo = {
  country: string | null;
  region: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};

/**
 * Geo comes from the edge platform's headers where they exist (Vercel,
 * Cloudflare, Fly all set these). Self-hosting? Point GEOIP_LOOKUP_URL at a
 * MaxMind GeoLite2 sidecar, or fill these headers in at your proxy.
 */
export function geoFromHeaders(headers: Headers): GeoInfo {
  const decode = (value: string | null) => {
    if (!value) return null;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const lat = headers.get('x-vercel-ip-latitude') ?? headers.get('cf-iplatitude');
  const lon = headers.get('x-vercel-ip-longitude') ?? headers.get('cf-iplongitude');

  return {
    country:
      headers.get('x-vercel-ip-country') ??
      headers.get('cf-ipcountry') ??
      headers.get('x-geo-country') ??
      null,
    region:
      decode(headers.get('x-vercel-ip-country-region')) ??
      decode(headers.get('x-geo-region')) ??
      null,
    city: decode(headers.get('x-vercel-ip-city')) ?? decode(headers.get('x-geo-city')) ?? null,
    latitude: lat ? Number(lat) : null,
    longitude: lon ? Number(lon) : null,
  };
}

export type ClientInfo = {
  deviceType: DeviceType;
  browser: string | null;
  os: string | null;
};

export function parseUserAgent(ua: string | null): ClientInfo {
  if (!ua) return { deviceType: DeviceType.UNKNOWN, browser: null, os: null };

  const parsed = UAParser(ua);
  const type = parsed.device.type;
  const deviceType =
    type === 'mobile'
      ? DeviceType.MOBILE
      : type === 'tablet'
        ? DeviceType.TABLET
        : /bot|crawler|spider|crawling|headless/i.test(ua)
          ? DeviceType.BOT
          : DeviceType.DESKTOP;

  return {
    deviceType,
    browser: parsed.browser.name ?? null,
    os: parsed.os.name ?? null,
  };
}

/** Coarse acquisition channel, derived from the referrer host. */
export function classifySource(referrer: string | null, utmMedium?: string | null): string {
  if (utmMedium) {
    const medium = utmMedium.toLowerCase();
    if (['cpc', 'ppc', 'paid', 'display'].includes(medium)) return 'paid';
    if (['email', 'newsletter'].includes(medium)) return 'email';
    if (['social', 'social-network'].includes(medium)) return 'social';
  }
  if (!referrer) return 'direct';

  let host: string;
  try {
    host = new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return 'direct';
  }

  if (/google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\.|brave\.|yandex\./.test(host)) return 'organic';
  if (/reddit\.|t\.co|twitter\.|x\.com|facebook\.|instagram\.|tiktok\.|bsky\.|threads\.|linkedin\.|youtube\.|news\.ycombinator/.test(host)) {
    return 'social';
  }
  return 'referral';
}

export function referrerHost(referrer: string | null): string | null {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Age buckets used by every demographic view. Shared so they cannot drift. */
export const AGE_BUCKETS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

export function ageBucket(birthYear: number | null | undefined, at = new Date()): AgeBucket | null {
  if (!birthYear) return null;
  const age = at.getUTCFullYear() - birthYear;
  if (age < 13 || age > 120) return null;
  if (age <= 17) return '13-17';
  if (age <= 24) return '18-24';
  if (age <= 34) return '25-34';
  if (age <= 44) return '35-44';
  if (age <= 54) return '45-54';
  if (age <= 64) return '55-64';
  return '65+';
}

export const GENDER_LABELS: Record<string, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  NON_BINARY: 'Non-binary',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};
