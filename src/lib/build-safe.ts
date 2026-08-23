/**
 * Build-time database access that degrades instead of failing the deploy.
 *
 * `generateStaticParams`, the sitemap and the RSS feed all query Postgres while
 * `next build` runs. Left unguarded, an unreachable database turns a routine
 * deploy into a red build — which is exactly what happens when someone points
 * DATABASE_URL at the wrong host, or the database is briefly asleep (Neon's
 * free tier suspends after inactivity and takes a moment to wake).
 *
 * None of that work is load-bearing: prerendering is an optimisation, and every
 * one of these routes renders correctly on demand. So a failure here logs
 * loudly and returns a safe fallback rather than stopping the build.
 *
 * Requests at runtime are a different matter and are never swallowed — a page
 * that cannot reach the database should error, not silently show nothing.
 */
export async function buildSafe<T>(label: string, fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    console.warn(
      `\n[build] ${label} could not reach the database — continuing without it.` +
        `\n[build]   ${message}` +
        `\n[build]   These pages will render on first request instead of being prerendered.\n`,
    );
    return fallback;
  }
}
