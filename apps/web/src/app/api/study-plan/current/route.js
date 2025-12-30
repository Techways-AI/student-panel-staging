export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app';

export async function GET(request) {
  try {
    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    console.log('📋 Study Plan API Route: Fetching current study plan');

    // Forward the request to the backend API
    const response = await fetch(`${API_BASE_URL}/api/study-plan/current`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    console.log('🌐 Study Plan API Route: Backend response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Study Plan API Route: Backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Backend error: ${response.status} - ${errorText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log('✅ Study Plan API Route: Current plan received:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Study Plan API Route: Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


