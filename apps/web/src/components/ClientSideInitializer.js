"use client";

import { useEffect } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';

export default function ClientSideInitializer() {
  useAnalytics();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      import('../utils/deviceManager').catch(error => {
        console.warn('Failed to initialize device manager:', error);
      });
      // Service worker registration is handled in layout.js
      // Removed duplicate registration to prevent conflicts

      // Check if user is already logged in and identify with PostHog
      const mobile = localStorage.getItem('mobile');
      const userId = localStorage.getItem('userId');
      const isIdentified = localStorage.getItem('isIdentified');

      if (mobile && isIdentified === 'true') {
        // Import and use analytics to identify user
        import('../services/analytics').then((analytics) => {
          // Set distinct_id directly first
          import('../lib/posthog').then((posthog) => {
            posthog.setDistinctId(mobile);
          });

          analytics.trackAuthUserLoginSuccess(mobile, {
            login_method: 'existing_session',
            mobile: mobile,
            user_id: userId,
            timestamp: new Date().toISOString()
          });
        }).catch(error => {
          console.warn('Failed to identify user with PostHog:', error);
        });
      }

      // Preload critical data
      import('@/lib/api').then((apiModule) => {
        if (apiModule.prefetchCriticalData) {
          apiModule.prefetchCriticalData();
        } else {
          console.warn('prefetchCriticalData function not available');
        }
      }).catch(error => {
        console.warn('Failed to preload critical data:', error);
      });

      // Initialize PWA features
      initializePWA();
      
      // Make notification permission function available globally
      window.requestNotificationPermission = requestNotificationPermission;
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const CHUNK_ERROR_REGEX = /Loading (CSS )?chunk \d+ failed/i;
    const CHUNK_RELOAD_FLAG = 'durranis-chunk-reloaded';

    const safeReload = () => {
      try {
        const storage = window.sessionStorage;
        if (storage.getItem(CHUNK_RELOAD_FLAG)) {
          storage.removeItem(CHUNK_RELOAD_FLAG);
          return;
        }
        storage.setItem(CHUNK_RELOAD_FLAG, 'true');
      } catch (err) {
        console.warn('Session storage unavailable for chunk reload tracking', err);
      }
      window.location.reload();
    };

    const isChunkAsset = (target) => {
      if (!target || typeof target !== 'object') return false;
      if (target.tagName === 'SCRIPT' && typeof target.src === 'string') {
        return target.src.includes('/_next/static/');
      }
      if (target.tagName === 'LINK' && target.rel === 'stylesheet' && typeof target.href === 'string') {
        return target.href.includes('/_next/static/');
      }
      return false;
    };

    const shouldReloadForError = (event) => {
      if (!event) return false;
      if (event.message && CHUNK_ERROR_REGEX.test(event.message)) {
        return true;
      }
      if (isChunkAsset(event.target)) {
        return true;
      }
      return false;
    };

    const shouldReloadForRejection = (event) => {
      if (!event) return false;
      const reason = event.reason || {};
      if (typeof reason === 'string' && CHUNK_ERROR_REGEX.test(reason)) {
        return true;
      }
      if (reason && typeof reason.message === 'string' && CHUNK_ERROR_REGEX.test(reason.message)) {
        return true;
      }
      if (reason && typeof reason.name === 'string' && reason.name.toLowerCase() === 'chunkloaderror') {
        return true;
      }
      return false;
    };

    const handleError = (event) => {
      if (shouldReloadForError(event)) {
        console.warn('Chunk load error detected, reloading...', event);
        safeReload();
      }
    };

    const handleUnhandledRejection = (event) => {
      if (shouldReloadForRejection(event)) {
        console.warn('Chunk load rejection detected, reloading...', event);
        safeReload();
      }
    };

    window.addEventListener('error', handleError, true);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError, true);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  // Initialize PWA features
  const initializePWA = () => {
    // PWA install prompt functionality disabled
    // No longer showing install app buttons
    
    // Request notification permission - only on user interaction
    // This will be handled by user actions instead of automatic request
    // if ('Notification' in window && Notification.permission === 'default') {
    //   Notification.requestPermission();
    // }
  };

  // Request notification permission on user interaction
  const requestNotificationPermission = () => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          console.log('✅ Notification permission granted');
        } else {
          console.log('❌ Notification permission denied');
        }
      });
    }
  };

  return null;
}

