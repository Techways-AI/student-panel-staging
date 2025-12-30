export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    // Call the FastAPI backend
    const response = await fetch(
      `${API_BASE_URL}/api/quiz/performance-analysis`,
      {
        method: 'GET',
        headers: {
          'Authorization': authHeader || '',
        },
      }
    );
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI backend error:', response.status, errorText);
      throw new Error(`FastAPI backend error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in performance analysis proxy:', error);
    return NextResponse.json(
      { error: `Failed to fetch performance analysis: ${error.message}` },
      { status: 500 }
    );
  }
}


