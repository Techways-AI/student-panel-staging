// Service Worker Registration for Durrani's Pharma

export function registerServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    console.log('Service Worker not supported');
    return;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('Service Worker disabled in development mode');
    return;
  }

  window.addEventListener('load', () => {
    const swUrl = '/sw.js';

    navigator.serviceWorker
      .register(swUrl)
      .then((registration) => {
        console.log('Service Worker registered successfully:', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('Service Worker update found');

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // New content is available, show update notification
              showUpdateNotification();
            }
          });
        });

        // Handle service worker updates
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        // Send message to service worker to check for updates
        if (registration.active) {
          registration.active.postMessage({ type: 'SKIP_WAITING' });
        }
      })
      .catch((error) => {
        console.error('Service Worker registration failed:', error);
      });
  });
}

// Show update notification
function showUpdateNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    const notification = new Notification('Durrani\'s Pharma Updated', {
      body: 'A new version is available. Click to update.',
      icon: '/icon-192x192.png',
      badge: '/badge-72x72.png',
      tag: 'update-notification',
      requireInteraction: true,
      actions: [
        {
          action: 'update',
          title: 'Update Now'
        },
        {
          action: 'dismiss',
          title: 'Later'
        }
      ]
    });

    notification.addEventListener('click', (event) => {
      if (event.action === 'update') {
        window.location.reload();
      }
      notification.close();
    });

    notification.addEventListener('close', () => {
      // Auto-reload after 5 seconds if notification is closed
      setTimeout(() => {
        window.location.reload();
      }, 5000);
    });
  }
}

// Request notification permission
export function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve('not-supported');
  }

  if (Notification.permission === 'granted') {
    return Promise.resolve('granted');
  }

  if (Notification.permission === 'denied') {
    return Promise.resolve('denied');
  }

  return Notification.requestPermission();
}

// Check if app is installed
export function isAppInstalled() {
  if (typeof window === 'undefined') return false;
  
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    document.referrer.includes('android-app://')
  );
}

// Install prompt handling - DISABLED
export function handleInstallPrompt() {
  // PWA install prompt functionality disabled
  // No longer showing install app buttons
  console.log('Install prompt functionality disabled');
}

// Initialize all PWA features
export function initializePWA() {
  registerServiceWorker();
  handleInstallPrompt();
  requestNotificationPermission();
}

// Export default for easy import
export default {
  registerServiceWorker,
  requestNotificationPermission,
  isAppInstalled,
  handleInstallPrompt,
  initializePWA
};

