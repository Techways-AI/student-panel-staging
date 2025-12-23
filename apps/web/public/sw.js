// Enhanced Service Worker for Durrani's Pharma with production optimizations
// Bumped to v8 so clients always receive the latest cache policy automatically
const CACHE_VERSION = 'v8';
const CACHE_NAME = `durranis-pharma-${CACHE_VERSION}`;
const STATIC_CACHE = `durranis-static-${CACHE_VERSION}`;
const API_CACHE = `durranis-api-${CACHE_VERSION}`;
const IMAGE_CACHE = `durranis-images-${CACHE_VERSION}`;
const ROUTE_CACHE = `durranis-routes-${CACHE_VERSION}`;
const EXPECTED_CACHES = [STATIC_CACHE, API_CACHE, IMAGE_CACHE, ROUTE_CACHE];

// Critical files to cache immediately for fast loading
// Note: Do NOT include Next.js build directories (/_next/*) here — they change per build and
// should be fetched directly from the network/CDN to avoid script load failures.
const STATIC_FILES = [
  '/',
  '/offline.html',
  '/assets/logo-name.png',
  '/assets/favicon.ico',
  '/manifest.json',
];

// Preload critical routes for instant navigation (disabled by default to avoid stale HTML)
const CRITICAL_ROUTES = [];

// API endpoints to cache with different strategies
// IMPORTANT: User-specific endpoints MUST NOT be cached to avoid stale state after actions.
const API_ENDPOINTS = {
  // Cache for 1 hour (static/mostly static content)
  longTerm: [
    '/api/subjects/',
    '/api/course-structure/',
  ],
  // Cache for 5 minutes (analytics-like, non-critical freshness)
  shortTerm: [
    '/api/quiz/performance-analysis',
  ],
  // No cache (user-specific or rapidly changing)
  noCache: [
    // Auth and AI
    '/api/auth/',
    '/api/ai/',
    // DASHBOARD/STREAK: must be fresh after topic completion
    '/api/dashboard-complete',
    '/api/dashboard-summary',
    '/api/dashboard/', // e.g. /api/dashboard/refresh-streak
    // DAILY GOAL & STREAK
    '/api/daily-goal/',
    // STUDY PLAN (tasks, toggles, today)
    '/api/study-plan/',
    // QUIZ completion status and actions
    '/api/quiz/completed',
    '/api/quiz/mark-completed',
    '/api/quiz/generate',
  ]
};

