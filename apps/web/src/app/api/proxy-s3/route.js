export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

export async function GET(request) {
  // Fix: Use searchParams from request instead of request.url
  const { searchParams } = new URL(request.url);
  const s3Url = searchParams.get('url');
  
  if (!s3Url) {
    return NextResponse.json({ error: 'Missing URL parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(s3Url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    
    // Determine content type
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    
    return new NextResponse(arrayBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': arrayBuffer.byteLength.toString(),
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('Error proxying S3 URL:', error);
    return NextResponse.json(
      { error: `Failed to fetch file: ${error.message}` },
      { status: 500 }
    );
  }
} 

