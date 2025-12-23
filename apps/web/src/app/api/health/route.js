export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    message: 'Frontend API is running',
    timestamp: new Date().toISOString()
  });
}

export async function POST(request) {
  return GET(request);
}

