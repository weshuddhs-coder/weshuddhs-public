import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Mirrors the CRM track-host routing so existing links keep working after the
// cutover: the WhatsApp "Track Order" button points at track.weshuddhs.in/<awb>
// (a bare path), and the bare root is the lookup landing. Everything under
// /track and /invoice resolves directly.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/') {
    const url = req.nextUrl.clone();
    url.pathname = '/track/lookup';
    return NextResponse.rewrite(url);
  }

  // A single bare segment like /7D139320831 or /78632 → the tracking page.
  const bare =
    !pathname.startsWith('/track') &&
    !pathname.startsWith('/invoice') &&
    !pathname.startsWith('/_next') &&
    !pathname.startsWith('/api') &&
    !/\.[a-zA-Z0-9]+$/.test(pathname); // skip files (favicon.ico, *.png, …)
  if (bare) {
    const url = req.nextUrl.clone();
    url.pathname = `/track${pathname}`;
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
};
