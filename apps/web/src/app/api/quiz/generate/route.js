export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Call the FastAPI backend
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app';
    const response = await fetch(`${API_BASE_URL}/api/quiz/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI backend error:', response.status, errorText);
      throw new Error(`FastAPI backend error: ${response.status} ${errorText}`);
    }
    
    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error in quiz generation proxy:', error);
    return NextResponse.json(
      { error: `Failed to generate quiz: ${error.message}` }, 
      { status: 500 }
    );
  }
}

