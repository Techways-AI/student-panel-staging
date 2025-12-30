import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    let body;
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      body = await request.json();
    } else {
      // Fallback: try to parse text/plain sent via sendBeacon without headers
      const text = await request.text();
      try {
        body = JSON.parse(text);
      } catch {
        return NextResponse.json({ message: 'Invalid JSON' }, { status: 400 });
      }
    }

    const { userId, seconds } = body || {};
    if (!userId || !seconds || seconds <= 0) {
      return NextResponse.json({ message: 'Missing or invalid data' }, { status: 400 });
    }

    const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';

    const resp = await fetch(`${API_BASE}/api/user-activity`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, seconds }),
      // Keep it simple; cookies/credentials not needed here
    });

    if (!resp.ok) {
      const msg = await resp.text().catch(() => '');
      return NextResponse.json({ message: 'Backend failed', detail: msg }, { status: 502 });
    }

    return NextResponse.json({ message: 'ok' });
  } catch (err) {
    console.error('Error in /api/user-activity route:', err);
    return NextResponse.json({ message: 'Failed' }, { status: 500 });
  }
}

