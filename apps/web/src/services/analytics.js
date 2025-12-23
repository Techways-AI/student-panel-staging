/**
 * Durranis Analytics Service - PostHog Event Tracking
 *
 * EVENT NAMING CONVENTION FOR ADMIN DASHBOARD CLARITY:
 *
 * 1. PREFIX CATEGORIES (for easy filtering in PostHog):
 *    - auth_*          : User authentication events (login, logout, registration)
 *    - learning_*      : Quiz, assessment, and study progress events
 *    - content_*       : Document, video, and content consumption events
 *    - ai_tutor_*      : AI interaction and feedback events
 *    - system_*        : Error, performance, and technical events
 *    - navigation_*    : Page views and feature usage (use trackFeatureUsed for custom)
 *
 * 2. NAMING PATTERNS:
 *    - Use snake_case consistently
 *    - Start with action verb or clear descriptive phrase
 *    - Include outcome/result when relevant (success, complete, failed)
 *    - Keep names under 40 characters for readability
 *    - Use present tense for ongoing actions, past tense for completed actions
 *
 * 3. ADMIN-FRIENDLY EXAMPLES:
 *    - auth_user_login_success (clear: admin knows it's a successful login)
 *    - learning_quiz_attempt_completed (clear: admin knows it's quiz completion)
 *    - content_video_watch_session (clear: admin knows it's video watching activity)
 *    - system_error_occurred (clear: admin knows it's an error event)
 *
 * 4. PROPERTY NAMING:
 *    - Use snake_case for property names (user_id, quiz_id, error_type)
 *    - Include relevant context (subject, difficulty, time_spent)
 *    - Always include user identification (distinct_id or user_id)
 *    - Use consistent units (seconds for time, not mixed units)
 *
 * 5. BACKWARDS COMPATIBILITY:
 *    - Old event names will continue to work but should be migrated
 *    - Use feature flags to gradually roll out new event names
 *    - Document any breaking changes in deployment notes
 */

import {
    ensurePosthog,
    captureEvent as posthogCapture,
    identifyUser as posthogIdentify,
    setPersonProperties as posthogSetProperties,
    resetPosthog as posthogReset,
    startSessionRecording as posthogStartSessionRecording,
    enableAutoCapture as posthogEnableAutoCapture,
    disableAutoCapture as posthogDisableAutoCapture,
    setDistinctId as posthogSetDistinctId,
    isAnalyticsEnabled
} from '../lib/posthog';

const getPosthogConfig = () => {
  return {
    debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === 'true'
  };
};

const debugEnabled = process.env.NEXT_PUBLIC_POSTHOG_DEBUG === 'true';

const runSafe = (callback) => {
    // Prevent execution during SSR
    if (typeof window === 'undefined') {
        console.log('❌ Analytics: Server-side environment, skipping execution');
        return false;
    }

    console.log('🔄 Analytics: runSafe called, calling ensurePosthog()');
    const client = ensurePosthog();
    if (!client) {
        console.log('❌ Analytics: No PostHog client available');
        return false;
    }
    try {
        callback();
        return true;
    } catch (error) {
        if (debugEnabled) {
            console.debug('PostHog analytics error', error);
        }
        return false;
    }
};

// User Authentication Events - Clear names for admin dashboard visibility
export const trackAuthUserLoginSuccess = (userId, userProperties = {}) => {
    const enrichedProps = { user_id: userId, ...userProperties };
    runSafe(() => {
        // Set distinct_id directly first to override any auto-generated UUID
        posthogSetDistinctId(userId);
        posthogIdentify(userId, enrichedProps);
        posthogSetProperties(enrichedProps);
        posthogEnableAutoCapture();  // Enable auto-capture after identification
        posthogStartSessionRecording();
// User Authentication Events - Clear names for admin dashboard visibility
        posthogCapture('auth_user_login_success', { distinct_id: userId, ...enrichedProps });
    });
};

export const trackAuthUserLogoutComplete = (userId) => {
    runSafe(() => {
        posthogCapture('auth_user_logout_complete', { distinct_id: userId });
        posthogDisableAutoCapture();  // Disable auto-capture after logout
        posthogReset();
    });
};

export const trackAuthUserRegistrationSuccess = (userId, userProperties = {}) => {
    const enrichedProps = { user_id: userId, ...userProperties };
    runSafe(() => {
        // Set distinct_id directly first to override any auto-generated UUID
        posthogSetDistinctId(userId);
        posthogIdentify(userId, enrichedProps);
        posthogSetProperties(enrichedProps);
        posthogEnableAutoCapture();  // Enable auto-capture after identification
        posthogCapture('auth_user_registration_success', { distinct_id: userId, ...enrichedProps });
    });
};

