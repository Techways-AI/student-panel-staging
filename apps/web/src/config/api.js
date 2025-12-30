/**
 * Centralized API Configuration
 * 
 * This file contains all backend API URLs and endpoints.
 * Change the BASE_URL here to update all API calls across the application.
 * 
 * Usage:
 * import { API_CONFIG } from '../config/api';
 * const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.AUTH.SEND_OTP}`);
 */

// ============================================================================
// BACKEND API CONFIGURATION
// ============================================================================

// Main Backend API Configuration
export const API_CONFIG = {
  // Base URL for main backend API
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app',
  
  // FastAPI Backend URL (for AI services)
  FASTAPI_URL: process.env.NEXT_PUBLIC_FASTAPI_URL || 'https://sme-panel-staging-production.up.railway.app',
  
  // API Endpoints organized by feature
  ENDPOINTS: {
    // Authentication endpoints
    AUTH: {
      ME: '/api/auth/me',
      PROFILE_COMPLETION_STATUS: '/api/auth/profile-completion-status',
    },
    
    // Dashboard endpoints
    DASHBOARD: {
      DATA: '/api/dashboard-data',
      COMPLETE: '/api/dashboard-complete',
      SUMMARY: '/api/daily-goal/dashboard-summary',
      REFRESH_STREAK: '/api/dashboard/refresh-streak',
    },
    
    // Course and subjects endpoints
    COURSE: {
      CURRENT: '/api/current-course',
      ALL_SUBJECTS_PROGRESS: '/api/all-subjects-progress',
      SEMESTER_XP: '/api/semester-xp',
    },
    
    // Subject content endpoints
    SUBJECT_CONTENT: {
      BASE: '/api/subject-content',
      SUBJECTS: '/api/subject-content/subjects',
      GET_DOCUMENT_ID: '/api/subject-content/get-document-id',
      GET_NOTES_BY_DOCUMENT_ID: '/api/subject-content/get-notes-by-document-id',
      GET_NOTES_BY_SUBJECT_TOPIC: '/api/subject-content/get-notes-by-subject-topic',
      GET_FILE_KEY_FROM_DOCUMENT_ID: '/api/subject-content/get-file-key-from-document-id',
    },
    
    // Quiz endpoints
    QUIZ: {
      GENERATE: '/api/quiz/generate',
      GENERATE_FROM_BANK: '/api/quiz/generate-from-bank-public',
      GENERATE_FROM_FILE: '/api/quiz/generate-from-file',
      GENERATE_FROM_NOTES: '/api/quiz/generate-from-notes',
      SCORE: '/api/quiz/score',
      COMPLETED: '/api/quiz/completed',
      PERFORMANCE_ANALYSIS: '/api/quiz/performance-analysis',
      STUDY_PLAN: '/api/quiz/study-plan',
      COMPLETED_TOPICS_COUNT: '/api/quiz/completed-topics-count',
      ANALYSIS_DATA: '/api/quiz/analysis-data',
      SCORES: '/api/quiz/scores',
    },
    
    // Study plan endpoints
    STUDY_PLAN: {
      GENERATE: '/api/study-plan/generate',
      CURRENT: '/api/study-plan/current',
      HAS_PLAN: '/api/study-plan/has-plan',
      TASKS_DATE: '/api/study-plan/tasks/date',
      TASK_TOGGLE: '/api/study-plan/task/toggle',
      TASK_UPDATE: '/api/study-plan/task',
      TASK_DELETE: '/api/study-plan/task',
      STATS: '/api/study-plan/stats',
      WEEKLY_PROGRESS: '/api/study-plan/weekly-progress',
      ALL: '/api/study-plan/all',
      BULK_UPDATE: '/api/study-plan/bulk-update',
      MARK_VIDEO_COMPLETED: '/api/study-plan/task/mark-video-completed',
      MARK_NOTES_COMPLETED: '/api/study-plan/task/mark-notes-completed',
      MARK_QUIZ_COMPLETED: '/api/study-plan/task/mark-quiz-completed',
    },
    
    // Daily goals endpoints
    DAILY_GOAL: {
      MARK_DAILY_TASKS_COMPLETED: '/api/daily-goal/mark-daily-tasks-completed',
      DAILY_STREAK_UPDATE: '/api/daily-goal/daily-streak/update',
      DAILY_STREAK_GOAL_COMPLETE: '/api/daily-goal/daily-streak/goal-complete',
      TODAYS_GOALS_PROGRESS: '/api/daily-goal/todays-goals-progress',
    },
    
    // Profile endpoints
    PROFILE: {
      UPDATE: '/api/profile/update',
      ME: '/api/profile/me',
    },
    
    // AI endpoints (FastAPI backend)
    AI: {
      ASK: '/api/ai/ask',
      SUGGEST_PROMPTS: '/api/ai/suggest-prompts',
      HEALTH: '/api/ai/health',
      DEBUG: '/api/ai/debug/me',
    },
    
    // Model paper endpoints
    MODEL_PAPER: {
      AVAILABLE_SUBJECTS: '/api/model-paper/available-subjects',
      GENERATE: '/api/model-paper/generate',
      PREDICTED_QUESTIONS: '/api/model-paper/predicted-questions',
      PREDICTED_QUESTIONS_BY_PATH: '/api/model-paper/predicted-questions',
      CHECK_AVAILABILITY: '/api/model-paper/check-availability',
      CHECK_AVAILABILITY_BATCH: '/api/model-paper/check-availability-batch',
    },
    
    // Payment endpoints
    PAYMENTS: {
      CREATE_ORDER: '/api/payments/create-order',
      VERIFY: '/api/payments/verify',
      STATUS: '/api/payments/status',
    },
    
    // Feedback endpoints
    FEEDBACK: {
      SUBMIT: '/api/feedback/submit',
    },
    
    // Extract text content endpoint
    EXTRACT_TEXT_CONTENT: '/api/extract-text-content',
    
    // Leaderboard endpoints
    LEADERBOARD: {
      BASE: '/api/leaderboard',
      USER_RANK: '/api/user-rank',
      TOPPER_PERCENTAGES: '/api/topper-percentages',
    },
    
    // Adaptive learning endpoints
    ADAPTIVE_LEARNING: {
      SESSIONS: '/api/adaptive-learning/sessions',
      SESSION_PROGRESS: '/api/adaptive-learning/sessions',
      SESSION_PROGRESS_UPDATE: '/api/adaptive-learning/sessions',
      QUIZ_COMPLETION: '/api/adaptive-learning/sessions',
      RECOMMENDATIONS: '/api/adaptive-learning/sessions',
      NEXT_TOPICS: '/api/adaptive-learning/sessions',
      USER_STATS: '/api/adaptive-learning/users',
      PAUSE_SESSION: '/api/adaptive-learning/sessions',
      RESUME_SESSION: '/api/adaptive-learning/sessions',
      COMPLETE_SESSION: '/api/adaptive-learning/sessions',
    },
  },
  
  // Request configuration
  REQUEST_CONFIG: {
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second
  },
  
  // Cache configuration
  CACHE_CONFIG: {
    DURATION: 10 * 60 * 1000, // 10 minutes
    LONG_DURATION: 60 * 60 * 1000, // 1 hour
    SIZE_LIMIT: 100,
  },
};

