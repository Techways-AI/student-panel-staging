import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Get the X-API-Key from the request headers
    const xApiKey = request.headers.get('X-API-Key');
    
    // Use environment variable for backend URL with fallback
    const BACKEND_URL = process.env.FASTAPI_BACKEND_URL || 'http://127.0.0.1:8001';
    
    // Prepare headers for the FastAPI backend
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add X-API-Key if provided
    if (xApiKey) {
      headers['X-API-Key'] = xApiKey;
    }
    
    // Make request to FastAPI backend
    const response = await fetch(`${BACKEND_URL}/api/ai/ask`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    
    // If the backend returns an error, forward it
    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI AI endpoint error:', response.status, errorText);
      return NextResponse.json(
        { 
          error: `Backend error: ${response.status} - ${errorText}`,
          status: response.status,
          backendUrl: `${BACKEND_URL}/api/ai/ask`
        },
        { status: response.status }
      );
    }
    
    // Return the successful response
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Next.js AI API route error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}


