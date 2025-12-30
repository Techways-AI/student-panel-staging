export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

// API key configuration - same as in main API
const AI_API_KEY = 'rjaLrgTqGA8LzJg9fMKqCvLtHrKLJoH1r8EHjRwVunqcA9KiiCy6jJfg2DoyCbNa8ZVUga-u5W7SCPPA486BQA';

// Backend API configuration
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'https://student-panel-staging-production.up.railway.app/';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Get the X-API-Key from the request headers
    const xApiKey = request.headers.get('X-API-Key');
    
    // Validate API key
    if (!xApiKey || xApiKey !== AI_API_KEY) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
    
    // Extract the parameters
    const { topic, fileName, documentId } = body;
    
    // Forward the request to the backend API instead of using hardcoded prompts
    try {
      const backendResponse = await fetch(`${BACKEND_API_URL}/api/ai/suggest-prompts`, {
        method: 'POST',
        headers: {
          'X-API-Key': AI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          topic,
          fileName,
          document_id: documentId
        })
      });
      
      if (backendResponse.ok) {
        const backendData = await backendResponse.json();
        
        // Return the backend response with additional context
        return NextResponse.json({
          ...backendData,
          message: "Prompt suggestions fetched from SME panel via backend API",
          source: "backend_api",
          frontend_processed: true
        });
      } else {
        // If backend fails, return error
        const errorData = await backendResponse.json().catch(() => ({}));
        console.error('Backend API error:', backendResponse.status, errorData);
        
        return NextResponse.json(
          { 
            error: `Backend API error: ${backendResponse.status}`,
            details: errorData,
            message: "Failed to fetch prompts from backend API"
          },
          { status: backendResponse.status }
        );
      }
      
    } catch (backendError) {
      console.error('Error calling backend API:', backendError);
      
      // Return error if backend is unreachable
      return NextResponse.json(
        { 
          error: 'Backend API unreachable',
          details: backendError.message,
          message: "Unable to connect to backend API for prompt suggestions"
        },
        { status: 503 }
      );
    }
    
  } catch (error) {
    console.error('AI suggest-prompts error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}




