'use client';

import * as React from 'react';

import { CONSENT_EVENT, analyticsAllowed, type ConsentState } from '@/lib/consent';

/** Microsoft Clarity project for thevoltv.com. Public by nature — it is in the page. */
const CLARITY_ID = 'zjnftlvau2';

/** Only the real site is recorded; local and preview visits would pollute the heatmaps. */
const PRODUCTION_HOSTS = ['www.thevoltv.com', 'thevoltv.com'];

let loaded = false;

/** Microsoft's own snippet, run only once consent exists. */
function loadClarity() {
  if (loaded) return;
  loaded = true;
  const w = window as unknown as { clarity?: ((...args: unknown[]) => void) & { q?: unknown[] } };
  w.clarity =
    w.clarity ||
    function (...args: unknown[]) {
      (w.clarity!.q = w.clarity!.q || []).push(args);
    };
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.clarity.ms/tag/${CLARITY_ID}`;
  document.head.appendChild(script);
}

/**
 * Heatmaps and session recordings, under the same rule as the first-party
 * analytics: nothing loads until the reader presses "Accept analytics", and a
 * browser sending Do Not Track or Global Privacy Control never loads it at all.
 * Accepting on the current page starts it immediately, without a reload.
 *
 * Mounted in the public site layout only, so admin sessions are never recorded.
 */
export function Clarity() {
  React.useEffect(() => {
    if (!PRODUCTION_HOSTS.includes(window.location.hostname)) return;

    if (analyticsAllowed()) {
      loadClarity();
      return;
    }

    const onConsent = (event: Event) => {
      if ((event as CustomEvent<ConsentState>).detail?.value === 'all' && analyticsAllowed()) {
        loadClarity();
      }
    };
    window.addEventListener(CONSENT_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_EVENT, onConsent);
  }, []);

  return null;
}
