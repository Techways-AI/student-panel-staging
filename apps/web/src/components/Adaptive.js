"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { quizAPI, dashboardAPI, studyPlanAPI } from '@/lib/api';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';
import { useLayout } from '../context/LayoutContext';
import styles from './Adaptive.module.css';
import mobileStyles from './AdaptiveMobile.module.css';

// Skeleton Loading Components
const SmartCoachSkeleton = ({ isDarkMode, isMobile }) => {
  const currentStyles = isMobile ? mobileStyles : styles;
  
  return (
    <div className={`${currentStyles.smartCoachContainer} ${isDarkMode ? currentStyles.darkTheme : currentStyles.lightTheme}`}>
    {/* Header Section Skeleton */}
    <div className={currentStyles.header}>
      <div className={currentStyles.headerContent}>
        <div className={currentStyles.titleSection}>
          <div className={currentStyles.mainTitleSkeleton}></div>
          <div className={currentStyles.subtitleSkeleton}></div>
        </div>
      </div>
    </div>

    {/* KPI Cards Skeleton */}
    <div className={currentStyles.kpiSection}>
      <div className={currentStyles.kpiCard}>
        <div className={currentStyles.kpiIconSkeleton}></div>
        <div className={currentStyles.kpiContent}>
          <div className={currentStyles.kpiValueSkeleton}></div>
          <div className={currentStyles.kpiLabelSkeleton}></div>
          <div className={currentStyles.kpiSubtextSkeleton}></div>
        </div>
      </div>
      <div className={currentStyles.kpiCard}>
        <div className={currentStyles.kpiIconSkeleton}></div>
        <div className={currentStyles.kpiContent}>
          <div className={currentStyles.kpiValueSkeleton}></div>
          <div className={currentStyles.kpiLabelSkeleton}></div>
          <div className={currentStyles.kpiSubtextSkeleton}></div>
        </div>
      </div>
      <div className={currentStyles.kpiCard}>
        <div className={currentStyles.kpiIconSkeleton}></div>
        <div className={currentStyles.kpiContent}>
          <div className={currentStyles.kpiValueSkeleton}></div>
          <div className={currentStyles.kpiLabelSkeleton}></div>
          <div className={currentStyles.kpiSubtextSkeleton}></div>
        </div>
      </div>
      <div className={currentStyles.kpiCard}>
        <div className={currentStyles.kpiIconSkeleton}></div>
        <div className={currentStyles.kpiContent}>
          <div className={currentStyles.kpiValueSkeleton}></div>
          <div className={currentStyles.kpiLabelSkeleton}></div>
          <div className={currentStyles.kpiSubtextSkeleton}></div>
        </div>
      </div>
    </div>

    {/* Main Content Grid Skeleton */}
    <div className={currentStyles.mainGrid}>
      {/* Subject Performance Skeleton */}
      <div className={currentStyles.fullWidthSection}>
        <div className={currentStyles.section}>
          <div className={currentStyles.sectionTitleSkeleton}></div>
          <div className={currentStyles.subjectsListSkeleton}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={currentStyles.subjectItemSkeleton}>
                <div className={currentStyles.subjectInfoSkeleton}>
                  <div className={currentStyles.subjectIconSkeleton}></div>
                  <div className={currentStyles.subjectNameSkeleton}></div>
                  <div className={currentStyles.subjectTrendSkeleton}></div>
                </div>
                <div className={currentStyles.subjectScoreSkeleton}>
                  <div className={currentStyles.progressBarSkeleton}></div>
                  <div className={currentStyles.scoreValueSkeleton}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strengths and Areas for Improvement Skeleton */}
      <div className={currentStyles.sideBySideSection}>
        <div className={currentStyles.section}>
          <div className={currentStyles.sectionTitleSkeleton}></div>
          <div className={currentStyles.strengthsListSkeleton}>
            {[1, 2, 3].map(i => (
              <div key={i} className={currentStyles.strengthItemSkeleton}>
                <div className={currentStyles.strengthInfoSkeleton}>
                  <div className={currentStyles.strengthNameSkeleton}></div>
                  <div className={currentStyles.strengthDescriptionSkeleton}></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={currentStyles.section}>
          <div className={currentStyles.sectionTitleSkeleton}></div>
          <div className={currentStyles.improvementListSkeleton}>
            {[1, 2, 3].map(i => (
              <div key={i} className={currentStyles.improvementItemSkeleton}>
                <div className={currentStyles.improvementInfoSkeleton}>
                  <div className={currentStyles.improvementNameSkeleton}></div>
                  <div className={currentStyles.improvementDescriptionSkeleton}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Comparison Skeleton */}
      <div className={currentStyles.performanceComparisonSection}>
        <div className={currentStyles.performanceComparisonContainer}>
          <div className={currentStyles.performanceComparisonTitleSkeleton}></div>
          <div className={currentStyles.legendSkeleton}>
            <div className={currentStyles.legendItemSkeleton}></div>
            <div className={currentStyles.legendItemSkeleton}></div>
            <div className={currentStyles.legendItemSkeleton}></div>
          </div>
          <div className={currentStyles.comparisonListSkeleton}>
            {[1, 2, 3].map(i => (
              <div key={i} className={currentStyles.comparisonItemSkeleton}>
                <div className={currentStyles.comparisonHeaderSkeleton}></div>
                <div className={currentStyles.comparisonBarSkeleton}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

export default function Adaptive() {
  // All hooks and state declarations at the top - in correct order
  const { isDarkMode } = useTheme();
  const { subscriptionStatus, loading: subscriptionLoading } = useSubscription();
  const { setShowUpgrade } = useLayout();
  
  // All state declarations
  const [isMobile, setIsMobile] = useState(false);
  const [smartCoachTourStep, setSmartCoachTourStep] = useState(-1); // -1 means hidden
  const [tourForceUpdate, setTourForceUpdate] = useState(0); // Force re-render on resize/zoom
  const [performanceData, setPerformanceData] = useState({
    overallScore: 0,
    scoreIncrease: 0,
    classRank: 0,
    totalStudents: 0,
    studyHoursText: '0m',
    completionRate: 0,
    subjects: [],
    strengths: [],
    areasForImprovement: [],
    performanceMetrics: {
      studyHours: { you: 0 },
      quizzes: { you: 0 },
      participation: { you: 0 }
    }
  });
  const [userRankData, setUserRankData] = useState(null);
  const [topperData, setTopperData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [strengthSubjectFilter, setStrengthSubjectFilter] = useState('All');
  const [improvementSubjectFilter, setImprovementSubjectFilter] = useState('All');
  const [streakTier, setStreakTier] = useState(null);
  const [insights, setInsights] = useState([]);
  
  // All refs
  const smartCoachTourStepRef = useRef(-1);
  const isLoadingRef = useRef(true);
  const isAutoStartedTour = useRef(false); // Track if tour was auto-started
  const headerRef = useRef(null);
  const kpiSectionRef = useRef(null);
  const overallScoreCardRef = useRef(null);
  const classRankCardRef = useRef(null);
  const studyHoursCardRef = useRef(null);
  const completionCardRef = useRef(null);
  const subjectPerformanceRef = useRef(null);
  const strengthsRef = useRef(null);
  const improvementsRef = useRef(null);
  const performanceComparisonRef = useRef(null);
  const insightsRef = useRef(null);
  
  // All useEffect hooks after ALL state declarations
  // Mobile detection - initialize synchronously on client
  useEffect(() => {
    // Set initial value immediately
    if (typeof window !== 'undefined') {
      setIsMobile(window.innerWidth < 768);
    }
    
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768);
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', checkMobile);
      return () => {
        if (typeof window !== 'undefined') {
          window.removeEventListener('resize', checkMobile);
        }
      };
    }
    // Always return a cleanup function (even if it's a no-op)
    return () => {};
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(isLoading ? 'page-skeleton-start' : 'page-skeleton-end'));
      }
    } catch {}
  }, [isLoading]);

  // Sync tour step ref
  useEffect(() => {
    smartCoachTourStepRef.current = smartCoachTourStep;
  }, [smartCoachTourStep]);

  // Handle tour step changes - scroll to highlighted element only if needed
  useEffect(() => {
    if (smartCoachTourStep < 0 || isLoading) return;
    
    // Small delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      let targetElement = null;
      if (smartCoachTourStep === 0) {
        targetElement = headerRef.current; // Header + KPI section
      } else if (smartCoachTourStep === 1) {
        targetElement = subjectPerformanceRef.current;
      } else if (smartCoachTourStep === 2) {
        targetElement = strengthsRef.current;
      } else if (smartCoachTourStep === 3) {
        targetElement = improvementsRef.current;
      } else if (smartCoachTourStep === 4) {
        targetElement = performanceComparisonRef.current;
      } else if (smartCoachTourStep === 5) {
        targetElement = insightsRef.current;
      }

      if (targetElement && typeof window !== 'undefined') {
        try {
          // If tour was auto-started, don't scroll on the first 2 steps (Header+KPI and Subject Performance)
          // This prevents unwanted scrolling on page refresh
          if (isAutoStartedTour.current && (smartCoachTourStep === 0 || smartCoachTourStep === 1)) {
            // Reset the flag after step 1 so manual navigation can scroll
            if (smartCoachTourStep === 1) {
              isAutoStartedTour.current = false;
            }
            return; // Don't scroll on auto-started tour for first 2 steps
          }

          const rect = targetElement.getBoundingClientRect();
          const viewportHeight = window.innerHeight;
          const viewportWidth = window.innerWidth;
          
          // Check if element is already visible in viewport
          // Consider it visible if at least 80% of the element is in view
          const elementHeight = rect.height;
          const elementWidth = rect.width;
          const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
          const visibleWidth = Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0);
          
          const isVisible = (
            visibleHeight >= elementHeight * 0.8 &&
            visibleWidth >= elementWidth * 0.8 &&
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= viewportHeight &&
            rect.right <= viewportWidth
          );
          
          // Only scroll if element is not already visible
          if (!isVisible) {
            // Use 'nearest' to minimize scrolling - only scroll if element is outside viewport
            targetElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
          }
        } catch (e) {
          console.warn('Could not scroll to tour element:', e);
        }
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, [smartCoachTourStep, isLoading]);

  // Handle window resize/scroll to recalculate tour highlights (like Overview component)
  useEffect(() => {
    if (smartCoachTourStep < 0) return;
    
    // Update immediately and on resize/scroll events (no debouncing for responsiveness)
    const updateTourPositions = () => {
      // Force re-render of tour overlay to recalculate positions
      setTourForceUpdate(prev => prev + 1);
    };
    
    // Call immediately to ensure proper initial calculation
    updateTourPositions();
    
    // Listen to both resize and scroll events (like Overview does)
    window.addEventListener('resize', updateTourPositions);
    window.addEventListener('scroll', updateTourPositions, true); // true = capture phase
    
    return () => {
      window.removeEventListener('resize', updateTourPositions);
      window.removeEventListener('scroll', updateTourPositions, true);
    };
  }, [smartCoachTourStep]);

  // Force recalculation when tour step changes to ensure DOM is ready
  useEffect(() => {
    if (smartCoachTourStep >= 0 && (smartCoachTourStep === 2 || smartCoachTourStep === 3 || smartCoachTourStep === 5)) {
      // For steps 2, 3, and 5 (sections with scrollable lists), wait for DOM to be fully rendered
      // Single smooth delay to ensure calculation happens after layout
      const timeoutId = setTimeout(() => {
        setTourForceUpdate(prev => prev + 1);
      }, 100);
      
      return () => clearTimeout(timeoutId);
    }
  }, [smartCoachTourStep]);

  // Theme state tracking (removed debug log)

  // Helper: compute streak tier label
  const computeStreakTier = (data) => {
    // Fallback: parse human label when numeric hours missing
    const parseHoursTextToFloat = (txt) => {
      if (!txt || typeof txt !== 'string') return 0;
      // Examples: "10 hrs", "1 hr 30 mins", "45 mins"
      const hMatch = txt.match(/(\d+)\s*hr/);
      const mMatch = txt.match(/(\d+)\s*min/);
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      const m = mMatch ? parseInt(mMatch[1], 10) : 0;
      return h + (m / 60);
    };

    const streakRaw = data?.studyStreak ?? 0;
    const weeklyHoursRaw = data?.performanceMetrics?.studyHours?.you ?? 0;
    const weeklyHoursText = data?.performanceMetrics?.studyHours?.youText || data?.studyHoursText;
    const weeklyHoursParsed = weeklyHoursRaw > 0 ? weeklyHoursRaw : parseHoursTextToFloat(weeklyHoursText);
    const streakEffective = streakRaw > 0 ? streakRaw : (weeklyHoursParsed > 0 ? 1 : 0);

    if (streakEffective >= 21 && weeklyHoursParsed >= 28) return 'Outstanding';
    if (streakEffective >= 7 && weeklyHoursParsed >= 14) return 'Momentum';
    if (streakEffective >= 1 && weeklyHoursParsed >= 1) return 'Great start';
    return null;
  };

  // Helper: generate dynamic insights from transformed data
  const generateInsights = (data) => {
    const list = [];

    // Consistent Study Pattern: tiered messaging
    const parseHoursTextToFloat = (txt) => {
      if (!txt || typeof txt !== 'string') return 0;
      const hMatch = txt.match(/(\d+)\s*hr/);
      const mMatch = txt.match(/(\d+)\s*min/);
      const h = hMatch ? parseInt(hMatch[1], 10) : 0;
      const m = mMatch ? parseInt(mMatch[1], 10) : 0;
      return h + (m / 60);
    };
    const streakRaw = data?.studyStreak ?? 0;
    const weeklyHoursRaw = data?.performanceMetrics?.studyHours?.you ?? 0;
    const weeklyHoursText = data?.performanceMetrics?.studyHours?.youText || data?.studyHoursText;
    const weeklyHours = weeklyHoursRaw > 0 ? weeklyHoursRaw : parseHoursTextToFloat(weeklyHoursText);
    const streak = streakRaw > 0 ? streakRaw : (weeklyHours > 0 ? 1 : 0);

    if (streak >= 1 && weeklyHours >= 1) {
      let description = 'Great start! You’ve begun building a consistent study habit. Keep going daily to strengthen your streak.'; // 1–6 days
      if (streak >= 21 && weeklyHours >= 28) {
        description = 'Outstanding consistency! You’ve maintained 4+ hours daily for 3+ weeks. Keep leading the way!';
      } else if (streak >= 7 && weeklyHours >= 14) {
        description = 'Building momentum! A full week+ of consistency — aim for 2+ hours daily to keep improving.';
      }
      list.push({ type: 'positive', title: 'Consistent Study Pattern', description });
    }

    // Topic-specific warnings based on low quiz/topic performance
    // Use transformed subjects from backend performance analysis
    const subjects = Array.isArray(data?.subjects) ? data.subjects : [];
    // Define low-performance threshold: rawScore <= 3 (out of 5)
    const weakTopics = subjects
      .filter(s => (s?.rawScore ?? 0) <= 3)
      .sort((a, b) => (a.scorePercent ?? 0) - (b.scorePercent ?? 0))
      .slice(0, 3);

    weakTopics.forEach((t) => {
      const topicName = t?.topic || t?.name || 'this topic';
      const scoreStr = typeof t?.rawScore === 'number' ? `${t.rawScore}/5` : `${Math.round(t?.scorePercent ?? 0)}%`;

      // Find matching weakness from quiz analysis data
      const matchingWeakness = data?.areasForImprovement?.find(
        weakness => weakness?.topic?.toLowerCase() === topicName?.toLowerCase() ||
                   weakness?.name?.toLowerCase() === topicName?.toLowerCase()
      );

      const weaknessDescription = matchingWeakness?.description || 'No specific weakness identified';

      list.push({
        type: 'warning',
        title: `Focus on ${topicName}`,
        description: `${weaknessDescription}. Your recent performance in "${topicName}" was low (${scoreStr}). Review this topic and practice daily to improve.`,
      });
    });

    return list;
  };

  // Fetch real performance data from backend with parallel loading
  useEffect(() => {
    const fetchPerformanceData = async () => {
      try {
        setIsLoading(true);
        isLoadingRef.current = true;
        
        // Parallel API calls for faster loading
        const [performanceResponse, quizAnalysisResponse, dashboardResponse, rankResponse, topperResponse, statsResponse] = await Promise.allSettled([
          quizAPI.getPerformanceAnalysis(),
          quizAPI.getQuizAnalysisData(),
          dashboardAPI.getCompleteDashboard(),
          dashboardAPI.getUserRank(),
          dashboardAPI.getTopperPercentages(),
          studyPlanAPI.getStats()
        ]);
        
        // Handle performance analysis
        if (performanceResponse.status === 'fulfilled') {
          // Performance data processed
        }
        
        // Handle quiz analysis data
        if (quizAnalysisResponse.status === 'fulfilled') {
          // Quiz analysis data processed
        }
        
        // Handle dashboard data
        if (dashboardResponse.status === 'fulfilled') {
          // Dashboard data processed
        }
        
        // Handle user rank data
        if (rankResponse.status === 'fulfilled') {
          setUserRankData(rankResponse.value);
        }
        
        // Handle topper percentages data
        if (topperResponse.status === 'fulfilled') {
          setTopperData(topperResponse.value);
        }
        
        // Use study hours directly from study plan stats
        // KPI card expects weekly label
        const hoursText = (statsResponse.status === 'fulfilled' ? (statsResponse.value?.hours_this_week || '0 mins') : '0 mins');
        // Today's label if needed elsewhere
        const todayHoursText = (statsResponse.status === 'fulfilled' ? (statsResponse.value?.today_hours_label || '0 mins') : '0 mins');
        // Weekly floats for bar chart comparison
        const youWeeklyHours = (statsResponse.status === 'fulfilled' ? (statsResponse.value?.your_weekly_hours || 0) : 0);
        const topperWeeklyHours = (statsResponse.status === 'fulfilled' ? (statsResponse.value?.topper_weekly_hours || 0) : 0);

        // Helper to format float hours -> "X hrs Y mins"
        const formatHours = (hFloat) => {
          const totalMinutes = Math.max(0, Math.round(hFloat * 60));
          const h = Math.floor(totalMinutes / 60);
          const m = totalMinutes % 60;
          if (h === 0 && m === 0) return '0 mins';
          if (h === 0) return `${m} mins`;
          if (m === 0) return `${h} hr${h === 1 ? '' : 's'}`;
          return `${h} hr${h === 1 ? '' : 's'} ${m} mins`;
        };
        const youWeeklyHoursText = formatHours(youWeeklyHours);
        const topperWeeklyHoursText = formatHours(topperWeeklyHours);

        // Transform backend data to frontend format
        const transformedData = {
          overallScore: Math.round((performanceResponse.status === 'fulfilled' ? performanceResponse.value.average_percentage : 0) || 0),
          scoreIncrease: 0, // Could be calculated from historical data
          classRank: (rankResponse.status === 'fulfilled' ? rankResponse.value?.user_rank : null) || 
                    ((performanceResponse.status === 'fulfilled' && performanceResponse.value.overall_category === 'Advanced') ? 3 : 
                    (performanceResponse.status === 'fulfilled' && performanceResponse.value.overall_category === 'Intermediate') ? 7 : 15),
          totalStudents: (rankResponse.status === 'fulfilled' ? rankResponse.value?.total_students : null) || 
                        (dashboardResponse.status === 'fulfilled' ? dashboardResponse.value.leaderboard?.length : 0) || 0,
          studyHoursText: hoursText,
          completionRate: performanceResponse.status === 'fulfilled' ? (performanceResponse.value.completion_rate || 0) : 0,
          subjects: Object.entries((performanceResponse.status === 'fulfilled' ? performanceResponse.value.subject_performance : {}) || {}).map(([subjectTopicKey, data]) => ({
            name: subjectTopicKey || 'Unknown Subject - Topic',
            subject: data?.subject || 'Unknown Subject',
            topic: data?.topic || 'Unknown Topic',
            rawScore: Math.round(data?.average_score ?? 0),
            scorePercent: Math.round(((data?.average_score ?? 0) / 5) * 100),
            // Keep score for backward compatibility where needed
            score: Math.round(((data?.average_score ?? 0) / 5) * 100),
            trend: (data?.average_score || 0) > 3 ? 'up' : (data?.average_score || 0) < 2.5 ? 'down' : 'none'
          })).filter(subject => subject.topic !== 'Unknown Topic'), // Filter out entries with unknown topics
           strengths: (quizAnalysisResponse.status === 'fulfilled' ? quizAnalysisResponse.value.strengths : [])?.map(strength => ({
             name: strength.name || 'Unknown Strength',
             subject: strength.subject || 'Unknown Subject',
             topic: strength.topic || 'Unknown Topic',
             description: strength.description || 'No description available',
             score: strength.score || 0
           })) || [],
           areasForImprovement: (quizAnalysisResponse.status === 'fulfilled' ? quizAnalysisResponse.value.areas_for_improvement : [])?.map(area => ({
             name: area.name || 'Unknown Area',
             subject: area.subject || 'Unknown Subject',
             topic: area.topic || 'Unknown Topic',
             description: area.description || 'No description available',
             score: area.score || 0
           })) || [],
          performanceMetrics: {
            studyHours: { 
              // Use weekly values for the weekly comparison chart
              you: youWeeklyHours,
              topper: topperWeeklyHours,
              youText: youWeeklyHoursText,
              topperText: topperWeeklyHoursText,
              // Keep today's label available if needed by UI later
              todayText: todayHoursText,
            },
            quizzes: { 
              you: performanceResponse.status === 'fulfilled' ? (performanceResponse.value.quiz_performance || 0) : 0
            },
            participation: { 
              you: performanceResponse.status === 'fulfilled' ? (performanceResponse.value.your_participation ?? 0) : 0,
              topper: performanceResponse.status === 'fulfilled' ? (performanceResponse.value.topper_participation ?? 0) : 0
            }
          }
        };
        
        // Add additional properties for parallel loading
        transformedData.recentActivity = (dashboardResponse.status === 'fulfilled' ? dashboardResponse.value.recent_activity : []) || [];
        transformedData.studyStreak = (dashboardResponse.status === 'fulfilled' ? dashboardResponse.value.study_streak : 0) || 0;
        transformedData.weeklyProgress = (dashboardResponse.status === 'fulfilled' ? dashboardResponse.value.weekly_progress : []) || [];
        
        setPerformanceData(transformedData);
        // Sync streak tier label for KPI
        try {
          const tier = computeStreakTier(transformedData);
          setStreakTier(tier);
        } catch (e) {
          console.warn('Failed to compute streak tier:', e);
          setStreakTier(null);
        }
        // Compute dynamic insights
        try {
          const generated = generateInsights(transformedData);
          setInsights(generated);
        } catch (e) {
          console.warn('⚠️ Failed to generate insights:', e);
          setInsights([]);
        }
        
      } catch (error) {
        console.error('❌ Failed to fetch performance data:', error);
        // Keep default empty data
      } finally {
        setIsLoading(false);
        isLoadingRef.current = false;
        // Check and start tour after data loads
        setTimeout(() => {
          try {
            // Check for URL parameter to force show tour (for testing)
            const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
            const forceTour = urlParams?.get('tour') === 'true' || urlParams?.get('tour') === '1';
            
            // Check if user just completed onboarding
            const onboardingJustCompleted = typeof window !== 'undefined' 
              ? window.localStorage.getItem('onboarding-just-completed') === 'true'
              : false;
            
            const tourDismissed = typeof window !== 'undefined' 
              ? window.localStorage.getItem('smart-coach-tour-dismissed')
              : null;
            
            // Show tour only if: forced via URL param OR (onboarding just completed and not dismissed)
            if ((forceTour || (onboardingJustCompleted && !tourDismissed)) && smartCoachTourStepRef.current === -1) {
              // Mark as auto-started
              isAutoStartedTour.current = true;
              // Show tour after a short delay to ensure page is rendered
              setTimeout(() => {
                setSmartCoachTourStep(0);
              }, 500);
            }
          } catch (err) {
            console.error('❌ Error checking tour status:', err);
          }
        }, 100);
      }
    };

    fetchPerformanceData();
  }, []);

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
            <polyline points="18,15 12,9 6,15"></polyline>
          </svg>
        );
      case 'down':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
            <polyline points="6,9 12,15 18,9"></polyline>
          </svg>
        );
      default:
        return null;
    }
  };

  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const accessInfo = useMemo(() => {
    const planId = (subscriptionStatus?.subscription_status || '').toLowerCase();
    const tier = (subscriptionStatus?.tier || '').toLowerCase();
    const isPlus = !!subscriptionStatus?.is_plus || planId.includes('plus') || tier === 'plus';
    const isPro = !!subscriptionStatus?.is_pro || planId.includes('pro') || tier === 'pro';
    const isActive = subscriptionStatus?.has_subscription === true && subscriptionStatus?.is_active === true;

    return {
      planId,
      tier,
      isPlus,
      isPro,
      isActive
    };
  }, [subscriptionStatus]);

  const hasSmartCoachAccess = (accessInfo.isPlus || accessInfo.isPro) && (
    accessInfo.isActive || accessInfo.isPlus
  );

  const isFreeUser = !hasSmartCoachAccess;

  // Function to start tour manually - MUST be before early return
  const startTour = useCallback(() => {
    try {
      // Clear dismissed flag so tour can show
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem('smart-coach-tour-dismissed');
      }
    } catch (err) {
      console.error('Error clearing tour flag:', err);
    }
    // Mark as manually started (not auto-started) so scrolling works normally
    isAutoStartedTour.current = false;
    // Force start tour
    setSmartCoachTourStep(0);
    smartCoachTourStepRef.current = 0;
  }, []);

  // Expose tour start function to window for debugging - MUST be before early return
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.startSmartCoachTour = startTour;
    }
    return () => {
      if (typeof window !== 'undefined' && window.startSmartCoachTour === startTour) {
        delete window.startSmartCoachTour;
      }
    };
  }, [startTour]);

  // Early return AFTER all hooks - this ensures all hooks are called in the same order every render
  if (isLoading) {
    return <SmartCoachSkeleton isDarkMode={isDarkMode} isMobile={isMobile} />;
  }

  // Choose styles based on screen size
  const currentStyles = isMobile ? mobileStyles : styles;

  // Derived subject lists and filtered arrays (no useMemo to keep simple)
  const strengthSubjects = Array.from(new Set((performanceData?.strengths || []).map(s => s?.subject).filter(Boolean)));
  const improvementSubjects = Array.from(new Set((performanceData?.areasForImprovement || []).map(a => a?.subject).filter(Boolean)));

  const displayedStrengths = (performanceData?.strengths || []).filter(s =>
    strengthSubjectFilter === 'All' || s?.subject === strengthSubjectFilter
  );
  const displayedImprovements = (performanceData?.areasForImprovement || []).filter(a =>
    improvementSubjectFilter === 'All' || a?.subject === improvementSubjectFilter
  );

  // Render time label on two lines when it includes hours to prevent overlap in narrow columns
  const renderTimeLabel = (txt) => {
    if (!txt || typeof txt !== 'string') return '0 mins';
    const hMatch = txt.match(/(\d+)\s*hr/);
    const mMatch = txt.match(/(\d+)\s*min/);
    const h = hMatch ? parseInt(hMatch[1], 10) : 0;
    const m = mMatch ? parseInt(mMatch[1], 10) : 0;
    if (h > 0 && m > 0) {
      return (<><span>{`${h} hr${h === 1 ? '' : 's'}`}</span><br /><span>{`${m} mins`}</span></>);
    }
    if (h > 0) return `${h} hr${h === 1 ? '' : 's'}`;
    return `${m} mins`;
  };

  return (
    <div className={`${currentStyles.smartCoachContainer} ${isDarkMode ? currentStyles.darkTheme : currentStyles.lightTheme}`}>
      {/* Header Section */}
      <div ref={headerRef} className={`${currentStyles.header} ${isFreeUser ? currentStyles.lockedBlur : ''}`}>
        <div className={currentStyles.headerContent}>
          <div className={currentStyles.titleSection}>
            <h1 className={currentStyles.mainTitle}>Smart Coach Analytics</h1>
            <p className={currentStyles.subtitle}>Your personalized learning insights and performance analysis.</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div ref={kpiSectionRef} className={`${currentStyles.kpiSection} ${isFreeUser ? currentStyles.lockedBlur : ''}`}>
        <div ref={overallScoreCardRef} className={currentStyles.kpiCard}>
          <div className={currentStyles.kpiIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className={currentStyles.kpiContent}>
            <div className={currentStyles.kpiValue}>{performanceData.overallScore}%</div>
            <div className={currentStyles.kpiLabel}>Overall Score</div>
          </div>
        </div>

        <div ref={classRankCardRef} className={currentStyles.kpiCard}>
          <div className={currentStyles.kpiIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </div>
          <div className={currentStyles.kpiContent}>
            <div className={currentStyles.kpiValue}>#{performanceData.classRank}</div>
            <div className={currentStyles.kpiLabel}>Class Rank</div>
            <div className={currentStyles.kpiSubtext}>out of {performanceData.totalStudents} students</div>
          </div>
        </div>

        <div ref={studyHoursCardRef} className={currentStyles.kpiCard}>
          <div className={currentStyles.kpiIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v6l4 2"/>
            </svg>
          </div>
          <div className={currentStyles.kpiContent}>
            <div className={currentStyles.kpiValue}>{renderTimeLabel(performanceData.performanceMetrics.studyHours.youText)}</div>
            <div className={currentStyles.kpiLabel}>Study Hours</div>
            <div className={currentStyles.kpiSubtext}>this week{streakTier ? ` · ${streakTier}` : ''}</div>
          </div>
        </div>

        <div ref={completionCardRef} className={currentStyles.kpiCard}>
          <div className={currentStyles.kpiIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8B5CF6" strokeWidth="2">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
          </div>
          <div className={currentStyles.kpiContent}>
            <div className={currentStyles.kpiValue}>{performanceData.completionRate}%</div>
            <div className={currentStyles.kpiLabel}>Completion</div>
            <div className={currentStyles.kpiSubtext}>quizzes</div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className={`${currentStyles.mainGrid} ${isFreeUser ? currentStyles.lockedBlur : ''}`}>
        {/* Subject Performance - Full Width at Top */}
        <div className={currentStyles.fullWidthSection}>
          <div ref={subjectPerformanceRef} className={currentStyles.section}>
            <h3 className={currentStyles.sectionTitle}>Subject Performance</h3>
            <div className={currentStyles.subjectsList}>
              {performanceData.subjects && performanceData.subjects.length > 0 ? (
                performanceData.subjects.map((subject, index) => (
                  <div key={index} className={currentStyles.subjectItem}>
                    <div className={currentStyles.subjectInfo}>
                      <div className={currentStyles.subjectIcon}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                          <polyline points="14,2 14,8 20,8"/>
                          <line x1="16" y1="13" x2="8" y2="13"/>
                          <line x1="16" y1="17" x2="8" y2="17"/>
                          <polyline points="10,9 9,9 8,9"/>
                        </svg>
                      </div>
                      <span className={currentStyles.subjectName}>{subject?.name || 'Unknown Subject'}</span>
                    </div>
                    <div className={currentStyles.subjectScore}>
                      <div className={currentStyles.progressBar}>
                        <div 
                          className={`${currentStyles.progressFill} ${
                            subject?.rawScore >= 5
                              ? currentStyles.high
                              : subject?.rawScore >= 3
                                ? currentStyles.medium
                                : currentStyles.low
                          }`} 
                          style={{ width: `${subject?.scorePercent || 0}%` }}
                        ></div>
                      </div>
                      <span className={currentStyles.scoreValue}>{`${subject?.rawScore ?? 0}/5`}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className={currentStyles.emptyState}>
                  <p>No subject performance data available</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Strengths and Areas for Improvement - Side by Side Below */}
        <div className={currentStyles.sideBySideSection}>
          {/* Your Strengths */}
          <div ref={strengthsRef} className={currentStyles.section}>
            <div className={currentStyles.sectionHeader}>
              <h3 className={currentStyles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Your Strengths
              </h3>
              <div className={currentStyles.sectionControls}>
                <div className={currentStyles.selectWrapper}>
                  <select
                    value={strengthSubjectFilter}
                    onChange={(e) => setStrengthSubjectFilter(e.target.value)}
                    className={currentStyles.filterSelect}
                  >
                    <option value="All">All</option>
                    {strengthSubjects.map(subj => (
                      <option key={subj} value={subj}>{subj}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className={currentStyles.strengthsList}>
              {displayedStrengths && displayedStrengths.length > 0 ? (
                displayedStrengths.map((strength, index) => (
                  <div key={index} className={currentStyles.strengthItem}>
                    <div className={currentStyles.strengthInfo}>
                      <h4 className={currentStyles.strengthName}>{strength?.name || 'Unknown Strength'}</h4>
                      <p className={currentStyles.strengthDescription}>{strength?.description || 'No description available'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={currentStyles.emptyState}>
                  <p>No strength data available</p>
                </div>
              )}
            </div>
          </div>

          {/* Areas for Improvement */}
          <div ref={improvementsRef} className={currentStyles.section}>
            <div className={currentStyles.sectionHeader}>
              <h3 className={currentStyles.sectionTitle}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                Areas for Improvement
              </h3>
              <div className={currentStyles.sectionControls}>
                <div className={currentStyles.selectWrapper}>
                  <select
                    value={improvementSubjectFilter}
                    onChange={(e) => setImprovementSubjectFilter(e.target.value)}
                    className={currentStyles.filterSelect}
                  >
                    <option value="All">All</option>
                    {improvementSubjects.map(subj => (
                      <option key={subj} value={subj}>{subj}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className={currentStyles.improvementList}>
              {displayedImprovements && displayedImprovements.length > 0 ? (
                displayedImprovements.map((area, index) => (
                  <div key={index} className={currentStyles.improvementItem}>
                    <div className={currentStyles.improvementInfo}>
                      <h4 className={currentStyles.improvementName}>{area?.name || 'Unknown Area'}</h4>
                      <p className={currentStyles.improvementDescription}>{area?.description || 'No description available'}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={currentStyles.emptyState}>
                  <p>No improvement areas identified</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Performance Comparison Section - Full Width */}
        <div className={currentStyles.performanceComparisonSection}>
          <div ref={performanceComparisonRef} className={currentStyles.performanceComparisonContainer}>
            <h3 className={currentStyles.performanceComparisonTitle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3B82F6" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="8.5" cy="7" r="4"/>
                <path d="M20 8v6"/>
                <path d="M23 11h-6"/>
              </svg>
              Your Performance
            </h3>
            
            {/* Legend */}
            <div className={currentStyles.legend}>
              <div className={currentStyles.legendItem}>
                <div className={`${currentStyles.legendDot} ${currentStyles.you}`}></div>
                <span>Your Performance</span>
              </div>
              <div className={currentStyles.legendItem}>
                <div className={`${currentStyles.legendDot} ${currentStyles.topper}`}></div>
                <span>Class Topper</span>
              </div>
            </div>
            
            <div className={currentStyles.barChartContainer}>
              {/* Study Hours Bar Chart */}
              <div className={currentStyles.barChartItem}>
                <div className={currentStyles.barChartLabel}>Study Hours/Week</div>
                <div className={currentStyles.barChart}>
                  <div className={currentStyles.barChartBars}>
                    <div className={currentStyles.barChartBar}>
                      <div className={currentStyles.barChartBarContainer}>
                        <div 
                          className={`${currentStyles.barChartBarFill} ${currentStyles.you}`}
                          style={{height: `${Math.min(100, (performanceData.performanceMetrics.studyHours.you / Math.max(1, performanceData.performanceMetrics.studyHours.topper || 1)) * 100)}%`}}
                        ></div>
                      </div>
                      <div className={currentStyles.barChartBarValue}>{renderTimeLabel(performanceData.performanceMetrics.studyHours.youText)}</div>
                      <div className={currentStyles.barChartBarLabel}>You</div>
                    </div>
                    <div className={currentStyles.barVs}>vs</div>
                    <div className={currentStyles.barChartBar}>
                      <div className={currentStyles.barChartBarContainer}>
                        <div 
                          className={`${currentStyles.barChartBarFill} ${currentStyles.topper}`}
                          style={{height: `${Math.min(100, (performanceData.performanceMetrics.studyHours.topper / Math.max(1, performanceData.performanceMetrics.studyHours.topper || 1)) * 100)}%`}}
                        ></div>
                      </div>
                      <div className={currentStyles.barChartBarValue}>{renderTimeLabel(performanceData.performanceMetrics.studyHours.topperText)}</div>
                      <div className={currentStyles.barChartBarLabel}>Topper</div>
                    </div>
                  </div>
                </div>
              </div>


              {/* Quiz Performance Bar Chart */}
              <div className={currentStyles.barChartItem}>
                <div className={currentStyles.barChartLabel}>Quiz Performance</div>
                <div className={currentStyles.barChart}>
                  <div className={currentStyles.barChartBars}>
                    <div className={currentStyles.barChartBar}>
                      <div className={currentStyles.barChartBarContainer}>
                        <div 
                          className={`${currentStyles.barChartBarFill} ${currentStyles.you}`}
                          style={{height: `${performanceData.performanceMetrics.quizzes.you}%`}}
                        ></div>
                      </div>
                      <div className={currentStyles.barChartBarValue}>{performanceData.performanceMetrics.quizzes.you}%</div>
                      <div className={currentStyles.barChartBarLabel}>You</div>
                    </div>
                    <div className={currentStyles.barVs}>vs</div>
                    <div className={currentStyles.barChartBar}>
                      <div className={currentStyles.barChartBarContainer}>
                        <div 
                          className={`${currentStyles.barChartBarFill} ${currentStyles.topper}`}
                          style={{height: `${topperData ? topperData.quiz_performance_topper : 0}%`}}
                        ></div>
                      </div>
                      <div className={currentStyles.barChartBarValue}>{topperData ? topperData.quiz_performance_topper : 0}%</div>
                      <div className={currentStyles.barChartBarLabel}>Topper</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Daily Progress Bar Chart */}
              <div className={currentStyles.barChartItem}>
                <div className={currentStyles.barChartLabel}>Daily Progress</div>
                <div className={currentStyles.barChart}>
                  <div className={currentStyles.barChartBars}>
                    {(() => {
                      const youCount = performanceData?.performanceMetrics?.participation?.you || 0;
                      const topperCount = performanceData?.performanceMetrics?.participation?.topper || 0;
                      const denom = Math.max(1, youCount, topperCount);
                      const youHeight = Math.min(100, (youCount / denom) * 100);
                      const topperHeight = Math.min(100, (topperCount / denom) * 100);
                      return (
                        <>
                          <div className={currentStyles.barChartBar}>
                            <div className={currentStyles.barChartBarContainer}>
                              <div 
                                className={`${currentStyles.barChartBarFill} ${currentStyles.you}`}
                                style={{height: `${youHeight}%`}}
                              ></div>
                            </div>
                            <div className={currentStyles.barChartBarValue}>{youCount}</div>
                            <div className={currentStyles.barChartBarLabel}>You</div>
                          </div>
                          <div className={currentStyles.barVs}>vs</div>
                          <div className={currentStyles.barChartBar}>
                            <div className={currentStyles.barChartBarContainer}>
                              <div 
                                className={`${currentStyles.barChartBarFill} ${currentStyles.topper}`}
                                style={{height: `${topperHeight}%`}}
                              ></div>
                            </div>
                            <div className={currentStyles.barChartBarValue}>{topperCount}</div>
                            <div className={currentStyles.barChartBarLabel}>Topper</div>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

                 {/* Personalized Insights Section - Full Width (Dynamic from backend data) */}
        <section ref={insightsRef} className={currentStyles.insightsSection}>
          <div className={currentStyles.insightsContainer}>
            <h3 className={currentStyles.insightsTitle}>Personalized Insights</h3>
            {insights && insights.length > 0 ? (
              <div className={currentStyles.insightsList}>
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`${currentStyles.insightItem} ${currentStyles[insight.type]}`}
                  >
                    <div className={currentStyles.insightIcon}>
                      {insight.type === 'positive' && <span>✅</span>}
                      {insight.type === 'warning' && <span>⚠️</span>}
                    </div>
                    <div className={currentStyles.insightContent}>
                      <h4 className={currentStyles.insightTitle}>{insight.title}</h4>
                      <p className={currentStyles.insightDescription}>{insight.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={currentStyles.emptyState}>No insights yet — complete more activities to unlock insights.</p>
            )}
          </div>
        </section>
       </div>

      {/* Smart Coach Tour Overlay */}
      {(smartCoachTourStep >= 0 && typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) ? ReactDOM.createPortal(
        (() => {
          const getRect = (el) => {
            if (!el) return null;
            try { 
              const rect = el.getBoundingClientRect();
              // Return the basic bounding rect - let each step calculate its own dimensions
              // This ensures we get the exact element position
              return rect;
            } catch { return null; }
          };
          
          let highlightRect = null;
          const step = smartCoachTourStep; // Use state directly instead of ref
          // tourForceUpdate ensures recalculation on resize/zoom - accessing it here triggers re-render
          const _ = tourForceUpdate; // Use the value to ensure dependency tracking
          console.log('🎯 Tour Portal Rendering - Step:', step, 'Update:', _);
          
          // Map tour steps to refs and calculate highlight rectangles
          let targetElement = null;
          if (step === 0) {
            // Step 0: Highlight both header and KPI section together as ONE unified area
            const headerElement = headerRef.current;
            const kpiElement = kpiSectionRef.current;
            const headerRect = getRect(headerElement);
            const kpiRect = getRect(kpiElement);
            
            if (headerRect && kpiRect) {
              // Calculate combined rectangle that treats header and KPI as ONE continuous section
              const top = headerRect.top;
              const left = Math.min(headerRect.left, kpiRect.left);
              const right = Math.max(headerRect.right, kpiRect.right);
              const bottom = kpiRect.bottom;
              
              const padding = 12;
              highlightRect = {
                top: top - padding,
                left: left - padding,
                right: right + padding,
                bottom: bottom + padding,
                width: right - left + (padding * 2),
                height: bottom - top + (padding * 2)
              };
            } else if (headerRect && headerElement) {
              const fullHeight = Math.max(headerRect.height, headerElement.scrollHeight || 0);
              const fullWidth = Math.max(headerRect.width, headerElement.scrollWidth || 0);
              highlightRect = {
                top: headerRect.top,
                left: headerRect.left,
                right: headerRect.left + fullWidth,
                bottom: headerRect.top + fullHeight,
                width: fullWidth,
                height: fullHeight
              };
            } else if (kpiRect && kpiElement) {
              const fullHeight = Math.max(kpiRect.height, kpiElement.scrollHeight || 0);
              const fullWidth = Math.max(kpiRect.width, kpiElement.scrollWidth || 0);
              highlightRect = {
                top: kpiRect.top,
                left: kpiRect.left,
                right: kpiRect.left + fullWidth,
                bottom: kpiRect.top + fullHeight,
                width: fullWidth,
                height: fullHeight
              };
            }
          } else if (step === 1) {
            targetElement = subjectPerformanceRef.current;
            const rect = getRect(targetElement);
            if (rect && targetElement) {
              // Use scrollHeight to ensure we capture full content
              const fullHeight = Math.max(rect.height, targetElement.scrollHeight || 0);
              const fullWidth = Math.max(rect.width, targetElement.scrollWidth || 0);
              
              highlightRect = {
                top: rect.top,
                left: rect.left,
                right: rect.left + fullWidth,
                bottom: rect.top + fullHeight,
                width: fullWidth,
                height: fullHeight
              };
            }
          } else if (step === 2) {
            targetElement = strengthsRef.current;
            const rect = getRect(targetElement);
            if (rect && targetElement) {
              // Use the same simple approach as step 1 for smooth, consistent behavior
              // getBoundingClientRect() already includes padding, border, and content
              // Use scrollHeight to ensure we capture full content including all items
              const fullHeight = Math.max(rect.height, targetElement.scrollHeight || 0);
              const fullWidth = Math.max(rect.width, targetElement.scrollWidth || 0);
              
              highlightRect = {
                top: rect.top,
                left: rect.left,
                right: rect.left + fullWidth,
                bottom: rect.top + fullHeight,
                width: fullWidth,
                height: fullHeight
              };
            }
          } else if (step === 3) {
            targetElement = improvementsRef.current;
            const rect = getRect(targetElement);
            if (rect && targetElement) {
              // Use scrollHeight to ensure we capture full content (like step 4)
              const fullHeight = Math.max(rect.height, targetElement.scrollHeight || 0);
              const fullWidth = Math.max(rect.width, targetElement.scrollWidth || 0);
              
              highlightRect = {
                top: rect.top,
                left: rect.left,
                right: rect.left + fullWidth,
                bottom: rect.top + fullHeight,
                width: fullWidth,
                height: fullHeight
              };
            }
          } else if (step === 4) {
            targetElement = performanceComparisonRef.current;
            const rect = getRect(targetElement);
            if (rect && targetElement) {
              // Use scrollHeight to ensure we capture full content
              const fullHeight = Math.max(rect.height, targetElement.scrollHeight || 0);
              const fullWidth = Math.max(rect.width, targetElement.scrollWidth || 0);
              
              highlightRect = {
                top: rect.top,
                left: rect.left,
                right: rect.left + fullWidth,
                bottom: rect.top + fullHeight,
                width: fullWidth,
                height: fullHeight
              };
            }
          } else if (step === 5) {
            targetElement = insightsRef.current;
            const rect = getRect(targetElement);
            if (rect && targetElement) {
              // Use scrollHeight to ensure we capture full content (like step 4)
              const fullHeight = Math.max(rect.height, targetElement.scrollHeight || 0);
              const fullWidth = Math.max(rect.width, targetElement.scrollWidth || 0);
              
              highlightRect = {
                top: rect.top,
                left: rect.left,
                right: rect.left + fullWidth,
                bottom: rect.top + fullHeight,
                width: fullWidth,
                height: fullHeight
              };
            }
          } else if (step === 6) {
            highlightRect = null; // Final step - centered
          }

          // Clamp highlightRect to viewport bounds (like Overview component does)
          if (highlightRect && typeof window !== 'undefined') {
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            highlightRect = {
              top: Math.max(0, highlightRect.top),
              left: Math.max(0, highlightRect.left),
              right: Math.min(viewportWidth, highlightRect.right),
              bottom: Math.min(viewportHeight, highlightRect.bottom),
              width: Math.min(viewportWidth, highlightRect.width),
              height: Math.min(viewportHeight, highlightRect.height)
            };
          }

          // Position the tooltip card
          const gutter = isMobile ? 12 : 16;
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
          
          // Mobile-optimized card sizing
          let cardWidth = isMobile ? Math.min(vw * 0.85, 360) : 400;
          const maxWidth = isMobile ? 360 : 450;
          
          if (step === 6) {
            cardWidth = Math.min(vw * 0.9, maxWidth);
          }
          
          // Estimate card height for positioning (card will grow with content, max 85vh on mobile)
          const baseCardHeight = step === 6 ? 220 : 200;
          const estimatedCardHeight = isMobile 
            ? Math.min(baseCardHeight + 30, vh * 0.85) // Extra height for mobile, but respect maxHeight
            : baseCardHeight;
          
          let cardLeft = (vw - cardWidth) / 2;
          let cardTop = (vh - estimatedCardHeight) / 2;
          
          // Handle final step (centered)
          if (step === 6) {
            cardLeft = (vw - cardWidth) / 2;
            cardTop = Math.max(gutter, Math.min((vh - estimatedCardHeight) / 2, vh - estimatedCardHeight - gutter));
          } else if (highlightRect) {
            if (isMobile) {
              // On mobile, always center the card below the highlight for better UX
              const belowTop = highlightRect.bottom + gutter;
              const belowLeft = (vw - cardWidth) / 2;
              
              // Use maxHeight (85vh) as the constraint for positioning
              const maxCardHeight = vh * 0.85;
              const cardHeightForPositioning = Math.min(estimatedCardHeight, maxCardHeight);
              
              if (belowTop + cardHeightForPositioning + gutter <= vh) {
                cardTop = belowTop;
                cardLeft = Math.max(gutter, Math.min(belowLeft, vw - cardWidth - gutter));
              } else {
                // If below doesn't fit, try above
                const aboveTop = highlightRect.top - cardHeightForPositioning - gutter;
                if (aboveTop >= gutter) {
                  cardTop = aboveTop;
                  cardLeft = Math.max(gutter, Math.min((vw - cardWidth) / 2, vw - cardWidth - gutter));
                } else {
                  // Fallback: center it with viewport constraints
                  cardLeft = (vw - cardWidth) / 2;
                  cardTop = Math.max(gutter, Math.min((vh - cardHeightForPositioning) / 2, vh - cardHeightForPositioning - gutter));
                }
              }
            } else {
              // Desktop: Position card to flow properly relative to the highlighted area
              // Prefer positioning card to the right side of the highlighted area
              const rightSideLeft = highlightRect.right + gutter;
              const rightSideTop = highlightRect.top + (highlightRect.height / 2) - (estimatedCardHeight / 2);
              
              // Check if right side has enough space
              if (rightSideLeft + cardWidth + gutter <= vw) {
                cardLeft = rightSideLeft;
                cardTop = Math.max(gutter, Math.min(rightSideTop, vh - estimatedCardHeight - gutter));
              } else {
                // If right side doesn't fit, try below the highlighted area
                const belowTop = highlightRect.bottom + gutter;
                const belowLeft = highlightRect.left + (highlightRect.width / 2) - (cardWidth / 2);
                
                if (belowTop + estimatedCardHeight + gutter <= vh) {
                  cardTop = belowTop;
                  cardLeft = Math.max(gutter, Math.min(belowLeft, vw - cardWidth - gutter));
                } else {
                  // Fallback: center it if no good position found
                  cardLeft = (vw - cardWidth) / 2;
                  cardTop = Math.max(gutter, Math.min((vh - estimatedCardHeight) / 2, vh - estimatedCardHeight - gutter));
                }
              }
            }
            
            // Ensure card doesn't overlap highlighted area with a safety check
            const cardRight = cardLeft + cardWidth;
            const maxCardHeight = isMobile ? vh * 0.85 : estimatedCardHeight;
            const cardBottom = cardTop + Math.min(estimatedCardHeight, maxCardHeight);
            const margin = 8; // Minimum gap between card and highlight
            
            if (cardRight > highlightRect.left - margin && 
                cardLeft < highlightRect.right + margin &&
                cardBottom > highlightRect.top - margin && 
                cardTop < highlightRect.bottom + margin) {
              // Card overlaps, adjust position
              if (isMobile) {
                // On mobile, just center it if it overlaps
                cardLeft = (vw - cardWidth) / 2;
                const safeCardHeight = Math.min(estimatedCardHeight, vh * 0.85);
                cardTop = Math.max(gutter, Math.min((vh - safeCardHeight) / 2, vh - safeCardHeight - gutter));
              } else {
                if (cardLeft < highlightRect.right) {
                  // Card is on left or overlapping from left, move to right
                  cardLeft = highlightRect.right + gutter;
                } else {
                  // Card is on right or overlapping from right, move to left
                  cardLeft = highlightRect.left - cardWidth - gutter;
                }
                // Clamp to viewport
                cardLeft = Math.max(gutter, Math.min(cardLeft, vw - cardWidth - gutter));
              }
            }
          }

          return (
            <div
              className={`${currentStyles.smartCoachTourOverlay} ${isDarkMode ? currentStyles.darkTheme : currentStyles.lightTheme}`}
              role="dialog"
              aria-modal="true"
              style={(highlightRect && step !== 6) ? { background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' } : undefined}
            >
              {(highlightRect && step !== 6) ? (
                <>
                  {/* Top cover */}
                  <div style={{ position: 'fixed', inset: `0 0 ${window.innerHeight - highlightRect.top}px 0`, height: `${highlightRect.top}px`, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  {/* Bottom cover */}
                  <div style={{ position: 'fixed', top: `${highlightRect.bottom}px`, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  {/* Left cover */}
                  <div style={{ position: 'fixed', top: `${highlightRect.top}px`, bottom: `${window.innerHeight - highlightRect.bottom}px`, left: 0, width: `${highlightRect.left}px`, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                  {/* Right cover */}
                  <div style={{ position: 'fixed', top: `${highlightRect.top}px`, bottom: `${window.innerHeight - highlightRect.bottom}px`, left: `${highlightRect.right}px`, right: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201, transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />

                  {/* Highlight outline - unified border for sections */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'fixed',
                      // Position exactly at element bounds - box-shadow extends 4px outward
                      top: `${highlightRect.top}px`,
                      left: `${highlightRect.left}px`,
                      width: `${highlightRect.width}px`,
                      height: `${highlightRect.height}px`,
                      borderRadius: step === 0 ? '16px' : '12px',
                      boxShadow: '0 0 0 4px rgba(250,204,21,0.95), 0 20px 50px rgba(59,130,246,0.25), inset 0 0 0 1px rgba(250,204,21,0.3)',
                      pointerEvents: 'none',
                      zIndex: 1202,
                      transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxSizing: 'border-box'
                    }}
                  />
                </>
              ) : (
                step === 6 ? <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.4)', backdropFilter: 'blur(1px)', transition: 'opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} /> : null
              )}
              <div 
                className={currentStyles.smartCoachTourCard} 
                style={{ 
                  width: `${cardWidth}px`,
                  maxWidth: isMobile ? '360px' : '450px',
                  height: 'auto',
                  maxHeight: isMobile ? '75vh' : '80vh',
                  overflowY: 'auto',
                  WebkitOverflowScrolling: 'touch',
                  position: 'fixed', 
                  left: `${cardLeft}px`, 
                  top: `${cardTop}px`, 
                  zIndex: 1203,
                  display: 'block !important',
                  visibility: 'visible !important',
                  opacity: '1 !important',
                  pointerEvents: 'auto',
                  margin: '0',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                data-tour-step={smartCoachTourStep}
              >
                {/* Step indicator */}
                <div style={{ 
                  fontSize: isMobile ? '11px' : '12px', 
                  fontWeight: '600', 
                  color: isDarkMode ? '#9ca3af' : '#6b7280', 
                  marginBottom: isMobile ? '6px' : '8px',
                  textAlign: 'left'
                }}>
                  Step {step + 1} of 7
                </div>

                {step === 0 && (
                  <>
                    <div className={currentStyles.smartCoachTourTitle}>Welcome to Smart Coach! 🎯</div>
                    <div className={currentStyles.smartCoachTourText} style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '0' }}>
                        Your dashboard shows key metrics at a glance: Overall Score, Class Rank, Study Hours, and Quiz Completion. Track your progress and see how you're performing!
                      </p>
                    </div>
                  </>
                )}

                {step === 1 && (
                  <>
                    <div className={currentStyles.smartCoachTourTitle}>Subject Performance</div>
                    <div className={currentStyles.smartCoachTourText} style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '0' }}>
                        See your performance across different subjects and topics. Each subject shows your average score out of 5, helping you identify which areas need more attention and which topics you're mastering.
                      </p>
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div className={currentStyles.smartCoachTourTitle}>Your Strengths</div>
                    <div className={currentStyles.smartCoachTourText} style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '0' }}>
                        These are topics where you're performing well! Focus on maintaining these strengths while improving weaker areas. You can filter by subject to see strengths in specific areas.
                      </p>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div className={currentStyles.smartCoachTourTitle}>Areas for Improvement</div>
                    <div className={currentStyles.smartCoachTourText} style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '0' }}>
                        These topics need more practice. Review the notes, watch videos, and take quizzes to improve your understanding. You can filter by subject to focus on specific improvement areas.
                      </p>
                    </div>
                  </>
                )}

                {step === 4 && (
                  <>
                    <div className={currentStyles.smartCoachTourTitle}>Performance Comparison</div>
                    <div className={currentStyles.smartCoachTourText} style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '0' }}>
                        Compare your study hours, quiz performance, and daily progress with the class topper. Use this comparison to set realistic goals and track your progress over time.
                      </p>
                    </div>
                  </>
                )}

                {step === 5 && (
                  <>
                    <div className={currentStyles.smartCoachTourTitle}>Personalized Insights</div>
                    <div className={currentStyles.smartCoachTourText} style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '0' }}>
                        Get AI-powered recommendations based on your learning patterns. These insights help you study smarter, not harder, by identifying consistent study patterns and areas that need attention.
                      </p>
                    </div>
                  </>
                )}

                {step === 6 && (
                  <>
                    <div className={currentStyles.smartCoachTourTitle}>Explore More & Learn Smoothly 📚</div>
                    <div className={currentStyles.smartCoachTourText} style={{ textAlign: 'left', lineHeight: '1.6' }}>
                      <p style={{ marginBottom: '0' }}>
                        You're all set! Smart Coach updates in real-time as you complete quizzes and study. Check back regularly to track your progress and discover new insights to improve your learning journey.
                      </p>
                    </div>
                  </>
                )}

                {/* Navigation buttons */}
                {step >= 0 && step < 6 && (
                  <div style={{ 
                    display: 'flex', 
                    gap: isMobile ? 8 : 8, 
                    marginTop: isMobile ? 12 : 16, 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    flexDirection: isMobile ? 'column' : 'row'
                  }}>
                    <button 
                      style={{
                        background: 'transparent',
                        color: isDarkMode ? '#9ca3af' : '#6b7280',
                        border: `1px solid ${isDarkMode ? 'rgba(156, 163, 175, 0.3)' : 'rgba(107, 114, 128, 0.3)'}`,
                        padding: isMobile ? '10px 20px' : '10px 18px',
                        borderRadius: isMobile ? '8px' : '9999px',
                        cursor: 'pointer',
                        fontSize: isMobile ? '13px' : '14px',
                        fontWeight: isMobile ? '600' : '500',
                        transition: 'all 0.2s ease',
                        minHeight: isMobile ? '40px' : '36px',
                        width: isMobile ? '100%' : 'auto',
                        textAlign: 'center',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onMouseOver={(e) => {
                        e.target.style.color = isDarkMode ? '#d1d5db' : '#374151';
                        e.target.style.borderColor = isDarkMode ? 'rgba(209, 213, 219, 0.5)' : 'rgba(55, 65, 81, 0.5)';
                      }}
                      onMouseOut={(e) => {
                        e.target.style.color = isDarkMode ? '#9ca3af' : '#6b7280';
                        e.target.style.borderColor = isDarkMode ? 'rgba(156, 163, 175, 0.3)' : 'rgba(107, 114, 128, 0.3)';
                      }}
                      onClick={() => {
                        setSmartCoachTourStep(-1);
                        try {
                          if (typeof window !== 'undefined') {
                            window.localStorage.setItem('smart-coach-tour-dismissed', 'true');
                            // Clear onboarding flag after tour is dismissed
                            window.localStorage.removeItem('onboarding-just-completed');
                            window.localStorage.removeItem('show-smart-coach-tour');
                          }
                        } catch {}
                      }}
                    >
                      Skip Tour
                    </button>
                    <button 
                      className={currentStyles.smartCoachTourCTA} 
                      style={{
                        width: isMobile ? '100%' : 'auto',
                        order: isMobile ? -1 : 0 // Show Next button first on mobile
                      }}
                      onClick={() => {
                        const currentStep = smartCoachTourStep;
                        const nextStep = currentStep + 1;
                        console.log(`🎯 Smart Coach Tour: Moving from step ${currentStep} to step ${nextStep}`);
                        setSmartCoachTourStep(nextStep);
                        smartCoachTourStepRef.current = nextStep;
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
                {step === 6 && (
                  <button
                    className={currentStyles.smartCoachTourCTA}
                    style={{
                      width: isMobile ? '100%' : 'auto'
                    }}
                    onClick={() => {
                      setSmartCoachTourStep(-1);
                      try {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('smart-coach-tour-dismissed', 'true');
                        }
                      } catch {}
                    }}
                  >
                    Got it
                  </button>
                )}
              </div>
            </div>
          );
        })(),
        document.body)
      : null}

      {isFreeUser && (
        <div className={currentStyles.lockOverlay}>
          <div className={currentStyles.lockModal} role="dialog" aria-modal="true" aria-labelledby="smartCoachLockedTitle">
            <div className={currentStyles.lockIcon}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3 id="smartCoachLockedTitle" className={currentStyles.lockTitle}>Smart Coach is locked</h3>
            <p className={currentStyles.lockDesc}>Upgrade to Premium to unlock Smart Coach analytics.</p>
            <button
              type="button"
              className={currentStyles.upgradeButton}
              onClick={() => setShowUpgrade(true)}
            >
              Upgrade to Premium
            </button>
          </div>
        </div>
      )}
    </div>
  );
}



