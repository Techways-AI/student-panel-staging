// Production-safe API service
// Default to local API in absence of env var to avoid accidental production hits
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';

// Request deduplication to prevent duplicate API calls (session-only)
const pendingRequests = new Map();

// Lightweight GET response cache to speed up repeated section switches
const RESPONSE_CACHE = new Map(); // key -> { ts, data }
const CACHE_TTL_MS = 20000; // 20s cache window for GET responses

// Function to clear all user-specific data (for logout)
export const clearAllUserData = () => {
  if (typeof window === 'undefined') return;
  
  console.log('🧹 Clearing all user-specific data');
  
  // Clear user-specific localStorage keys
  const userSpecificKeys = [
    'userData', 'userYearSem', 'userYear', 'userSemester',
    'completedTopics', 'completedQuizzes', 'course_active_tab',
    'course_active_year', 'course_active_semester', 'selectedSubject',
    'lastAccessedSubject', 'studyPlan_', 'cachedUserName_', 'userData',
    'subscription_status', 'userInfo', 'firstLogin', 'lastLogin',
    'ask-ai-main_show_prompts', 'token', 'refreshToken', 'user',
    'mobile', 'isIdentified', 'profileImage', 'cachedUserName_',
    'userYear', 'userSemester', 'course_active_tab', 'course_active_year',
    'course_active_semester', 'selectedSubject', 'lastAccessedSubject',
    'studyPlan_', 'subscription_status', 'firstLogin', 'lastLogin',
    'ask-ai-main_show_prompts', 'refreshToken', 'user', 'mobile',
    'isIdentified', 'profileImage', 'cachedUserName_', 'userData',
    'userYearSem', 'userYear', 'userSemester', 'completedTopics',
    'completedQuizzes', 'course_active_tab', 'course_active_year',
    'course_active_semester', 'selectedSubject', 'lastAccessedSubject',
    'studyPlan_', 'subscription_status', 'userInfo', 'firstLogin',
    'lastLogin', 'ask-ai-main_show_prompts', 'token', 'refreshToken',
    'user', 'mobile', 'isIdentified', 'profileImage'
  ];
  
  // Remove keys that start with specific patterns
  const keysToRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      // Check if key matches any user-specific pattern
      const shouldRemove = userSpecificKeys.some(pattern => 
        key === pattern || key.startsWith(pattern)
      );
      if (shouldRemove) {
        keysToRemove.push(key);
      }
    }
  }
  
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🧹 Removed localStorage key: ${key}`);
  });
  
  console.log(`✅ Cleared ${keysToRemove.length} user-specific localStorage keys`);
};

// Complete logout function that clears everything - optimized for speed
export const performCompleteLogout = () => {
  if (typeof window === 'undefined') return;
  
  console.log('🔒 Performing complete logout - clearing ALL user data');
  
  // Immediate synchronous cleanup for critical data
  try {
    // Clear ALL localStorage data
    localStorage.clear();
    console.log('🧹 Cleared all localStorage data');
    
    // Clear ALL sessionStorage data
    sessionStorage.clear();
    console.log('🧹 Cleared all sessionStorage data');
    
    // Clear all cookies
    if (typeof document !== 'undefined') {
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      console.log('🧹 Cleared all cookies');
    }
    
    // Clear any global variables that might contain user data
    if (window.userData) delete window.userData;
    
    console.log('✅ Critical logout data cleared immediately');
  } catch (error) {
    console.error('⚠️ Error during critical logout cleanup:', error);
  }
  
};

// Clean login function to ensure no stale data before login
export const ensureCleanLogin = () => {
  if (typeof window === 'undefined') return;
  
  console.log('🧹 Ensuring clean login - removing any stale user data');
  
  // Clear any cached user data that might be from previous sessions
  const staleKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('cachedUserName_') || 
      key.includes('userData') ||
      key.includes('userYear') ||
      key.includes('userSemester') ||
      key.startsWith('studyPlan_') ||
      key.includes('course_active') ||
      key.includes('selectedSubject') ||
      key.includes('lastAccessedSubject') ||
      key.includes('completedTopics') ||
      key.includes('completedQuizzes')
    )) {
      staleKeys.push(key);
    }
  }
  
  staleKeys.forEach(key => {
    localStorage.removeItem(key);
    console.log(`🧹 Removed stale key: ${key}`);
  });
  
  console.log(`✅ Cleaned ${staleKeys.length} stale keys before login`);
};


// Debounce utility for API calls
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    return new Promise((resolve, reject) => {
      const later = () => {
        clearTimeout(timeout);
        func(...args).then(resolve).catch(reject);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    });
  };
};

// Helper function to check if token is expired
const isTokenExpired = (token) => {
  if (!token) return true;
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    // Add 5-minute buffer to prevent edge cases
    return payload.exp <= (currentTime + 300);
  } catch (error) {
    console.error('Error parsing token:', error);
    return true;
  }
};

// Helper function to refresh access token
// Aligns with backend: expects expired access token in Authorization header
const refreshAccessToken = async () => {
  const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  
  if (!currentToken) {
    throw new Error('No access token available for refresh');
  }
  
  try {
    console.log('🔄 Refreshing access token (header-based)...');
    
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.access_token) {
      // Update localStorage with new tokens
      localStorage.setItem('token', data.access_token);
      if (data.refresh_token) {
        localStorage.setItem('refreshToken', data.refresh_token);
      }
      if (data.user_info) {
        localStorage.setItem('userInfo', JSON.stringify(data.user_info));
      }
      
      console.log('✅ Access token refreshed successfully');
      
      // Dispatch auth-change event to update AuthContext
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('auth-change', {
          detail: {
            token: data.access_token,
            refreshToken: data.refresh_token || localStorage.getItem('refreshToken'),
            user: data.user_info
          }
        }));
      }
      
      return data.access_token;
    } else {
      throw new Error('No access token in refresh response');
    }
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    
    // Clear invalid tokens and redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userInfo');
      localStorage.removeItem('mobile');
      localStorage.removeItem('isIdentified');
      
      // Dispatch logout event
      window.dispatchEvent(new CustomEvent('auth-logout'));
      
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    throw error;
  }
};

// Enhanced API request with automatic token refresh
const apiRequest = async (endpoint, options = {}) => {
  // Skip token refresh for auth endpoints to prevent infinite loops
  const isAuthEndpoint = endpoint.includes('/auth/refresh-token') || 
                         endpoint.includes('/auth/send-otp') || 
                         endpoint.includes('/auth/verify-otp');
  
  // Request deduplication key
  const userId = typeof window !== 'undefined' ? localStorage.getItem('mobile') : null;
  const requestKey = userId ? 
    `${endpoint}-${userId}-${JSON.stringify(options)}` : 
    `${endpoint}-${JSON.stringify(options)}`;
  
  // Check if request is already pending
  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey);
  }
  
  // Create new request promise
  const requestPromise = (async () => {
    try {
      let token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      // Check if token needs refresh (only for non-auth endpoints)
      if (!isAuthEndpoint && token && isTokenExpired(token)) {
        try {
          token = await refreshAccessToken();
        } catch (refreshError) {
          // If refresh fails, the refreshAccessToken function handles logout
          throw refreshError;
        }
      }
      
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
      };
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // No timeout for quiz generation requests
      const controller = new AbortController();
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      // Handle 401 errors with token refresh retry (only once to prevent loops)
      if (response.status === 401 && !isAuthEndpoint && token && !options._retryAttempted) {
        console.log('🔄 Received 401, attempting token refresh...');
        
        try {
          const newToken = await refreshAccessToken();
          
          // Retry the request with new token
          const retryHeaders = {
            ...headers,
            'Authorization': `Bearer ${newToken}`
          };
          
          const retryResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers: retryHeaders,
            signal: controller.signal,
            _retryAttempted: true // Prevent infinite retry loops
          });
          
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            const error = new Error(`HTTP error! status: ${retryResponse.status}, message: ${errorText}`);
            error.status = retryResponse.status;
            throw error;
          }
          
          return await retryResponse.json();
        } catch (refreshError) {
          // If refresh fails, the refreshAccessToken function handles logout
          throw refreshError;
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        const error = new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        error.status = response.status; // Preserve status code
        throw error;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      
      
      throw error;
    } finally {
      // Remove from pending requests
      pendingRequests.delete(requestKey);
    }
  })();
  
  // Store the promise in pending requests
  pendingRequests.set(requestKey, requestPromise);
  
  return requestPromise;
};

// Prefetch critical data for better performance
export const prefetchCriticalData = async () => {
  try {
    if (typeof window !== 'undefined') {
      const currentToken = localStorage.getItem('token');
      if (!currentToken) {
        console.log('⏳ Skipping critical data prefetch: user not authenticated');
        return;
      }
    }
    
    // Prefetch commonly used endpoints for immediate dashboard display
    const criticalEndpoints = [
      '/api/dashboard-data',
      '/api/dashboard-complete',
      '/api/current-course',
      '/api/all-subjects-progress',
      '/api/auth/me'
    ];
    
    const prefetchPromises = criticalEndpoints.map(endpoint => 
      apiRequest(endpoint).catch(() => null) // Don't fail if prefetch fails
    );
    
    await Promise.allSettled(prefetchPromises);
    console.log('🚀 Critical dashboard data prefetched successfully');
  } catch (error) {
    console.warn('⚠️ Critical data prefetch failed:', error);
  }
};

// Enhanced navigation preloading for instant section switching
const prefetchNavigationData = async () => {
  try {
    // Prefetch data for all main navigation sections with priority
    const navigationEndpoints = [
      '/api/dashboard-complete',
      '/api/current-course',
      '/api/all-subjects-progress',
      '/api/quiz/performance-analysis',
      '/api/study-plan/current',
      '/api/model-paper/available-subjects',
      '/api/quiz/completed-topics-count',
      '/api/user-rank',
      '/api/topper-percentages'
    ];
    
    // Run prefetch in background with priority handling
    const prefetchPromises = navigationEndpoints.map(async (endpoint, index) => {
      try {
        // Add small delay to prevent overwhelming the server
        if (index > 0) {
          await new Promise(resolve => setTimeout(resolve, index * 50));
        }
        return await apiRequest(endpoint);
      } catch (error) {
        console.warn(`⚠️ Prefetch failed for ${endpoint}:`, error);
        return null;
      }
    });
    
    // Don't wait for all to complete, just start them
    Promise.allSettled(prefetchPromises).then(() => {
      console.log('🎯 Navigation data prefetch completed');
    });
    
    console.log('🎯 Navigation data prefetch initiated');
  } catch (error) {
    console.warn('⚠️ Navigation prefetch failed:', error);
  }
};


// Enhanced API request with retry logic + short GET cache
const apiRequestWithRetry = async (endpoint, options = {}, maxRetries = 2) => {
  const method = (options.method || 'GET').toUpperCase();
  const cacheKey = method === 'GET' ? `${endpoint}|${JSON.stringify(options || {})}` : null;

  // Serve fresh cache hit to speed up section switches
  if (cacheKey && RESPONSE_CACHE.has(cacheKey)) {
    const cached = RESPONSE_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
      return cached.data;
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await apiRequest(endpoint, options);
      if (cacheKey) {
        RESPONSE_CACHE.set(cacheKey, { ts: Date.now(), data: result });
      }
      return result;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retrying (exponential backoff)
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`🔄 Retrying API request (attempt ${attempt + 1}/${maxRetries}) in ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Batch API requests for better performance
const batchApiRequests = async (requests) => {
  const results = await Promise.allSettled(requests);
  return results.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      console.error(`Batch request ${index} failed:`, result.reason);
      return null;
    }
  });
};

