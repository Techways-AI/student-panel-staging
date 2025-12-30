export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // Get the request body and auth header
    const body = await request.json();
    const authHeader = request.headers.get('authorization');
    
    // Prepare headers for the FastAPI backend
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Forward the Authorization header if present
    if (authHeader) {
      headers['Authorization'] = authHeader;
    }
    
    // Make request to FastAPI backend
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app';
    const response = await fetch(`${API_BASE_URL}/api/feedback/submit`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    // If the backend returns an error, forward it
    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }
    
    // Return the successful response
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Next.js API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

