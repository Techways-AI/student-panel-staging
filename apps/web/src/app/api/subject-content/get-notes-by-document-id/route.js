import { NextResponse } from 'next/server';

// Fix: Mark this route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    // Fix: Use searchParams from request instead of request.url
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('document_id');
    const authHeader = request.headers.get('Authorization');
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'document_id parameter is required' },
        { status: 400 }
      );
    }
    
    // Call the FastAPI backend
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
    
    const response = await fetch(
      `${API_BASE_URL}/api/subject-content/get-notes-by-document-id?document_id=${encodeURIComponent(documentId)}`,
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
    console.error('Error in get notes by document ID proxy:', error);
    return NextResponse.json(
      { error: `Failed to get notes: ${error.message}` },
      { status: 500 }
    );
  }
}


