/**
 * Utility functions for API calls with improved error handling and retry logic
 */

/**
 * Makes an API call with retry logic and proper error handling
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options
 * @param {number} maxRetries - Maximum number of retries (default: 2)
 * @param {number} retryDelay - Delay between retries in ms (default: 1000)
 * @returns {Promise<Response>} - The fetch response
 */
export async function fetchWithRetry(url, options = {}, maxRetries = 2, retryDelay = 1000) {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔄 API call attempt ${attempt + 1}/${maxRetries + 1}: ${url}`);
      
      const response = await fetch(url, {
        ...options,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          ...options.headers
        }
      });
      
      // If response is ok or it's a client error (4xx), don't retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        console.log(`✅ API call successful: ${response.status}`);
        return response;
      }
      
      // If it's a server error (5xx), we might want to retry
      if (response.status >= 500) {
        console.warn(`⚠️ Server error ${response.status} on attempt ${attempt + 1}`);
        if (attempt < maxRetries) {
          console.log(`⏳ Retrying in ${retryDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, retryDelay));
          continue;
        }
      }
      
      return response;
      
    } catch (error) {
      lastError = error;
      console.warn(`❌ API call failed on attempt ${attempt + 1}:`, error.message);
      
      // Don't retry on network errors that are likely CORS or connectivity issues
      if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
        console.error('❌ Network error detected, not retrying:', error.message);
        throw error;
      }
      
      if (attempt < maxRetries) {
        console.log(`⏳ Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
  
  console.error('❌ All API call attempts failed');
  throw lastError;
}

/**
 * Makes a simple API call without retry (for production fallback)
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Object>} - API response result
 */
export async function fetchSimple(url, options = {}) {
  try {
    console.log(`🔍 Simple API call: ${url}`);
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Simple API call failed:`, response.status, errorText);
      return {
        success: false,
        error: true,
        status: response.status,
        message: errorText || `HTTP ${response.status}`,
        operation: 'Simple API call'
      };
    }
    
    const data = await response.json();
    console.log(`✅ Simple API call successful:`, data);
    return {
      success: true,
      error: false,
      data,
      operation: 'Simple API call'
    };
    
  } catch (error) {
    console.error(`❌ Simple API call error:`, error);
    return {
      success: false,
      error: true,
      message: error.message,
      operation: 'Simple API call'
    };
  }
}

/**
 * Handles API response with proper error handling
 * @param {Response} response - The fetch response
 * @param {string} operation - Description of the operation for logging
 * @returns {Promise<Object>} - Parsed JSON response
 */
export async function handleApiResponse(response, operation = 'API call') {
  try {
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ ${operation} failed:`, response.status, errorText);
      
      // Return a structured error object instead of throwing
      return {
        success: false,
        error: true,
        status: response.status,
        message: errorText || `HTTP ${response.status}`,
        operation
      };
    }
    
    const data = await response.json();
    console.log(`✅ ${operation} successful:`, data);
    return {
      success: true,
      error: false,
      data,
      operation
    };
    
  } catch (error) {
    console.error(`❌ Error parsing ${operation} response:`, error);
    return {
      success: false,
      error: true,
      message: error.message,
      operation
    };
  }
}

/**
 * Makes a study plan API call with fallback to streak API
 * @param {string} url - The API endpoint URL
 * @param {Object} options - Fetch options
 * @param {string} fallbackUrl - Fallback API endpoint URL
 * @param {Object} fallbackOptions - Fallback fetch options
 * @returns {Promise<Object>} - API response result
 */
export async function fetchWithFallback(url, options = {}, fallbackUrl, fallbackOptions = {}) {
  try {
    console.log('🔍 Attempting primary API call...');
    const response = await fetchWithRetry(url, options);
    
    if (response.ok) {
      return await handleApiResponse(response, 'Primary API call');
    }
    
    console.warn('⚠️ Primary API call failed, trying fallback...');
    
    if (fallbackUrl) {
      const fallbackResponse = await fetchWithRetry(fallbackUrl, fallbackOptions);
      return await handleApiResponse(fallbackResponse, 'Fallback API call');
    }
    
    return await handleApiResponse(response, 'Primary API call');
    
  } catch (error) {
    console.error('❌ Primary API call failed with error:', error);
    
    if (fallbackUrl) {
      try {
        console.log('🔄 Attempting fallback API call...');
        const fallbackResponse = await fetchWithRetry(fallbackUrl, fallbackOptions);
        return await handleApiResponse(fallbackResponse, 'Fallback API call');
      } catch (fallbackError) {
        console.error('❌ Fallback API call also failed:', fallbackError);
        return {
          success: false,
          error: true,
          message: 'Both primary and fallback API calls failed',
          primaryError: error.message,
          fallbackError: fallbackError.message
        };
      }
    }
    
    return {
      success: false,
      error: true,
      message: error.message,
      operation: 'Primary API call'
    };
  }
}

/**
 * Creates API headers with authentication
 * @param {string} token - Authentication token
 * @param {Object} additionalHeaders - Additional headers to include
 * @returns {Object} - Headers object
 */
export function createApiHeaders(token, additionalHeaders = {}) {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
}

/**
 * Gets the API base URL from environment or defaults to production
 * @returns {string} - The API base URL
 */
export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';
}

