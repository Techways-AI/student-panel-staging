import { NextResponse } from 'next/server';

// Fix: Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Fix: Properly handle request headers without breaking static generation
    const authHeader = request.headers.get('Authorization');
    
    // Call the FastAPI backend and forward incoming query parameters (subject, unit, topic)
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const incomingUrl = new URL(request.url);
    const backendUrl = new URL(`${API_BASE_URL}/api/quiz/completed`);
    incomingUrl.searchParams.forEach((value, key) => backendUrl.searchParams.append(key, value));
    
    const response = await fetch(backendUrl.toString(), {
      method: 'GET',
      headers: {
        'Authorization': authHeader || '',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI backend error:', response.status, errorText);
      throw new Error(`FastAPI backend error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in quiz completion check proxy:', error);
    return NextResponse.json(
      { error: `Failed to check quiz completion: ${error.message}` },
      { status: 500 }
    );
  }
}

