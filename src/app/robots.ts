import type { MetadataRoute } from 'next';

import { SITE_URL } from '@/lib/site';

/** Account, admin and draft surfaces: nothing a search result should land on. */
const PRIVATE = [
  '/admin',
  '/api/',
  '/account',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/preview',
];

/**
 * AI *search* crawlers are named explicitly so a later blanket rule cannot
 * silently drop the site from ChatGPT, Claude or Perplexity answers. They are
 * the bots that decide whether a story can be cited there; the training-only
 * crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot) fall under `*` and are
 * a separate business decision.
 */
const AI_SEARCH_BOTS = ['OAI-SearchBot', 'ChatGPT-User', 'Claude-SearchBot', 'Claude-User', 'PerplexityBot'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: PRIVATE },
      { userAgent: AI_SEARCH_BOTS, allow: '/', disallow: PRIVATE },
    ],
    sitemap: [`${SITE_URL}/sitemap.xml`, `${SITE_URL}/news-sitemap.xml`],
  };
}
