import { NextResponse, type NextRequest } from 'next/server';

import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

/** Second half of the double opt-in. Linked from the confirmation email. */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) return NextResponse.redirect(new URL('/?newsletter=invalid', request.url));

  const subscriber = await prisma.newsletter.findFirst({ where: { confirmToken: token } });
  if (!subscriber) return NextResponse.redirect(new URL('/?newsletter=invalid', request.url));

  await prisma.newsletter.update({
    where: { id: subscriber.id },
    data: { confirmed: true, confirmedAt: new Date(), confirmToken: null },
  });

  return NextResponse.redirect(new URL('/?newsletter=confirmed', request.url));
}
