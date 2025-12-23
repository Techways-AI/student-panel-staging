export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Fix: Use searchParams from request instead of request.url
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('documentId');
    const authHeader = request.headers.get('Authorization');
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'documentId parameter is required' },
        { status: 400 }
      );
    }
    
    // Call the FastAPI backend
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(
      `${API_BASE_URL}/api/subject-content/get-document-id?documentId=${encodeURIComponent(documentId)}`,
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
    console.error('Error in get document ID proxy:', error);
    return NextResponse.json(
      { error: `Failed to get document ID: ${error.message}` },
      { status: 500 }
    );
  }
}

