import posthog from 'posthog-js';

const getPosthogConfig = () => {
  return {
    apiKey: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
    debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === 'true',
    enabled: process.env.NEXT_PUBLIC_ENABLE_POSTHOG !== 'false'
  };
};

let isInitialized = false;
let isEnabled = false;

const shouldEnable = () => {
  // Always return false during SSR to prevent PostHog initialization
  if (typeof window === 'undefined') {
    console.log('❌ PostHog shouldEnable: Server-side environment');
    return false;
  }

  const config = getPosthogConfig();
  if (!config.apiKey || config.apiKey === 'undefined') {
    console.log('❌ PostHog shouldEnable: No API key available');
    return false;
  }

  const explicitFlag = config.enabled;
  console.log('🔍 PostHog shouldEnable: explicitFlag result:', explicitFlag);

  if (explicitFlag !== undefined) {
    console.log('✅ PostHog shouldEnable: Using explicit flag, returning:', explicitFlag);
    return explicitFlag;
  }

  const productionResult = process.env.NODE_ENV === 'production';
  console.log('🔍 PostHog shouldEnable: Using NODE_ENV fallback, returning:', productionResult);
  return productionResult;
};

export const ensurePosthog = () => {
  const config = getPosthogConfig();

  if (process.env.NODE_ENV !== 'production') {
    console.log('PostHog Env Vars:', {
      POSTHOG_API_KEY: config.apiKey,
      POSTHOG_HOST: config.host,
      POSTHOG_DEBUG: config.debug,
      ENABLE_FLAG: config.enabled,
      NODE_ENV: process.env.NODE_ENV
    });
  }

  // Early return if not in browser environment
  if (typeof window === 'undefined') {
    console.log('❌ PostHog: Server-side environment, skipping initialization');
    return null;
  }

  if (!shouldEnable()) {
    console.warn('PostHog: shouldEnable returned false');
    return null;
  }

  if (!isInitialized) {
    try {
      posthog.init(config.apiKey, {
        api_host: config.host,
        autocapture: false,  // Disable auto-capture initially
        capture_pageview: false,  // Disable pageview capture initially
        persistence: 'localStorage+cookie',
        person_profiles: 'identified_only',
        debug: config.debug,
        session_recording: {
          maskAllInputs: false,
          captureCanvas: true,
          capturePerformance: true,
          captureNetwork: true,
        },
        loaded: (posthog) => {
          // Check if user is already logged in and identify them immediately
          if (typeof window !== 'undefined') {
            const mobile = localStorage.getItem('mobile');
            const userId = localStorage.getItem('userId');
            const isIdentified = localStorage.getItem('isIdentified');

            const consent = localStorage.getItem('analyticsConsent') === 'true';
            if (consent && mobile && isIdentified === 'true') {
              // Set distinct_id directly first to ensure all events use mobile number
              posthog.set_config({
                autocapture: true,
                capture_pageview: true
              });

              // Set distinct_id directly to override any auto-generated UUID
              if (posthog.set_distinct_id) {
                posthog.set_distinct_id(mobile);
              }

              // Identify user with mobile number
              posthog.identify(mobile, {
                mobile: mobile,
                user_id: userId,
                login_method: 'existing_session',
                $set: {
                  mobile: mobile,
                  user_id: userId
                }
              });

              if (config.debug) {
                console.debug('✅ PostHog: User identified on load with mobile:', mobile);
                console.debug('✅ PostHog: Auto-capture enabled for identified user');
              }
            } else {
              if (config.debug) {
                console.debug('⏳ PostHog: User not identified, auto-capture disabled');
              }
            }
          }
        }
      });
      isInitialized = true;
      isEnabled = true;
      if (config.debug) {
        // eslint-disable-next-line no-console
        console.debug('✅ PostHog initialised');
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn('⚠️ Failed to initialise PostHog:', error);
      return null;
    }
  }

  return posthog;
};

export const isAnalyticsEnabled = () => {
  if (!isInitialized) {
    ensurePosthog();
  }
  return isEnabled;
};

export const enableAutoCapture = () => {
  const client = ensurePosthog();
  if (!client) return;

  try {
    client.set_config({
      autocapture: true,
      capture_pageview: true
    });

    const config = getPosthogConfig();
    if (config.debug) {
      console.debug('✅ PostHog: Auto-capture enabled');
    }
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      console.debug('PostHog enable auto-capture failed', error);
    }
  }
};

export const disableAutoCapture = () => {
  const client = ensurePosthog();
  if (!client) return;

  try {
    client.set_config({
      autocapture: false,
      capture_pageview: false
    });

    const config = getPosthogConfig();
    if (config.debug) {
      console.debug('⏸️ PostHog: Auto-capture disabled');
    }
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      console.debug('PostHog disable auto-capture failed', error);
    }
  }
};

export const captureEvent = (eventName, properties = {}) => {
  const client = ensurePosthog();
  if (!client) return;

  try {
    client.capture(eventName, properties);
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.debug('PostHog capture failed', error);
    }
  }
};

export const setDistinctId = (distinctId) => {
  const client = ensurePosthog();
  if (!client) return;

  try {
    // Set the distinct_id directly on the PostHog instance
    if (client.set_distinct_id) {
      client.set_distinct_id(distinctId);
    }

    const config = getPosthogConfig();
    if (config.debug) {
      console.debug('✅ PostHog: Distinct ID set to:', distinctId);
    }
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      console.debug('PostHog set distinct id failed', error);
    }
  }
};

export const setPersonProperties = (properties = {}) => {
  const client = ensurePosthog();
  if (!client) return;

  try {
    client.people.set(properties);
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.debug('PostHog set properties failed', error);
    }
  }
};

export const identifyUser = (distinctId, properties = {}) => {
  const client = ensurePosthog();
  if (!client) return;
  try {
    client.identify(distinctId, properties);
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      console.debug('PostHog identify failed', error);
    }
  }
};

export const resetPosthog = () => {
  if (!isInitialized) return;

  try {
    posthog.reset();
    // Disable auto-capture after reset for identified users
    if (typeof window !== 'undefined') {
      const mobile = localStorage.getItem('mobile');
      const isIdentified = localStorage.getItem('isIdentified');

      if (mobile && isIdentified === 'true') {
        disableAutoCapture();
      }
    }
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.debug('PostHog reset failed', error);
    }
  }
};

export const startSessionRecording = () => {
  const client = ensurePosthog();
  if (!client) return;

  try {
    client.startSessionRecording?.();
  } catch (error) {
    const config = getPosthogConfig();
    if (config.debug) {
      // eslint-disable-next-line no-console
      console.debug('PostHog start session recording failed', error);
    }
  }
};

