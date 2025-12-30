import { NextResponse } from 'next/server';

// Fix: Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Fix: Use searchParams from request instead of request.url
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');
    
    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    // Extract authorization header from the request
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    // Fix: Use environment variable instead of hardcoded localhost
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app';
    
    // Call the FastAPI backend to extract text content
    const response = await fetch(`${API_BASE_URL}/api/subject-content/extract-text-content?key=${encodeURIComponent(key)}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('FastAPI backend error:', response.status, errorText);
      return NextResponse.json(
        { error: `Failed to extract text content: ${response.status} ${response.statusText}` },
        { status: response.status }
      );
    }

    // Get the JSON response
    const data = await response.json();

    // Return the extracted content
    return NextResponse.json(data, {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('Error extracting text content:', error);
    return NextResponse.json(
      { error: `Failed to extract text content: ${error.message}` },
      { status: 500 }
    );
  }
}