// Daily Goals API
export const dailyGoalsAPI = {
  markVideoWatched: debounce(async (taskId) => {
    return apiRequestWithRetry('/api/study-plan/task/mark-video-completed', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId }),
    });
  }, 300),

  markNotesRead: debounce(async (taskId) => {
    return apiRequestWithRetry('/api/study-plan/task/mark-notes-completed', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId }),
    });
  }, 300),

  markQuizCompleted: debounce(async (taskId) => {
    try {
      console.log('🎯 Marking quiz as completed for task:', taskId);
      
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/study-plan/task/mark-quiz-completed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Quiz completion tracked successfully:', data);
        return { success: true, data };
      } else {
        console.error('❌ Failed to track quiz completion:', response.statusText);
        return { success: false, message: response.statusText };
      }
    } catch (error) {
      console.error('Failed to mark quiz as completed:', error);
      throw error;
    }
  }, 300),

  // Additional methods used in Overview component
  updateDailyStreak: async (userId, token) => {
    return fetch(`${API_BASE_URL}/api/daily-goal/daily-streak/update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId })
    });
  },

  markGoalComplete: async (userId, token) => {
    return fetch(`${API_BASE_URL}/api/daily-goal/daily-streak/goal-complete`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId })
    });
  },
};

// Current Course API
export const currentCourseAPI = {
  getCurrentCourse: async () => {
    return apiRequestWithRetry('/api/current-course');
  },

  getAllSubjectsProgress: async () => {
    return apiRequestWithRetry('/api/all-subjects-progress');
  },

  getSemesterXP: async (year, semester) => {
    return apiRequestWithRetry(`/api/semester-xp/${year}/${semester}`);
  },

  getStudentCurriculum: async () => {
    return apiRequestWithRetry('/api/student/curriculum');
  },
};

// Simplified Subject Content API
export const subjectContentAPI = {
  getSubjectContent: async (courseName, yearSemester, subjectTitle) => {
    const params = new URLSearchParams({
      courseName,
      yearSemester,
      subjectName: subjectTitle
    });
    
    console.log('🚀 Fetching subject content:', { courseName, yearSemester, subjectTitle });
    
    try {
      const response = await apiRequestWithRetry(`/api/subject-content/?${params}`);
      console.log('✅ Subject content fetched successfully');
      return response;
    } catch (error) {
      console.error('❌ Failed to fetch subject content:', error);
      return []; // Return empty array on error
    }
  },

  getSubjects: async (courseName, yearSemester) => {
    return apiRequestWithRetry(`/api/subject-content/subjects?courseName=${courseName}&yearSemester=${yearSemester}`);
  },

  getPresignedUrl: async (key) => {
    return apiRequestWithRetry(`/api/presigned-url?key=${encodeURIComponent(key)}`);
  },

  getDocumentId: async (opts = {}) => {
    // opts can include: fullPath, topic, university
    const params = new URLSearchParams();
    if (opts.fullPath) params.set('fullPath', opts.fullPath);
    if (opts.topic) params.set('topic', opts.topic);
    if (opts.university) params.set('university', opts.university);
    return apiRequestWithRetry(`/api/subject-content/get-document-id?${params.toString()}`);
  },

  getDocumentIdFromKey: async (s3Key) => {
    return apiRequestWithRetry(`/api/subject-content/get-document-id-from-key?s3_key=${encodeURIComponent(s3Key)}`);
  },

  getNotesByDocumentId: async (documentId) => {
    return apiRequestWithRetry(`/api/subject-content/get-notes-by-document-id?document_id=${documentId}`);
  },

  getNotesBySubjectAndTopic: async (subjectName, topicName) => {
    return apiRequestWithRetry(`/api/subject-content/get-notes-by-subject-topic?subject_name=${encodeURIComponent(subjectName)}&topic_name=${encodeURIComponent(topicName)}`);
  },

  getFileKeyFromDocumentId: async (documentId) => {
    return apiRequestWithRetry(`/api/subject-content/get-file-key-from-document-id?document_id=${encodeURIComponent(documentId)}`);
  },
  
  // New: list subjects for a course and yearSemester
  listSubjects: async (courseName, yearSemester) => {
    const params = new URLSearchParams({ courseName, yearSemester });
    return apiRequestWithRetry(`/api/subject-content/list-subjects?${params.toString()}`);
  },
  
  // New: get subject progress summary (total topics, completed, %)
  getSubjectProgress: async (courseName, yearSemester, subjectName) => {
    const params = new URLSearchParams({ courseName, yearSemester, subjectName });
    return apiRequestWithRetry(`/api/subject-content/progress?${params.toString()}`);
  },

  // New: get accessible semesters for current user
  getAccessibleSemesters: async () => {
    return apiRequestWithRetry('/api/subject-content/accessible-semesters');
  },
};

// Quiz API with performance optimizations
export const quizAPI = {
  generate: debounce(async (request) => {
    return apiRequestWithRetry('/api/quiz/generate', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }, 500),

  generateFromBank: async (request) => {
    const result = await apiRequestWithRetry('/api/quiz/generate-from-bank-public', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return result;
  },

  generateFromFile: async (fileKey) => {
    return apiRequestWithRetry('/api/quiz/generate-from-file', {
      method: 'POST',
      body: JSON.stringify({ file_key: fileKey }),
    });
  },

  score: async (request) => {
    return apiRequestWithRetry('/api/quiz/score', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  checkCompleted: async (request) => {
    const params = new URLSearchParams({
      subject: request.subject,
      unit: request.unit,
      topic: request.topic
    });
    return apiRequestWithRetry(`/api/quiz/completed?${params}`);
  },

  // Fetch completed topics; prefer stable legacy endpoint while MS route lands
  getCompletedTopics: async ({ subject, year, semester }) => {
    const params = new URLSearchParams();
    if (subject) params.set('subject', subject);
    if (year) params.set('year', year);
    if (semester) params.set('semester', semester);

    // Use the existing backend first to avoid noisy 404s while /ms route is unavailable
    try {
      return await apiRequestWithRetry(`/api/quiz/completed-topics?${params.toString()}`);
    } catch (legacyError) {
      try {
        // Try the microservice route if/when it becomes available
        return await apiRequestWithRetry(`/ms/quiz/topic-completion?${params.toString()}`);
      } catch (msError) {
        // Preserve the original legacy error for clearer debugging
        throw legacyError;
      }
    }
  },

  // New: submit quiz and return updated completion list
  submitQuiz: async (request) => {
    // Use existing backend route to avoid 404 until /ms path is available
    return apiRequestWithRetry('/api/quiz/score', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getSubjectCompletion: async (subject) => {
    return apiRequestWithRetry(`/api/quiz/subject-completion?subject=${encodeURIComponent(subject)}`);
  },

  getPerformanceAnalysis: async () => {
    return apiRequestWithRetry('/api/quiz/performance-analysis');
  },

  getStudyPlan: async () => {
    return apiRequestWithRetry('/api/quiz/study-plan');
  },

  getCompletedTopicsCount: async () => {
    return apiRequestWithRetry('/api/quiz/completed-topics-count');
  },

  getAllCompletedTopics: async () => {
    return apiRequestWithRetry('/api/quiz/completed-topics');
  },

  getQuizAnalysisData: async () => {
    return apiRequestWithRetry('/api/quiz/analysis-data');
  },
};

// Study Plan API
export const studyPlanAPI = {
  generate: async ({ examDate, year, semester }) => {
    return apiRequestWithRetry('/api/study-plan/generate', {
      method: 'POST',
      body: JSON.stringify({ exam_date: examDate, year, semester }),
    });
  },

  getCurrent: async () => {
    return apiRequestWithRetry(`/api/study-plan/current`);
  },

  hasPlan: async () => {
    return apiRequestWithRetry(`/api/study-plan/has-plan`);
  },

  getTasksForDate: async (date) => {
    return apiRequestWithRetry(`/api/study-plan/tasks/date?date=${date}`);
  },

  getTodaysTasks: async () => {
    return apiRequestWithRetry(`/api/study-plan/tasks/today`);
  },

  toggleTask: async (taskId, completed) => {
    return apiRequestWithRetry('/api/study-plan/task/toggle', {
      method: 'POST',
      body: JSON.stringify({ task_id: taskId, completed }),
    });
  },

  updateTask: async (taskId, updateData) => {
    return apiRequestWithRetry(`/api/study-plan/task/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updateData),
    });
  },

  deleteTask: async (taskId) => {
    return apiRequestWithRetry(`/api/study-plan/task/${taskId}`, {
      method: 'DELETE',
    });
  },

  getStats: async () => {
    return apiRequestWithRetry(`/api/study-plan/stats`);
  },

  getWeeklyProgress: async () => {
    return apiRequestWithRetry('/api/study-plan/weekly-progress');
  },

  getAllPlans: async () => {
    return apiRequestWithRetry('/api/study-plan/all');
  },

  bulkUpdateTasks: async (updates) => {
    return apiRequestWithRetry('/api/study-plan/bulk-update', {
      method: 'POST',
      body: JSON.stringify({ updates }),
    });
  },

  markDailyTasksCompleted: async () => {
    return apiRequestWithRetry('/api/daily-goal/mark-daily-tasks-completed', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },
};