// Learning Events - Quiz and Assessment tracking for admin analytics
export const trackLearningQuizAttemptStarted = (quizId, subject, difficulty) => {
    runSafe(() => {
        posthogCapture('learning_quiz_attempt_started', { quiz_id: quizId, subject, difficulty });
    });
};

export const trackLearningQuizAttemptCompleted = (quizId, score, totalQuestions, timeSpent, subject) => {
    runSafe(() => {
        posthogCapture('learning_quiz_attempt_completed', { quiz_id: quizId, score, total_questions: totalQuestions, time_spent: timeSpent, subject });
    });
};

export const trackLearningQuizQuestionAnswered = (quizId, questionIndex, isCorrect, timeSpent) => {
    runSafe(() => {
        posthogCapture('learning_quiz_question_answered', { quiz_id: quizId, question_index: questionIndex, is_correct: isCorrect, time_spent: timeSpent });
    });
};

// Content Interaction Events - Document and video engagement tracking for admin dashboard
export const trackContentDocumentViewOpened = (documentId, documentType, subject) => {
    runSafe(() => {
        posthogCapture('content_document_view_opened', { document_id: documentId, document_type: documentType, subject });
    });
};

export const trackContentVideoWatchSession = (videoId, videoTitle, watchDuration, totalDuration) => {
    runSafe(() => {
        posthogCapture('content_video_watch_session', { video_id: videoId, video_title: videoTitle, watch_duration: watchDuration, total_duration: totalDuration });
    });
};

// AI Interaction Events - AI Tutor usage tracking for admin analytics
export const trackAITutorQuestionSubmitted = (question, subject, responseTime) => {
    runSafe(() => {
        posthogCapture('ai_tutor_question_submitted', { question, subject, response_time: responseTime });
    });
};

export const trackAITutorFeedbackProvided = (feedbackType, rating, comment) => {
    runSafe(() => {
        posthogCapture('ai_tutor_feedback_provided', { feedback_type: feedbackType, rating, comment });
    });
};

// Navigation Events - Page views and feature usage tracking for admin dashboard
export const trackPageView = (pageName, pageProperties = {}) => {
    runSafe(() => {
        const distinctId = pageProperties.distinct_id;
        const props = { ...pageProperties };
        delete props.distinct_id;  // Remove distinct_id from properties

        posthogCapture('$pageview', {
            page: pageName,
            ...props,
            ...(distinctId ? { distinct_id: distinctId } : {})
        });
    });
};

export const trackFeatureUsed = (featureName, featureProperties = {}) => {
    runSafe(() => {
        posthogCapture(featureName, featureProperties);
    });
};

// Goal and Progress Events - Study goals and streaks tracking for admin insights
export const trackLearningDailyStudyGoalConfigured = (goalType, targetValue) => {
    runSafe(() => {
        posthogCapture('learning_daily_study_goal_configured', { goal_type: goalType, target_value: targetValue });
    });
};

export const trackLearningDailyStudyGoalAchieved = (goalType, actualValue, targetValue) => {
    runSafe(() => {
        posthogCapture('learning_daily_study_goal_achieved', { goal_type: goalType, actual_value: actualValue, target_value: targetValue });
    });
};

export const trackLearningStudyStreakUpdated = (streakType, currentStreak, longestStreak) => {
    runSafe(() => {
        posthogCapture('learning_study_streak_updated', { streak_type: streakType, current_streak: currentStreak, longest_streak: longestStreak });
    });
};

// Error and Performance Events - System monitoring for admin technical dashboard
export const trackSystemErrorOccurred = (errorType, errorMessage, pageContext) => {
    runSafe(() => {
        posthogCapture('system_error_occurred', { error_type: errorType, error_message: errorMessage, page_context: pageContext });
    });
};

export const trackSystemPerformanceMeasured = (metricName, value, unit) => {
    runSafe(() => {
        posthogCapture('system_performance_measured', { metric_name: metricName, value, unit });
    });
};

// Utility function to set user properties
export const setUserProperties = (properties) => {
    runSafe(() => {
        posthogSetProperties(properties);
    });
};

// Utility function to get feature flag
export const getFeatureFlag = (flagName) => {
    const client = ensurePosthog();
    if (!client) {
        return false;
    }
    try {
        return client.isFeatureEnabled(flagName);
    } catch (error) {
        const config = getPosthogConfig();
        if (config.debug) {
            console.debug('PostHog feature flag error', error);
        }
        return false;
    }
};

export const resetAnalytics = () => {
    runSafe(() => {
        posthogReset();
    });
};

export const analyticsReady = () => {
    if (isAnalyticsEnabled()) {
        return true;
    }
    const client = ensurePosthog();
    return Boolean(client);
};

