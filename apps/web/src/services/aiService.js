/**
 * AI Service for handling AI-related API calls
 * Supports both JWT authentication and X-API key authentication
 */

const AI_API_CONFIG = {
  // Use environment variable for backend URL with fallback
  BASE_URL: process.env.NEXT_PUBLIC_FASTAPI_URL || 'https://sme-panel-staging-production.up.railway.app',
  STUDENT_API_BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app',
  API_KEY: 'rjaLrgTqGA8LzJg9fMKqCvLtHrKLJoH1r8EHjRwVunqcA9KiiCy6jJfg2DoyCbNa8ZVUga-u5W7SCPPA486BQA',
  ENDPOINTS: {
    ASK: '/api/ai/ask',
    SUGGEST_PROMPTS: '/api/ai/suggest-prompts',
    HEALTH: '/api/ai/health'
  }
};

/**
 * Helper function to get authentication headers
 * @param {string} jwtToken - Optional JWT token for user authentication
 * @returns {Object} Headers object with authentication
 */
const getAuthHeaders = (jwtToken = null) => {
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': AI_API_CONFIG.API_KEY
  };

  // Add JWT token if provided
  if (jwtToken) {
    headers['Authorization'] = `Bearer ${jwtToken}`;
  }

  return headers;
};

/**
 * Ask AI a question
 * @param {string} question - The question to ask
 * @param {Object} options - Additional options
 * @param {string} options.documentId - Document ID for context
 * @param {string} options.year - Year for context
 * @param {string} options.semester - Semester for context
 * @param {string} options.unit - Unit for context
 * @param {string} options.topic - Topic for context
 * @param {Object} options.metadataFilter - Additional metadata filters
 * @param {string} options.jwtToken - Optional JWT token for user authentication
 * @returns {Promise<Object>} AI response
 */
export const askQuestion = async (question, options = {}) => {
  const {
    documentId,
    year,
    semester,
    unit,
    topic,
    metadataFilter,
    jwtToken
  } = options;

  // Enhanced debugging
  console.log('🚀 Sending AI question with:', { question, documentId, year, semester, unit, topic, metadataFilter });
  console.log('🔑 Using API key:', AI_API_CONFIG.API_KEY.substring(0, 20) + '...');
  console.log('🌐 Backend URL:', `${AI_API_CONFIG.BASE_URL}${AI_API_CONFIG.ENDPOINTS.ASK}`);

  try {
    const response = await fetch(`${AI_API_CONFIG.BASE_URL}${AI_API_CONFIG.ENDPOINTS.ASK}`, {
      method: 'POST',
      headers: getAuthHeaders(jwtToken),
      body: JSON.stringify({
        question,
        document_id: documentId,
        year,
        semester,
        unit,
        topic,
        metadata_filter: metadataFilter || {},
        use_cache: true
      })
    });

    console.log('📡 Response status:', response.status);
    console.log('📋 Response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Backend error response:', errorData);
      throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ AI response received:', result);
    return result;
  } catch (error) {
    console.error('💥 AI Question Error:', error);
    throw new Error(`Failed to get answer from AI: ${error.message}`);
  }
};

export const logAIQuery = async (question, options = {}) => {
  const {
    documentId,
    year,
    semester,
    unit,
    topic,
    metadataFilter,
    jwtToken
  } = options;

  if (!jwtToken) {
    return;
  }

  try {
    await fetch(`${AI_API_CONFIG.STUDENT_API_BASE_URL}/api/ai/log-query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        question,
        document_id: documentId,
        year,
        semester,
        unit,
        topic,
        metadata_filter: metadataFilter || {}
      })
    });
  } catch (error) {
    console.error('AI Log Query Error:', error);
  }
};

/**
 * Get suggested prompts for a topic
 * @param {Object} options - Options for prompt suggestions
 * @param {string} options.topic - Topic for suggestions
 * @param {string} options.fileName - File name for context
 * @param {string} options.documentId - Document ID for context
 * @param {string} options.jwtToken - Optional JWT token for user authentication
 * @returns {Promise<Object>} Suggested prompts
 */
export const getSuggestedPrompts = async (options = {}) => {
  const {
    topic,
    fileName,
    documentId,
    jwtToken
  } = options;

  try {
    const response = await fetch(`${AI_API_CONFIG.BASE_URL}${AI_API_CONFIG.ENDPOINTS.SUGGEST_PROMPTS}`, {
      method: 'POST',
      headers: getAuthHeaders(jwtToken),
      body: JSON.stringify({
        topic,
        fileName,
        document_id: documentId
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Suggest Prompts Error:', error);
    throw new Error(`Failed to get suggested prompts: ${error.message}`);
  }
};

/**
 * Check AI service health
 * @param {string} jwtToken - Optional JWT token for user authentication
 * @returns {Promise<Object>} Health status
 */
export const checkAIHealth = async (jwtToken = null) => {
  try {
    const response = await fetch(`${AI_API_CONFIG.BASE_URL}${AI_API_CONFIG.ENDPOINTS.HEALTH}`, {
      method: 'GET',
      headers: getAuthHeaders(jwtToken)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Health Check Error:', error);
    throw new Error(`Failed to check AI health: ${error.message}`);
  }
};

/**
 * Legacy function for backward compatibility
 * Uses the Next.js API route as a fallback
 */
export const askQuestionLegacy = async (question, options = {}) => {
  try {
    const response = await fetch('/api/ai/ask', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': AI_API_CONFIG.API_KEY
      },
      body: JSON.stringify({
        question,
        ...options
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`HTTP ${response.status}: ${errorData.detail || response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('AI Question Error (Legacy):', error);
    throw new Error(`Failed to get answer from AI: ${error.message}`);
  }
};

export default {
  askQuestion,
  logAIQuery,
  getSuggestedPrompts,
  checkAIHealth,
  askQuestionLegacy
};