// Auth API
export const authAPI = {
  me: async () => {
    return apiRequestWithRetry(`/api/auth/me`);
  },

  sendOTP: async (mobile) => {
    return apiRequestWithRetry('/api/auth/send-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile }),
    });
  },

  verifyOTP: async (mobile, otp) => {
    return apiRequestWithRetry('/api/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ mobile, otp }),
    });
  },
};

// Profile API
export const profileAPI = {
  updateProfile: async (profileData) => {
    // Get device information if available
    let deviceHeaders = {};

    if (typeof window !== 'undefined' && window.deviceManager) {
      try {
        // Ensure device manager is initialized
        if (!window.deviceManager.deviceUuid) {
          await window.deviceManager.init();
        }

        const deviceInfo = window.deviceManager.getDeviceInfo();

        deviceHeaders = {
          'x-device-uuid': deviceInfo.deviceUuid,
          'x-device-type': deviceInfo.deviceType,
          'x-device-fingerprint': JSON.stringify(deviceInfo.fingerprint)
        };

        console.log('🔍 Profile Update - Device info added to headers:', deviceHeaders);
      } catch (error) {
        console.warn('⚠️ Failed to get device info for profile update:', error);
        // Continue without device info - don't block profile update
      }
    }

    return apiRequestWithRetry('/api/profile/update', {
      method: 'PUT',
      headers: {
        ...deviceHeaders,
      },
      body: JSON.stringify(profileData),
    });
  },

  getProfile: async () => {
    return apiRequestWithRetry(`/api/profile/me`);
  },
};

