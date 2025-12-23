"use client";

import { usePathname } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import * as analytics from '../services/analytics';
import {
    ensurePosthog,
    captureEvent as posthogCapture,
    identifyUser as posthogIdentify,
    setPersonProperties as posthogSetProperties,
    resetPosthog as posthogReset,
    isAnalyticsEnabled
} from '../lib/posthog';

const getPosthogConfig = () => {
  return {
    debug: process.env.NEXT_PUBLIC_POSTHOG_DEBUG === 'true'
  };
};

export function useAnalytics() {
    const posthogClient = useMemo(() => {
        // Only initialize PostHog on client side, not during SSR
        if (typeof window === 'undefined') return null;
        return ensurePosthog();
    }, []);
    const isLoaded = Boolean(posthogClient) || isAnalyticsEnabled();
    const identify = (distinctId, properties) => {
        if (!isLoaded) return;
        try {
            posthogIdentify(distinctId, properties);
        } catch (error) {
            const config = getPosthogConfig();
            if (config.debug) {
                console.debug('PostHog identify error', error);
            }
        }
    };
    const capture = (eventName, properties) => {
        if (!isLoaded) return;
        try {
            posthogCapture(eventName, properties);
        } catch (error) {
            const config = getPosthogConfig();
            if (config.debug) {
                console.debug('PostHog capture error', error);
            }
        }
    };
    const setUserProperties = (properties) => {
        if (!isLoaded) return;
        try {
            posthogSetProperties(properties);
        } catch (error) {
            const config = getPosthogConfig();
            if (config.debug) {
                console.debug('PostHog set properties error', error);
            }
        }
    };
    const reset = () => {
        if (!isLoaded) return;
        try {
            posthogReset();
        } catch (error) {
            const config = getPosthogConfig();
            if (config.debug) {
                console.debug('PostHog reset error', error);
            }
        }
    };
    const pathname = usePathname();

    // Auto-track page views
    useEffect(() => {
        const isIdentified = typeof window !== 'undefined' && localStorage.getItem('isIdentified') === 'true';
        const mobile = typeof window !== 'undefined' ? localStorage.getItem('mobile') : null;

        if (isLoaded && pathname && isIdentified && mobile) {
            const pageName = pathname === '/' ? 'home' : pathname.slice(1);
            analytics.trackPageView(pageName, {
                path: pathname,
                distinct_id: mobile  // Use mobile number for page views
            });
        }
    }, [pathname, isLoaded]);

    return {
        // PostHog methods
        isLoaded,
        identify,
        capture,
        setUserProperties,
        reset,
        
        // Analytics service methods
        trackAuthUserLoginSuccess: analytics.trackAuthUserLoginSuccess,
        trackAuthUserLogoutComplete: analytics.trackAuthUserLogoutComplete,
        trackAuthUserRegistrationSuccess: analytics.trackAuthUserRegistrationSuccess,
        trackLearningQuizAttemptStarted: analytics.trackLearningQuizAttemptStarted,
        trackLearningQuizAttemptCompleted: analytics.trackLearningQuizAttemptCompleted,
        trackLearningQuizQuestionAnswered: analytics.trackLearningQuizQuestionAnswered,
        trackContentDocumentViewOpened: analytics.trackContentDocumentViewOpened,
        trackContentVideoWatchSession: analytics.trackContentVideoWatchSession,
        trackAITutorQuestionSubmitted: analytics.trackAITutorQuestionSubmitted,
        trackAITutorFeedbackProvided: analytics.trackAITutorFeedbackProvided,
        trackPageView: analytics.trackPageView,
        trackFeatureUsed: analytics.trackFeatureUsed,
        trackLearningDailyStudyGoalConfigured: analytics.trackLearningDailyStudyGoalConfigured,
        trackLearningDailyStudyGoalAchieved: analytics.trackLearningDailyStudyGoalAchieved,
        trackLearningStudyStreakUpdated: analytics.trackLearningStudyStreakUpdated,
        trackSystemErrorOccurred: analytics.trackSystemErrorOccurred,
        trackSystemPerformanceMeasured: analytics.trackSystemPerformanceMeasured,
        setUserProperties: analytics.setUserProperties,
        getFeatureFlag: analytics.getFeatureFlag,
    };
} 

