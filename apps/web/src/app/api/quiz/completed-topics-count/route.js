import { NextResponse } from 'next/server';

// Fix: Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    // Call the FastAPI backend
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    try {
      const response = await fetch(
                `${API_BASE_URL}/api/quiz/completed-topics-count`,
        {
          method: 'GET',
          headers: {
            'Authorization': authHeader || '',
          },
          signal: controller.signal,
        }
      );
      
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
    console.error('Error in completed topics count proxy:', error);
    return NextResponse.json(
      { 
        error: `Failed to check completed topics count: ${error.message}`,
        details: error.cause ? error.cause.message : 'No additional details'
      },
      { status: 500 }
    );
  }
}


