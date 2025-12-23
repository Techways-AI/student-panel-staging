export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';


export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const courseName = searchParams.get('courseName');
    const yearSemester = searchParams.get('yearSemester');
    const subjectTitle = searchParams.get('subjectTitle');
    
    // Get authorization header first to extract user info
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }
    
    // Forward request to backend
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    const backendResponse = await fetch(`${backendUrl}/api/subject-content/?courseName=${courseName}&yearSemester=${yearSemester}&subjectName=${encodeURIComponent(subjectTitle)}`, {
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