// ============================================================================
// EXTERNAL SERVICE CONFIGURATION
// ============================================================================

export const EXTERNAL_CONFIG = {
  // Razorpay configuration
  RAZORPAY: {
    CHECKOUT_SCRIPT: 'https://checkout.razorpay.com/v1/checkout.js',
    KEY_ID: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || 'rzp_live_qdFBIxMEBbBh8w',
    CURRENCY: process.env.NEXT_PUBLIC_PAYMENT_CURRENCY || 'INR',
    MODE: process.env.NEXT_PUBLIC_PAYMENT_MODE || 'live',
  },
  
  // PostHog analytics
  POSTHOG: {
    KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY || '',
    HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com',
  },
  
  // Google Fonts
  FONTS: {
    GOOGLE_FONTS: '//fonts.googleapis.com',
    GOOGLE_FONTS_STATIC: '//fonts.gstatic.com',
  },
};

// ============================================================================
// STATIC ASSET CONFIGURATION
// ============================================================================

export const ASSETS_CONFIG = {
  // Base path for static assets
  BASE_PATH: '/assets',
  
  // Common assets
  ASSETS: {
    LOGO_NAME: '/assets/logo-name.png',
    FAVICON: '/assets/favicon.ico',
    BACK: '/assets/back.png',
    BOOK_BRAIN: '/assets/book-brain.png',
    BRAIN: '/assets/brain.png',
    CHAT: '/assets/chat.png',
    CROWN: '/assets/crown.png',
    CUP_GIF: '/assets/cup1.gif',
    DURRANIS_LOGO_HD: '/assets/durranis-logo-hd.png',
    HOME: '/assets/home.png',
    LESSON: '/assets/lesson.png',
    LIKE: '/assets/like.png',
    LOGO: '/assets/logo.png',
    NAME_ICO: '/assets/name.ico',
    NAME_PNG: '/assets/name.png',
    NOTES: '/assets/notes.png',
    TIME: '/assets/time.png',
    USER_MINUS: '/assets/user-.png',
    USER1: '/assets/user1.png',
  },
  
  // PWA assets
  PWA: {
    MANIFEST: '/manifest.json',
    SERVICE_WORKER: '/sw.js',
    OFFLINE_PAGE: '/offline.html',
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get full URL for an endpoint
 * @param {string} endpoint - The endpoint path
 * @param {boolean} useFastAPI - Whether to use FastAPI backend
 * @returns {string} Full URL
 */
export const getApiUrl = (endpoint, useFastAPI = false) => {
  const baseUrl = useFastAPI ? API_CONFIG.FASTAPI_URL : API_CONFIG.BASE_URL;
  return `${baseUrl}${endpoint}`;
};

/**
 * Get full URL for external service
 * @param {string} service - Service name (e.g., 'RAZORPAY.CHECKOUT_SCRIPT')
 * @returns {string} Full URL
 */
export const getExternalUrl = (service) => {
  const keys = service.split('.');
  let config = EXTERNAL_CONFIG;
  
  for (const key of keys) {
    config = config[key];
    if (!config) {
      throw new Error(`External service configuration not found: ${service}`);
    }
  }
  
  return config;
};

/**
 * Get asset URL
 * @param {string} asset - Asset name (e.g., 'LOGO_NAME')
 * @returns {string} Asset URL
 */
export const getAssetUrl = (asset) => {
  return ASSETS_CONFIG.ASSETS[asset] || `${ASSETS_CONFIG.BASE_PATH}/${asset}`;
};

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

export const ENV_CONFIG = {
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  IS_CLIENT: typeof window !== 'undefined',
  IS_SERVER: typeof window === 'undefined',
};

// ============================================================================
// DEBUG CONFIGURATION
// ============================================================================

export const DEBUG_CONFIG = {
  ENABLED: process.env.NODE_ENV === 'development',
  LOG_API_CALLS: process.env.NODE_ENV === 'development',
  LOG_CACHE_OPERATIONS: process.env.NODE_ENV === 'development',
};

// Export default configuration object
export default API_CONFIG;

