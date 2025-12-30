import { NextResponse } from 'next/server';

// Force dynamic rendering and disable caching for fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');

    // Forward query params to FastAPI
    const incomingUrl = new URL(request.url);
    const backendUrl = new URL(`${API_BASE_URL}/api/quiz/completed-topics`);
    incomingUrl.searchParams.forEach((value, key) => backendUrl.searchParams.append(key, value));

    // Add timeout protection
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(backendUrl.toString(), {
        method: 'GET',
        headers: {
          Authorization: authHeader || '',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('FastAPI backend error:', response.status, errorText);
        throw new Error(`FastAPI backend error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      return NextResponse.json(data);
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        throw new Error('Request timeout - FastAPI backend not responding');
      }
      throw fetchError;
    }
  } catch (error) {
    console.error('Error in completed topics proxy:', error);
    return NextResponse.json(
      {
        error: `Failed to fetch completed topics: ${error.message}`,
        details: error.cause ? error.cause.message : 'No additional details',
      },
      { status: 500 },
    );
  }
}
