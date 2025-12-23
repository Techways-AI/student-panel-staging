'use client';

import { useEffect } from 'react';

const SW_RELOAD_FLAG = 'durranis-sw-reloaded';

const ServiceWorkerRegistration = () => {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      process.env.NODE_ENV === 'production' &&
      (window.location.protocol === 'https:' || window.location.hostname === 'localhost')
    ) {
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      console.log('Service Worker registered successfully:', registration);

      const requestSkipWaiting = () => {
        if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
      };

      const safeReload = () => {
        try {
          if (typeof window === 'undefined') return;
          const storage = window.sessionStorage;
          if (storage.getItem(SW_RELOAD_FLAG)) {
            storage.removeItem(SW_RELOAD_FLAG);
            return;
          }
          storage.setItem(SW_RELOAD_FLAG, 'true');
        } catch (err) {
          console.warn('Session storage not available for SW reload tracking', err);
        }
        window.location.reload();
      };

      // Handle updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        console.log('Service Worker update found');

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('New Service Worker installed, activating');
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Handle controller change
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Service Worker controller changed');
        safeReload();
      });

      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event?.data?.type === 'SW_UPDATED') {
          console.log('Service Worker broadcast update received', event.data);
          requestSkipWaiting();
          safeReload();
        }
      });

      // Handle service worker errors
      registration.addEventListener('error', (error) => {
        console.error('Service Worker registration error:', error);
      });

      // Ensure waiting worker (if any) is activated immediately
      requestSkipWaiting();

    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  };

  return null; // This component doesn't render anything
};

export default ServiceWorkerRegistration;

