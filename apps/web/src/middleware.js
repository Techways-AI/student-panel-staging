import { NextResponse } from 'next/server';

export function middleware(request) {
  const isDev = process.env.NODE_ENV !== 'production';
  const response = NextResponse.next();
  
  // In development, prevent caching for fast iteration
  if (isDev) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
  }
  
  return response;
}

export const config = {
  matcher: [
    '/api/:path*',
    '/((?!_next/static|_next/image|favicon.ico|.*\\.).*)',
  ],
};

