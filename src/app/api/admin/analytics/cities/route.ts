import { NextResponse, type NextRequest } from 'next/server';

import { getCitiesForCountry, parseRange } from '@/lib/analytics-queries';
import { assertCapability } from '@/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** City drill-down for the location table. Reads the pre-aggregated rollup. */
export async function GET(request: NextRequest) {
  try {
    await assertCapability('analytics.view');
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const country = params.get('country');
  if (!country || !/^[A-Za-z]{2}$/.test(country)) {
    return NextResponse.json({ error: 'A two-letter country code is required.' }, { status: 400 });
  }

  const range = parseRange({
    preset: params.get('preset') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  });

  const cities = await getCitiesForCountry(range, country.toUpperCase());
  return NextResponse.json({ cities });
}
