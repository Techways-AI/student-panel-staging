export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subjectName = searchParams.get('subject_name');
    const topicName = searchParams.get('topic_name');
    
    if (!subjectName || !topicName) {
      return NextResponse.json({ error: 'Subject name and topic name are required' }, { status: 400 });
    }
    
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }
    
    // Forward request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const backendResponse = await fetch(`${backendUrl}/api/subject-content/get-notes-by-subject-topic?subject_name=${encodeURIComponent(subjectName)}&topic_name=${encodeURIComponent(topicName)}`, {
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
    
    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      console.error('Backend API error:', backendResponse.status, errorText);
      return NextResponse.json({ error: 'Backend API error' }, { status: backendResponse.status });
    }
    
    const data = await backendResponse.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('API route error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


