import { headers } from 'next/headers';

import { countryName } from './utils';
import { geoFromHeaders, parseUserAgent } from './analytics';
import { sendEmail, signInEmail } from './email';
import { prisma } from './prisma';

/**
 * "Thanks for signing in" notification.
 *
 * Deliberately throttled. Mailing on *every* sign-in trains people to ignore
 * the message, and the one time it matters — someone else signing in — it goes
 * unread with the rest. One per account per window keeps it meaningful, and
 * a sign-in from a new device still lands immediately because the throttle is
 * keyed on the account's own last-notified time.
 *
 *   LOGIN_NOTIFICATION_EMAILS=false   turns it off entirely
 *   LOGIN_NOTIFICATION_HOURS=12       widen or narrow the window
 */
const ENABLED = process.env.LOGIN_NOTIFICATION_EMAILS !== 'false';
const THROTTLE_HOURS = Number(process.env.LOGIN_NOTIFICATION_HOURS ?? 12);

export async function notifySignIn(
  userId: string,
  method: 'password' | 'Google',
  /** First sign-in of a new account: always notify, never throttle. */
  options: { force?: boolean } = {},
): Promise<void> {
  if (!ENABLED) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, lastLoginAt: true },
    });
    if (!user) return;

    // lastLoginAt is stamped by the same sign-in, so compare against the value
    // read before it was written — the caller runs this before updating.
    const since = user.lastLoginAt ? Date.now() - user.lastLoginAt.getTime() : Infinity;
    if (!options.force && since < THROTTLE_HOURS * 3_600_000) return;

    const requestHeaders = await headers();
    const ua = parseUserAgent(requestHeaders.get('user-agent'));
    const geo = geoFromHeaders(requestHeaders);

    const device = [ua.browser, ua.os].filter(Boolean).join(' on ') || 'Unknown device';
    const location = geo.city
      ? `${geo.city}, ${geo.country ? countryName(geo.country) : ''}`.replace(/,\s*$/, '')
      : geo.country
        ? countryName(geo.country)
        : 'Unknown location';

    const message = signInEmail(user.name, {
      when: new Intl.DateTimeFormat('en-GB', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: 'UTC',
      }).format(new Date()) + ' UTC',
      method: method === 'Google' ? 'Google account' : 'Email and password',
      device,
      location,
    });

    await sendEmail({ to: user.email, ...message });
  } catch (error) {
    // A sign-in must never fail because the mail server did.
    console.error('[sign-in notice] could not send:', error);
  }
}
