// Configuration for all API routes to prevent static generation issues
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
export const preferredRegion = 'auto';

// Additional configuration to prevent build errors
export const maxDuration = 30;
export const forceStatic = false;