export const aiAPI = {
  ask: async (request) => {
    // Use the backend API which handles SME panel integration properly
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.durranis.ai';
    const FULL_URL = `${API_BASE_URL}/api/ai/ask`;
    
    // Get authentication headers
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': 'rjaLrgTqGA8LzJg9fMKqCvLtHrKLJoH1r8EHjRwVunqcA9KiiCy6jJfg2DoyCbNa8ZVUga-u5W7SCPPA486BQA',
    };
    
    // Add JWT token if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    const response = await fetch(FULL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend AI API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  },
  suggestPrompts: async (request) => {
    // Use the backend API which handles SME panel integration properly
    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.durranis.ai';
    const FULL_URL = `${API_BASE_URL}/api/ai/suggest-prompts`;
    
    // Get authentication headers
    const headers = {
      'Content-Type': 'application/json',
      'X-API-Key': 'rjaLrgTqGA8LzJg9fMKqCvLtHrKLJoH1r8EHjRwVunqcA9KiiCy6jJfg2DoyCbNa8ZVUga-u5W7SCPPA486BQA',
    };
    
    // Add JWT token if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
    
    const response = await fetch(FULL_URL, {
      method: 'POST',
      headers,
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend AI API error: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    return data;
  },
  incrementQueryCount: async () => {
    // Authenticated call; apiRequestWithRetry will attach Authorization header
    const sanitizePayload = (payload) => {
      if (!payload) return {};
      return Object.entries(payload).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          acc[key] = value;
        }
        return acc;
      }, {});
    };

    const payload = sanitizePayload(arguments[0]);

    return apiRequestWithRetry('/api/ai/query-count', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  },
};