// Install event - cache static files and preload critical routes
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('Caching static files');
        return cache.addAll(STATIC_FILES);
      }),
    ]).then(() => {
      console.log('Service Worker installed successfully');
      return self.skipWaiting();
    }).catch((error) => {
      console.error('Failed to install Service Worker:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (!EXPECTED_CACHES.includes(cacheName)) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );

      console.log('Service Worker activated');
      await self.clients.claim();

      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      clients.forEach((client) => {
        client.postMessage({ type: 'SW_UPDATED', version: CACHE_NAME });
      });
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event?.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore unsupported schemes (e.g., chrome-extension:, data:) — SW cannot cache them
  if (!url.protocol.startsWith('http')) {
    return; // let the request pass through
  }

  // Do not intercept Next.js build assets (scripts, CSS, data). Let the network handle them.
  // This prevents failures loading 
  // e.g. /_next/static/chunks/*.js when a SW error would otherwise break script loading.
  if (url.origin === self.location.origin && (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/_next/data/') ||
      (request.destination === 'script' && url.pathname.startsWith('/_next/'))
    )) {
    return; // let the request pass through without respondWith
  }

  try {
    // Handle API requests with caching
    const allEndpoints = [...API_ENDPOINTS.longTerm, ...API_ENDPOINTS.shortTerm, ...API_ENDPOINTS.noCache];
    if (allEndpoints.some(endpoint => url.pathname.includes(endpoint))) {
      event.respondWith(handleAPIRequest(request));
      return;
    }

    // Handle static file requests (non-document)
    if (request.method === 'GET' && request.destination !== 'document') {
      event.respondWith(handleStaticRequest(request));
      return;
    }

    // Handle navigation requests
    if (request.mode === 'navigate') {
      event.respondWith(handleNavigationRequest(request));
      return;
    }
  } catch (e) {
    // In case any unexpected error occurs in the handler selection, fall back to network
    event.respondWith(fetch(request));
  }
});

// Enhanced API request handling with intelligent caching strategies
async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Determine caching strategy
  let cacheStrategy = 'noCache';
  let cacheDuration = 0;
  
  if (API_ENDPOINTS.longTerm.some(endpoint => pathname.includes(endpoint))) {
    cacheStrategy = 'longTerm';
    cacheDuration = 60 * 60 * 1000; // 1 hour
  } else if (API_ENDPOINTS.shortTerm.some(endpoint => pathname.includes(endpoint))) {
    cacheStrategy = 'shortTerm';
    cacheDuration = 5 * 60 * 1000; // 5 minutes
  } else if (API_ENDPOINTS.noCache.some(endpoint => pathname.includes(endpoint))) {
    cacheStrategy = 'noCache';
  }
  
  // Respect explicit no-store/no-cache from the client
  const reqCacheHeader = request.headers.get('Cache-Control') || '';
  const forceNoStore = reqCacheHeader.includes('no-store') || reqCacheHeader.includes('no-cache');

  // Check cache first for cacheable endpoints
  if (!forceNoStore && cacheStrategy !== 'noCache') {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      // Check if cache is still valid
      const cacheTime = cachedResponse.headers.get('sw-cache-time');
      if (cacheTime && Date.now() - parseInt(cacheTime) < cacheDuration) {
        return cachedResponse;
      }
    }
  }
  
  try {
    // Try network request
    const networkResponse = await fetch(request);
    
    if (!forceNoStore && networkResponse.ok && cacheStrategy !== 'noCache') {
      // Cache successful responses with timestamp
      const cache = await caches.open(API_CACHE);
      const responseToCache = networkResponse.clone();
      
      // Add cache timestamp header
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers: headers
      });
      
      cache.put(request, cachedResponse);
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', error);
    
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response
    return new Response(
      JSON.stringify({ 
        error: 'Offline - please check your connection',
        offline: true,
        timestamp: new Date().toISOString()
      }),
      {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

// Handle static file requests
async function handleStaticRequest(request) {
  const reqUrl = new URL(request.url);
  // Guard: ignore non-http(s) protocols and Next.js internal assets
  if (!reqUrl.protocol.startsWith('http')) {
    return fetch(request);
  }
  if (reqUrl.pathname.startsWith('/_next/')) {
    return fetch(request);
  }

  // For JavaScript files, prefer network-first to avoid stale chunks. Fallback to cache when offline.
  if (request.destination === 'script') {
    try {
      const networkResponse = await fetch(request);
      if (networkResponse && networkResponse.ok) {
        const cache = await caches.open(STATIC_CACHE);
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    } catch (e) {
      const fallback = await caches.match(request);
      if (fallback) return fallback;
      // If not in cache, return a generic offline response
      return new Response('Offline', { status: 503 });
    }
  }

  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    return new Response('Offline', { status: 503 });
  }
}

// Handle navigation requests with instant loading
async function handleNavigationRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  try {
    // Try network first for fresh content
    const networkResponse = await fetch(request);
    
    // Cache successful responses for future instant loading
    if (networkResponse.ok) {
      const cache = await caches.open(ROUTE_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page
    const offlineResponse = await caches.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }
    
    return new Response(
      '<html><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
      {
        status: 503,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  try {
    // Sync any pending data when connection is restored
    console.log('Background sync started');
    
    // You can implement specific sync logic here
    // For example, sync offline quiz submissions, progress updates, etc.
    
  } catch (error) {
    console.error('Background sync failed:', error);
  }
}

// Push notifications (if you want to add them later)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      data: data.data
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});


