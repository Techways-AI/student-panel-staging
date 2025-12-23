export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';

// API key configuration - same as in aiService.js
const AI_API_KEY = 'rjaLrgTqGA8LzJg9fMKqCvLtHrKLJoH1r8EHjRwVunqcA9KiiCy6jJfg2DoyCbNa8ZVUga-u5W7SCPPA486BQA';

export async function GET(request) {
  try {
    // Get the X-API-Key from the request headers
    const xApiKey = request.headers.get('X-API-Key');
    
    // Validate API key
    if (!xApiKey || xApiKey !== AI_API_KEY) {
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }
    
    // Return health status
    return NextResponse.json({
      status: 'healthy',
      service: 'ai',
      timestamp: new Date().toISOString(),
      endpoints: {
        ask: '/api/ai/ask',
        suggest_prompts: '/api/ai/suggest-prompts',
        health: '/api/ai/health'
      },
      message: 'AI service is running with API key authentication'
    });
    
  } catch (error) {
    console.error('AI health check error:', error);
    return NextResponse.json(
      { error: 'Internal server error: ' + error.message },
      { status: 500 }
    );
  }
}