// Model Paper API
export const modelPaperAPI = {
  getAvailableSubjects: async () => {
    return apiRequestWithRetry(`/api/model-paper/available-subjects`);
  },

  generateModelPaper: async (request) => {
    return apiRequestWithRetry(`/api/model-paper/generate`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getPredictedQuestions: async (request) => {
    return apiRequestWithRetry(`/api/model-paper/predicted-questions`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  getPredictedQuestionsByPath: async (year, semester, subject) => {
    const requestKey = `model_paper_${year}_${semester}_${subject}`;
    
    console.log('🔍 API Request for:', requestKey);
    
    // CHECK FOR PENDING REQUEST (prevent duplicate simultaneous calls)
    if (pendingRequests.has(requestKey)) {
      console.log('🚫 BLOCKING duplicate request for:', subject);
      return await pendingRequests.get(requestKey);
    }
    
    console.log('✅ NEW request for:', subject);
    
    // CREATE NEW REQUEST
    const requestPromise = (async () => {
      try {
        console.log('📡 Making API call to backend for:', subject);
        const response = await apiRequestWithRetry(`/api/model-paper/predicted-questions/${year}/${semester}/${encodeURIComponent(subject)}`);
        console.log('✅ API response received for:', subject);
        return response;
      } catch (error) {
        console.error('❌ API error for:', subject, error);
        throw error;
      } finally {
        // CLEAN UP PENDING REQUEST
        pendingRequests.delete(requestKey);
        console.log('🧹 Cleaned up request for:', subject);
      }
    })();
    
    // STORE PENDING REQUEST
    pendingRequests.set(requestKey, requestPromise);
    
    return requestPromise;
  },

  checkAvailability: async (year, semester, subject) => {
    // Don't cache availability checks since they're quick and might change
    return apiRequestWithRetry(`/api/model-paper/check-availability/${year}/${semester}/${encodeURIComponent(subject)}`);
  },

  checkAvailabilityBatch: async (year, semester) => {
    return apiRequestWithRetry(`/api/model-paper/check-availability-batch/${year}/${semester}`);
  }
};

// Student Content API
export const studentContentAPI = {
  getTopicContent: async (topic, fileType = 'video') => {
    const params = new URLSearchParams({
      topic,
      file_type: fileType
    });
    return apiRequestWithRetry(`/api/student/topic-content?${params.toString()}`);
  }
};

// Performance monitoring
export const performanceAPI = {
  // Get performance analysis data
  getPerformanceAnalysis: async () => {
    try {
      console.log('📊 Fetching performance analysis...');
      const response = await apiRequestWithRetry('/api/quiz/performance-analysis');
      return response;
    } catch (error) {
      console.error('❌ Error fetching performance analysis:', error);
      throw error;
    }
  },

  getQuizAnalysisData: async () => {
    try {
      console.log('📊 Fetching quiz analysis data...');
      const response = await apiRequestWithRetry('/api/quiz/analysis-data');
      return response;
    } catch (error) {
      console.error('❌ Error fetching quiz analysis data:', error);
      throw error;
    }
  },

  getCompletedTopicsCount: async () => {
    try {
      console.log('📊 Fetching completed topics count...');
      const response = await apiRequestWithRetry('/api/quiz/completed-topics-count');
      return response;
    } catch (error) {
      console.error('❌ Error fetching completed topics count:', error);
      throw error;
    }
  }
};

// Adaptive Learning API
export const adaptiveLearningAPI = {
  // Create a new adaptive learning session
  createSession: async (subject, sessionType = 'learning', learningObjectives) => {
    return apiRequestWithRetry('/api/adaptive-learning/sessions', {
      method: 'POST',
      body: JSON.stringify({
        subject,
        session_type: sessionType,
        learning_objectives: learningObjectives || []
      })
    });
  },

  // Get session progress
  getSessionProgress: async (sessionId) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}`);
  },

  // Update session progress
  updateSessionProgress: async (sessionId, unitName, topicName, performanceScore, timeSpentMinutes) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}/progress`, {
      method: 'PUT',
      body: JSON.stringify({
        session_id: sessionId,
        unit_name: unitName,
        topic_name: topicName,
        performance_score: performanceScore,
        time_spent_minutes: timeSpentMinutes
      })
    });
  },

  // Record quiz completion
  recordQuizCompletion: async (sessionId, unitName, topicName, score, totalQuestions, timeTakenMinutes, weakAreas, strongAreas) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}/quiz-completion`, {
      method: 'POST',
      body: JSON.stringify({
        session_id: sessionId,
        unit_name: unitName,
        topic_name: topicName,
        score: score,
        total_questions: totalQuestions,
        time_taken_minutes: timeTakenMinutes,
        weak_areas: weakAreas || [],
        strong_areas: strongAreas || []
      })
    });
  },

  // Get next recommendations
  getNextRecommendations: async (sessionId, limit = 3) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}/recommendations?limit=${limit}`);
  },

  // Get next topics
  getNextTopics: async (sessionId, limit = 5) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}/next-topics?limit=${limit}`);
  },

  // Get user adaptive learning stats
  getUserStats: async (userId) => {
    return apiRequestWithRetry(`/api/adaptive-learning/users/${userId}/stats`);
  },

  // Pause session
  pauseSession: async (sessionId) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}/pause`, {
      method: 'PUT'
    });
  },

  // Resume session
  resumeSession: async (sessionId) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}/resume`, {
      method: 'PUT'
    });
  },

  // Complete session
  completeSession: async (sessionId) => {
    return apiRequestWithRetry(`/api/adaptive-learning/sessions/${sessionId}/complete`, {
      method: 'PUT'
    });
  }
};

// Dashboard API
export const dashboardAPI = {
  getCompleteDashboard: async () => {
    return apiRequestWithRetry('/api/dashboard-data');
  },

  getDashboardSummary: async (userId) => {
    return apiRequestWithRetry(`/api/dashboard-complete?userId=${userId}`);
  },

  getUserStats: async () => {
    return apiRequestWithRetry('/api/quiz/performance-analysis');
  },

  getLeaderboard: async () => {
    return apiRequestWithRetry('/api/leaderboard');
  },

  getUserRank: async () => {
    return apiRequestWithRetry('/api/user-rank');
  },

  getTopperPercentages: async () => {
    return apiRequestWithRetry('/api/topper-percentages');
  }
};

// Export object with all APIs and utilities
const apiExports = {
  subjectContent: subjectContentAPI,
  quiz: quizAPI,
  auth: authAPI,
  profile: profileAPI,
  ai: aiAPI,
  currentCourse: currentCourseAPI,
  modelPaper: modelPaperAPI,
  studyPlan: studyPlanAPI,
  performance: performanceAPI,
  adaptiveLearning: adaptiveLearningAPI,
  dashboard: dashboardAPI,
  studentContent: studentContentAPI,
  prefetchCriticalData,
  prefetchNavigationData,
  clearAllUserData,
  performCompleteLogout,
  ensureCleanLogin
};


export default apiExports;

