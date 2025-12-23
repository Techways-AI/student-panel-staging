export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function POST(request) {
  try {
    const body = await request.json();
    const { task_id, completed } = body;
    
    if (!task_id || completed === undefined) {
      return NextResponse.json(
        { error: 'task_id and completed are required' },
        { status: 400 }
      );
    }

    // Get the authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header is required' },
        { status: 401 }
      );
    }

    console.log('🔄 Study Plan API Route: Toggling task:', task_id, 'to', completed);

    // Forward the request to the backend API
    const response = await fetch(`${API_BASE_URL}/api/study-plan/task/toggle`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ task_id, completed }),
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
    console.log('✅ Study Plan API Route: Task toggle response:', data);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ Study Plan API Route: Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


