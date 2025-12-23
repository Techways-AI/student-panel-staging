export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const authHeader = request.headers.get('Authorization');
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId parameter is required' },
        { status: 400 }
      );
    }
    
    // TEMPORARY: Use the working dashboard-summary endpoint until dashboard-complete is deployed
    // Call the FastAPI backend
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const response = await fetch(
              `${API_BASE_URL}/api/daily-goal/dashboard-summary/${userId}`,
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
    console.error('Error in dashboard complete proxy:', error);
    return NextResponse.json(
      { error: `Failed to fetch dashboard complete: ${error.message}` },
      { status: 500 }
    );
  }
}

