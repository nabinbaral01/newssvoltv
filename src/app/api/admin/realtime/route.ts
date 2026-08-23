import { NextResponse } from 'next/server';

import { getRealtime } from '@/lib/analytics-queries';
import { assertCapability } from '@/lib/permissions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Polled every 10 seconds by the realtime views. Rollups cannot serve this. */
export async function GET() {
  try {
    await assertCapability('analytics.view');
  } catch {
    return NextResponse.json({ error: 'Not authorised' }, { status: 403 });
  }

  const data = await getRealtime();
  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } });
}
