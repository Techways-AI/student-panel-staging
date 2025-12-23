/**
 * Error handling utilities for the application
 * Provides functions to sanitize errors and log technical errors
 */

/**
 * Sanitizes error messages to be user-friendly
 * @param {Error|string} error - The error to sanitize
 * @param {string} context - Context where the error occurred
 * @returns {string} - User-friendly error message
 */
export const sanitizeError = (error, context = 'application') => {
  // Handle different error types
  if (typeof error === 'string') {
    return error;
  }
  
  if (error && typeof error === 'object') {
    // Network errors
    if (error.name === 'NetworkError' || error.message?.includes('network')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    
    // Authentication errors
    if (error.status === 401 || error.message?.includes('unauthorized')) {
      return 'Authentication required. Please log in again.';
    }
    
    // Server errors
    if (error.status >= 500) {
      return 'Server error. Please try again later.';
    }
    
    // Client errors
    if (error.status >= 400 && error.status < 500) {
      return 'Request error. Please check your input and try again.';
    }
    
    // API errors with user-friendly messages
    if (error.message?.includes('API')) {
      return 'Service temporarily unavailable. Please try again in a moment.';
    }
    
    // Timeout errors
    if (error.message?.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    
    // Generic error message
    if (error.message) {
      return `An error occurred in ${context}. Please try again.`;
    }
  }
  
  // Fallback message
  return `An unexpected error occurred in ${context}. Please try again.`;
};

/**
 * Logs technical errors for debugging purposes
 * @param {Error|string} error - The error to log
 * @param {string} component - Component where the error occurred
 * @param {Object} context - Additional context information
 */
export const logTechnicalError = (error, component = 'unknown', context = {}) => {
  const errorInfo = {
    timestamp: new Date().toISOString(),
    component,
    context,
    error: {
      name: error?.name || 'Unknown',
      message: error?.message || String(error),
      stack: error?.stack,
      status: error?.status,
      code: error?.code
    }
  };
  
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${component}] Technical Error:`, errorInfo);
  }
  
  // In production, you might want to send this to an error tracking service
  // like Sentry, LogRocket, or your own error logging endpoint
  if (process.env.NODE_ENV === 'production') {
    // Example: Send to error tracking service
    // errorTrackingService.log(errorInfo);
    
    // For now, just log to console
    console.error(`[${component}] Production Error:`, errorInfo);
  }
};

/**
 * Creates a standardized error object
 * @param {string} message - Error message
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @returns {Object} - Standardized error object
 */
export const createError = (message, code = 'UNKNOWN_ERROR', details = {}) => {
  return {
    message,
    code,
    details,
    timestamp: new Date().toISOString()
  };
};

/**
 * Handles API response errors
 * @param {Response} response - Fetch API response object
 * @returns {Promise<Error>} - Promise that rejects with error
 */
export const handleApiError = async (response) => {
  let errorMessage = 'An error occurred';
  let errorDetails = {};
  
  try {
    const errorData = await response.json();
    errorMessage = errorData.message || errorData.error || errorMessage;
    errorDetails = errorData.details || {};
  } catch (parseError) {
    // If we can't parse the error response, use the status text
    errorMessage = response.statusText || errorMessage;
  }
  
  const error = new Error(errorMessage);
  error.status = response.status;
  error.details = errorDetails;
  
  return Promise.reject(error);
};

/**
 * Retry function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with function result
 */
export const retryWithBackoff = async (fn, maxRetries = 3, baseDelay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = baseDelay * Math.pow(2, attempt);
      
      // Add jitter to prevent thundering herd
      const jitter = Math.random() * 0.1 * delay;
      
      await new Promise(resolve => setTimeout(resolve, delay + jitter));
    }
  }
  
  throw lastError;
};

