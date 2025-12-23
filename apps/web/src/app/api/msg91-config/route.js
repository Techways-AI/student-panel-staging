import { NextResponse } from 'next/server';

export async function GET() {
  const widgetId = process.env.NEXT_PUBLIC_MSG91_WIDGET_ID || '';
  const tokenAuth = process.env.NEXT_PUBLIC_MSG91_TOKEN_AUTH || '';

  const hasWidgetId = !!widgetId;
  const hasTokenAuth = !!tokenAuth;

  console.log('MSG91_CONFIG_RUNTIME', { hasWidgetId, hasTokenAuth });

  if (!hasWidgetId || !hasTokenAuth) {
    return NextResponse.json(
      { widgetId: null, tokenAuth: null, hasWidgetId, hasTokenAuth },
      { status: 500 }
    );
  }

  return NextResponse.json({
    widgetId,
    tokenAuth,
    hasWidgetId,
    hasTokenAuth,
  });
}

