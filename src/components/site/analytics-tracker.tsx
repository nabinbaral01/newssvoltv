'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';

import { analyticsAllowed } from '@/lib/consent';

/**
 * First-party page-view beacon.
 *
 * Fires once per route change, then sends a single engagement update (time on
 * page + max scroll depth) when the page is hidden. No third-party script, no
 * cross-site identifier: the server sets a first-party visitor cookie and only
 * ever stores a salted hash of it.
 */
function Beacon({ postId }: { postId?: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewIdRef = React.useRef<string | null>(null);
  // Stamped in the effect, not at render: the clock is not a pure read, and the
  // number we want is "when this route became visible" anyway.
  const startedRef = React.useRef(0);
  const scrollRef = React.useRef(0);
  const sentRef = React.useRef(false);

  const search = searchParams.toString();

  React.useEffect(() => {
    if (!analyticsAllowed()) return;

    viewIdRef.current = null;
    startedRef.current = Date.now();
    scrollRef.current = 0;
    sentRef.current = false;

    const params = new URLSearchParams(search);
    const controller = new AbortController();

    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        type: 'pageview',
        path: pathname,
        postId: postId ?? null,
        referrer: document.referrer || null,
        utmSource: params.get('utm_source'),
        utmMedium: params.get('utm_medium'),
        utmCampaign: params.get('utm_campaign'),
        screenWidth: window.innerWidth,
      }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.id) viewIdRef.current = data.id;
      })
      .catch(() => {
        /* tracking must never break the page */
      });

    const onScroll = () => {
      const doc = document.documentElement;
      const scrollable = doc.scrollHeight - window.innerHeight;
      const depth = scrollable > 0 ? Math.round(((window.scrollY + window.innerHeight) / doc.scrollHeight) * 100) : 100;
      scrollRef.current = Math.min(100, Math.max(scrollRef.current, depth));
    };

    const flush = () => {
      if (sentRef.current || !viewIdRef.current) return;
      sentRef.current = true;
      const payload = JSON.stringify({
        type: 'engagement',
        id: viewIdRef.current,
        seconds: Math.round((Date.now() - startedRef.current) / 1000),
        scroll: scrollRef.current,
      });
      // sendBeacon survives the unload that a fetch would not.
      navigator.sendBeacon?.('/api/track', new Blob([payload], { type: 'application/json' }));
    };

    const onVisibility = () => document.visibilityState === 'hidden' && flush();

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);

    return () => {
      flush();
      controller.abort();
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, [pathname, search, postId]);

  return null;
}

export function AnalyticsTracker({ postId }: { postId?: string | null }) {
  return (
    <React.Suspense fallback={null}>
      <Beacon postId={postId} />
    </React.Suspense>
  );
}
