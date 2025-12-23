 "use client";
 
import React, { useState, useEffect, useMemo, memo, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { useRouter } from 'next/navigation';
import { useDashboard } from '../hooks/useDashboard';
import { useSubscription } from '../hooks/useSubscription';
// Removed: subjects.js - using curriculum API instead
import { Medal, Trophy } from 'lucide-react';
import styles from './Overview.module.css';
import mobileStyles from './overviewmobile.module.css';

const LightningIcon = ({ className = "", color = "#9ca3af", size = "16", strokeWidth = "2" }) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
  </svg>
);

const Overview = ({ userId }) => {
  const router = useRouter();
  const [currentSubjectIndex, setCurrentSubjectIndex] = useState(0);
  const [showAllGoals, setShowAllGoals] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const carouselContentRef = useRef(null);
  const desktopCarouselContentRef = useRef(null);
  const premiumCardRef = useRef(null);
  const streakCardRef = useRef(null);
  const goalsCardRef = useRef(null);
  const subjectCardRef = useRef(null);
  const startButtonRef = useRef(null);
  const leaderboardCardRef = useRef(null);
  const tourTooltipRef = useRef(null);
  const [showDashboardTour, setShowDashboardTour] = useState(false);
  const [hasDismissedDashboardTour, setHasDismissedDashboardTour] = useState(() => {
    if (typeof window === 'undefined') return false;
    const legacyDismissed = window.localStorage.getItem('dashboard-streak-tour-dismissed');
    if (legacyDismissed === 'true') {
      return true;
    }
    return window.localStorage.getItem('dashboard-tour-dismissed') === 'true';
  });
  const [dashboardTourStepIndex, setDashboardTourStepIndex] = useState(0);
  const [showFinalPrompt, setShowFinalPrompt] = useState(false);
  const [enableStartStep, setEnableStartStep] = useState(false);
  const [tourTooltipPlacement, setTourTooltipPlacement] = useState(null);
  const [tourCardRect, setTourCardRect] = useState(null);
  const [tourHighlightRect, setTourHighlightRect] = useState(null);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [tourArrowPath, setTourArrowPath] = useState('');

  // Mobile detection
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)');
    const checkMobile = () => setIsMobile(mq.matches);

    // Initial check
    checkMobile();

    // Listen to viewport changes
    if (mq.addEventListener) {
      mq.addEventListener('change', checkMobile);
    } else if (mq.addListener) {
      // Safari fallback
      mq.addListener(checkMobile);
    }

    const onResize = () => checkMobile();
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', checkMobile);
      } else if (mq.removeListener) {
        mq.removeListener(checkMobile);
      }
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // Use the dashboard hook to fetch real data with proper loading states
  const {
    dashboardData,
    todayGoals,
    leaderboard,
    userInfo,
    dailyStreak,
    weeklyStreak,
    isLoading,
    error,
    progressPercentage,
    goalsLoaded,
    checkAndUpdateQuizCompletion,
    markQuizCompleted
  } = useDashboard(userId);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(isLoading ? 'page-skeleton-start' : 'page-skeleton-end'));
      }
    } catch {}
  }, [isLoading]);

  // Use subscription hook to check premium status
  const { subscriptionStatus, loading: subscriptionLoading } = useSubscription();

  const hasPremiumAccess = useMemo(() => {
    if (subscriptionLoading) {
      return false;
    }

    if (subscriptionStatus?.status === null || subscriptionStatus?.has_subscription === null) {
      return false;
    }

    if (subscriptionStatus?.has_subscription === true && subscriptionStatus?.is_active === true) {
      console.log(' User has active subscription - hiding premium card');
      return true;
    }

    const premiumStatuses = ['premium', 'active'];
    if (premiumStatuses.includes(subscriptionStatus?.status) ||
        premiumStatuses.includes(subscriptionStatus?.subscription_status)) {
      console.log(' User has premium status - hiding premium card');
      return true;
    }

    if (subscriptionStatus?.plan_name) {
      console.log(' User has plan name - treating as premium');
      return true;
    }

    if (subscriptionStatus?.trial_expired === false) {
      return true;
    }

    return false;
  }, [subscriptionLoading, subscriptionStatus]);
  // Subjects will be supplied by new logic; keep empty for now
  const subjects = useMemo(() => [], []);
 
  // Format leaderboard data
  const formattedLeaderboard = useMemo(() => {
    // Return empty array if no leaderboard or userInfo
    if (!leaderboard || leaderboard.length === 0 || !userInfo?.name) {
      return [];
    }
 
    // Find current user's actual rank - handle case sensitivity and whitespace
    const currentUserName = userInfo.name.trim();
    const currentUserIndex = leaderboard.findIndex(user =>
      user.name && user.name.trim().toLowerCase() === currentUserName.toLowerCase()
    );
   
    const currentUserRank = currentUserIndex >= 0 ? currentUserIndex + 1 : leaderboard.length + 1;
    const currentUser = currentUserIndex >= 0 ? leaderboard[currentUserIndex] : null;
 
    // Get top 5 users (including current user if they're in top 5)
    const top5Users = leaderboard.slice(0, 5).map((user, index) => {
      const isCurrentUserInTop5 = user.name && user.name.trim().toLowerCase() === currentUserName.toLowerCase();
      return {
        rank: index + 1,
        name: user.name || "Anonymous",
        xp: user.xp?.toLocaleString() || "0",
        isTop: index < 3,
        isCurrentUser: false, // Never highlight in top 5 - only show rank colors
        showTag: false // Never show tag in top 5
      };
    });
 
    // Always add user's entry at the bottom with actual rank (even if they're already in top 5)
    top5Users.push({
      rank: currentUserRank,
      name: currentUser ? currentUser.name || currentUserName : currentUserName,
      xp: currentUser ? currentUser.xp?.toLocaleString() || "0" : "0",
      isCurrentUser: true,
      showTag: true, // Always show tag at bottom
      isTop: currentUserRank <= 3, // Mark if user is in top 3 for special styling
      isBottomEntry: true // Mark this as bottom entry for special styling
    });
 
    return top5Users;
  }, [leaderboard, userInfo]);
 
  // Get visible goals based on showAllGoals state
  const visibleGoals = useMemo(() => {
    if (!todayGoals) return [];
    if (showAllGoals) {
      return todayGoals; // Show all goals when expanded
    }
    return todayGoals.slice(0, 4); // Show first 4 goals by default
  }, [todayGoals, showAllGoals]);

  const completedGoalsCount = useMemo(() => {
    if (!todayGoals) return 0;
    return todayGoals.filter(goal => goal.completed).length;
  }, [todayGoals]);

  const totalGoalsCount = todayGoals?.length || 0;
  const weeklyActiveDays = useMemo(() => (weeklyStreak || []).filter(Boolean).length, [weeklyStreak]);
  const currentSubject = subjects[currentSubjectIndex] || null;
  const leaderboardSelf = useMemo(
    () => formattedLeaderboard.find(entry => entry.isCurrentUser) || null,
    [formattedLeaderboard]
  );

  const dashboardTourSteps = useMemo(() => {
    // When user clicked "Let's go", only show the Start/Continue button step
    if (enableStartStep) {
      return [{
        id: 'start',
        ref: startButtonRef,
        title: subjects[currentSubjectIndex]?.progress > 0 ? 'Continue where you left' : 'Start your first topic',
        description: 'Tap the Start button to open your course and earn today\'s streak.',
        preferredPlacement: 'top'
      }];
    }

    const steps = [];

    if (!hasPremiumAccess) {
      steps.push({
        id: 'premium',
        ref: premiumCardRef,
        title: 'Unlock premium features',
        description: 'Upgrade to access deeper insights, smart recommendations, and exclusive resources.',
        bullets: [
          'See tailored study plans and AI-powered insights',
          'Practice with premium mock tests and analytics'
        ],
        preferredPlacement: 'bottom'
      });
    }

    steps.push({
      id: 'streak',
      ref: streakCardRef,
      title: 'Protect your streak',
      description: 'Touch the platform before midnight to keep your streak alive—any revision activity counts.',
      bullets: [
        `Current streak: ${dailyStreak?.streak || 0} day${dailyStreak?.streak === 1 ? '' : 's'}`,
        `Active this week: ${weeklyActiveDays}/7`
      ],
      preferredPlacement: 'bottom'
    });

    steps.push({
      id: 'goals',
      ref: goalsCardRef,
      title: "Today's goals",
      description: 'Check off quick wins to keep momentum high. Each goal links directly to the topic you need.',
      bullets: [
        `Completed: ${completedGoalsCount}/${totalGoalsCount}`,
        totalGoalsCount === 0 ? 'No goals yet—generate a plan to get started.' : 'Click any goal to jump straight into the topic.'
      ],
      preferredPlacement: 'right'
    });

    if (currentSubject) {
      steps.push({
        id: 'subject',
        ref: subjectCardRef,
        title: 'Continue your subject',
        description: 'Resume where you left off or explore other subjects in your course.',
        bullets: [
          `Current subject: ${currentSubject.name}`,
          `Progress: ${Math.round(currentSubject.progress || 0)}%`
        ],
        preferredPlacement: 'bottom'
      });
    }

    if (leaderboardSelf) {
      steps.push({
        id: 'leaderboard',
        ref: leaderboardCardRef,
        title: 'Track your rank',
        description: 'Stay motivated by climbing the board. Rankings refresh as you earn XP.',
        bullets: [
          `Your rank: #${leaderboardSelf.rank}`,
          `Total XP: ${leaderboardSelf.xp}`
        ],
        preferredPlacement: 'left'
      });
    }

    return steps;
  }, [
    completedGoalsCount,
    currentSubject,
    dailyStreak?.streak,
    hasPremiumAccess,
    leaderboardSelf,
    premiumCardRef,
    goalsCardRef,
    subjectCardRef,
    leaderboardCardRef,
    streakCardRef,
    totalGoalsCount,
    weeklyActiveDays,
    subjects,
    currentSubjectIndex,
    enableStartStep
  ]);

  const currentTourStep = dashboardTourSteps[dashboardTourStepIndex] || null;

 
  const handleStartSubject = useCallback(() => {
    const currentSubject = subjects[currentSubjectIndex];
    if (currentSubject) {
      // Navigate to subjects page with just the subject code (e.g., "PS101")
      // Extract course code from subject name/title (e.g., "PS101: Human Anatomy and Physiology I" -> "PS101")
      const courseCode = currentSubject.name.split(':')[0].trim();
      // Only set tour flag if onboarding just completed
      const onboardingJustCompleted = typeof window !== 'undefined' 
        ? window.localStorage.getItem('onboarding-just-completed') === 'true'
        : false;
      
      if (onboardingJustCompleted) {
        try { if (typeof window !== 'undefined') { window.localStorage.setItem('show-coursecontent-video-tour', '1'); } } catch {}
      }
      router.push(`/subjects?subject=${encodeURIComponent(courseCode)}`);
    }
  }, [subjects, currentSubjectIndex, router]);
 
  const handleExplorePremium = useCallback(() => {
    router.push('/upgrade');
  }, [router]);

 
  // Handle goal click to navigate to specific topic in CourseContent - Optimized for speed
  const handleGoalClick = useCallback((goal) => {
    console.log(' Goal clicked:', goal);
   
    // Immediate visual feedback - prevent double clicks
    const goalElement = document.querySelector(`[data-goal-id="${goal.id}"]`);
    if (goalElement) {
      goalElement.style.pointerEvents = 'none';
      goalElement.style.opacity = '0.7';
    }
   
    // Extract subject code and topic name from goal - optimized parsing
    let subjectCode = '';
    let topicName = '';
   
    // Fast parsing with early returns
    if (goal.text) {
      const dashIndex = goal.text.indexOf(' - ');
      if (dashIndex > -1) {
        const subjectPart = goal.text.substring(0, dashIndex).replace(/^(Study Session|Review|Practice|Mock Test):\s*/, '');
        topicName = goal.text.substring(dashIndex + 3);
       
        // Quick regex for subject code
        const codeMatch = subjectPart.match(/^([A-Z]{2}\d{3})/);
        if (codeMatch) {
          subjectCode = codeMatch[1];
        }
      }
    }
   
    // Fallback parsing - only if needed
    if (!subjectCode && goal.subject) {
      const codeMatch = goal.subject.match(/^([A-Z]{2}\d{3})/);
      if (codeMatch) {
        subjectCode = codeMatch[1];
      }
    }
   
    // Use cached topic names
    if (!topicName) {
      topicName = goal.topicName || goal.topic || '';
    }
   
    console.log(' Extracted subject code:', subjectCode);
    console.log(' Extracted topic:', topicName);
   
    // Immediate navigation - no delays
    if (subjectCode) {
      // Build URL efficiently
      const baseUrl = `/subjects?subject=${subjectCode}`;
      const fullUrl = topicName ? `${baseUrl}&topic=${encodeURIComponent(topicName)}` : baseUrl;
     
      console.log(' Navigating to:', fullUrl);
     
      // Use router.push for instant navigation (no page reload)
      router.push(fullUrl);
    } else {
      console.log(' Subject code not found, redirecting to subjects page');
      router.push('/subjects');
    }
   
    // Restore element state after navigation
    setTimeout(() => {
      if (goalElement) {
        goalElement.style.pointerEvents = 'auto';
        goalElement.style.opacity = '1';
      }
    }, 100);
  }, [router]);
 
  // Prefetch subjects page for faster navigation
  useEffect(() => {
    if (todayGoals && todayGoals.length > 0) {
      // Prefetch the subjects page to make navigation instant
      router.prefetch('/subjects');
     
      // Extract unique subject codes and prefetch them
      const subjectCodes = new Set();
      todayGoals.forEach(goal => {
        if (goal.text) {
          const dashIndex = goal.text.indexOf(' - ');
          if (dashIndex > -1) {
            const subjectPart = goal.text.substring(0, dashIndex).replace(/^(Study Session|Review|Practice|Mock Test):\s*/, '');
            const codeMatch = subjectPart.match(/^([A-Z]{2}\d{3})/);
            if (codeMatch) {
              subjectCodes.add(codeMatch[1]);
            }
          }
        }
        if (goal.subject) {
          const codeMatch = goal.subject.match(/^([A-Z]{2}\d{3})/);
          if (codeMatch) {
            subjectCodes.add(codeMatch[1]);
          }
        }
      });
     
      // Prefetch each subject page
      subjectCodes.forEach(subjectCode => {
        router.prefetch(`/subjects?subject=${subjectCode}`);
      });
    }
  }, [todayGoals, router]);
 
  const handleSubjectNavigation = useCallback((direction) => {
    if (direction === 'prev' && currentSubjectIndex > 0) {
      setCurrentSubjectIndex(currentSubjectIndex - 1);
    } else if (direction === 'next' && currentSubjectIndex < subjects.length - 1) {
      setCurrentSubjectIndex(currentSubjectIndex + 1);
    }
  }, [currentSubjectIndex, subjects.length]);
 
  // Touch swipe handlers for mobile carousel
  const touchStartXRef = useRef(0);
  const touchDeltaXRef = useRef(0);
 
  const handleCarouselTouchStart = useCallback((e) => {
    if (!isMobile || !e.touches || e.touches.length === 0) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchDeltaXRef.current = 0;
  }, [isMobile]);
 
  const handleCarouselTouchMove = useCallback((e) => {
    if (!isMobile || !e.touches || e.touches.length === 0) return;
    touchDeltaXRef.current = e.touches[0].clientX - touchStartXRef.current;
  }, [isMobile]);
 
  const handleCarouselTouchEnd = useCallback(() => {
    if (!isMobile) return;
    const dx = touchDeltaXRef.current;
    const threshold = 40; // pixels
    if (Math.abs(dx) > threshold) {
      if (dx < 0) handleSubjectNavigation('next');
      else handleSubjectNavigation('prev');
    }
    touchStartXRef.current = 0;
    touchDeltaXRef.current = 0;
  }, [isMobile, handleSubjectNavigation]);
 
  // Scroll active pill into view when currentSubjectIndex changes
  useEffect(() => {
    const scrollToActivePill = () => {
      const activePill = isMobile
        ? carouselContentRef.current?.children[currentSubjectIndex]
        : desktopCarouselContentRef.current?.children[currentSubjectIndex];
     
      if (activePill) {
        activePill.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center'
        });
      }
    };
 
    // Add a small delay to ensure DOM is updated
    const timeoutId = setTimeout(scrollToActivePill, 50);
    return () => clearTimeout(timeoutId);
  }, [currentSubjectIndex, isMobile]);
 
  // Remove manual goal toggle - goals are now automatically completed based on quiz completion
  // const handleGoalToggle = useCallback(async (goalId, completed) => {
  //   await markGoalCompleted(goalId, completed);
  // }, [markGoalCompleted]);
 
  const toggleGoalsDisplay = useCallback(() => {
    setShowAllGoals(!showAllGoals);
  }, [showAllGoals]);

  useEffect(() => {
    // Check if user just completed onboarding
    const onboardingJustCompleted = typeof window !== 'undefined' 
      ? window.localStorage.getItem('onboarding-just-completed') === 'true'
      : false;
    
    // Only show tour if onboarding just completed and not dismissed
    if (isMobile || isLoading || hasDismissedDashboardTour || !onboardingJustCompleted) {
      setShowDashboardTour(false);
      return;
    }

    if (!dashboardTourSteps.length) {
      setShowDashboardTour(false);
      return;
    }

    const clampedIndex = Math.min(dashboardTourStepIndex, dashboardTourSteps.length - 1);
    if (clampedIndex !== dashboardTourStepIndex) {
      setDashboardTourStepIndex(clampedIndex);
      return;
    }

    const step = dashboardTourSteps[clampedIndex];
    const element = step?.ref?.current;

    if (!element) {
      return;
    }

    const tooltipWidthMax = 340;
    const tooltipHeightApprox = 210;
    const gutter = 24;

    const updateOverlay = () => {
      const rect = element.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      setViewportSize({ width: viewportWidth, height: viewportHeight });

      const highlightPadding = 0;
      const highlightTop = Math.max(0, rect.top - highlightPadding);
      const highlightLeft = Math.max(0, rect.left - highlightPadding);
      const highlightWidth = Math.min(viewportWidth, rect.width + highlightPadding * 2);
      const highlightHeight = Math.min(viewportHeight, rect.height + highlightPadding * 2);

      setTourCardRect({
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height
      });
      setTourHighlightRect({
        top: highlightTop,
        left: highlightLeft,
        width: highlightWidth,
        height: highlightHeight
      });

      const tooltipWidth = Math.min(tooltipWidthMax, viewportWidth - gutter * 2);
      const tooltipHeight = tooltipHeightApprox;

      const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

      const placementsToTry = Array.from(
        new Set([
          step.preferredPlacement,
          'bottom',
          'top',
          'right',
          'left'
        ].filter(Boolean))
      );

      const computePlacement = (placementCandidate) => {
        let top = 0;
        let left = 0;
        let fits = true;

        switch (placementCandidate) {
          case 'top': {
            top = rect.top - tooltipHeight - gutter;
            if (top < gutter) fits = false;
            top = clamp(top, gutter, viewportHeight - tooltipHeight - gutter);
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            left = clamp(left, gutter, viewportWidth - tooltipWidth - gutter);
            break;
          }
          case 'bottom': {
            top = rect.bottom + gutter;
            if (top + tooltipHeight > viewportHeight - gutter) fits = false;
            top = clamp(top, gutter, viewportHeight - tooltipHeight - gutter);
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            left = clamp(left, gutter, viewportWidth - tooltipWidth - gutter);
            break;
          }
          case 'right': {
            left = rect.right + gutter;
            if (left + tooltipWidth > viewportWidth - gutter) fits = false;
            left = clamp(left, gutter, viewportWidth - tooltipWidth - gutter);
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            top = clamp(top, gutter, viewportHeight - tooltipHeight - gutter);
            break;
          }
          case 'left': {
            left = rect.left - tooltipWidth - gutter;
            if (left < gutter) fits = false;
            left = clamp(left, gutter, viewportWidth - tooltipWidth - gutter);
            top = rect.top + rect.height / 2 - tooltipHeight / 2;
            top = clamp(top, gutter, viewportHeight - tooltipHeight - gutter);
            break;
          }
          default: {
            left = rect.left + rect.width / 2 - tooltipWidth / 2;
            top = rect.bottom + gutter;
            fits = false;
            left = clamp(left, gutter, viewportWidth - tooltipWidth - gutter);
            top = clamp(top, gutter, viewportHeight - tooltipHeight - gutter);
          }
        }

        const fullyFits =
          left >= gutter &&
          left + tooltipWidth <= viewportWidth - gutter &&
          top >= gutter &&
          top + tooltipHeight <= viewportHeight - gutter;

        return {
          top,
          left,
          placement: placementCandidate,
          fits: fits && fullyFits
        };
      };

      let placementResult = null;

      for (const candidate of placementsToTry) {
        const result = computePlacement(candidate);
        placementResult = result;
        if (result.fits) {
          break;
        }
      }

      if (!placementResult) {
        placementResult = computePlacement('bottom');
      }

      const axisGap = 12;
      let adjustedTop = placementResult.top;
      let adjustedLeft = placementResult.left;

      switch (placementResult.placement) {
        case 'top':
          adjustedTop = clamp(placementResult.top - axisGap, gutter, viewportHeight - tooltipHeight - gutter);
          break;
        case 'bottom':
          adjustedTop = clamp(placementResult.top + axisGap, gutter, viewportHeight - tooltipHeight - gutter);
          break;
        case 'left':
          adjustedLeft = clamp(placementResult.left - axisGap, gutter, viewportWidth - tooltipWidth - gutter);
          break;
        case 'right':
          adjustedLeft = clamp(placementResult.left + axisGap, gutter, viewportWidth - tooltipWidth - gutter);
          break;
        default:
          break;
      }

      setTourTooltipPlacement({
        top: adjustedTop,
        left: adjustedLeft,
        width: tooltipWidth,
        placement: placementResult.placement
      });
    };

    const scrollIntoViewTimeout = window.setTimeout(() => {
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 150);

    updateOverlay();
    setShowDashboardTour(true);

    window.addEventListener('resize', updateOverlay);
    window.addEventListener('scroll', updateOverlay, true);

    return () => {
      window.clearTimeout(scrollIntoViewTimeout);
      window.removeEventListener('resize', updateOverlay);
      window.removeEventListener('scroll', updateOverlay, true);
    };
  }, [
    isMobile,
    isLoading,
    hasDismissedDashboardTour,
    dashboardTourSteps,
    dashboardTourStepIndex
  ]);

  useEffect(() => {
    if (!showDashboardTour) return;

    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'relative';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
    };
  }, [showDashboardTour]);

  const handleDismissDashboardTour = useCallback(() => {
    setShowDashboardTour(false);
    setShowFinalPrompt(false);
    setHasDismissedDashboardTour(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('dashboard-tour-dismissed', 'true');
      window.localStorage.setItem('dashboard-streak-tour-dismissed', 'true');
      // Clear onboarding completion flag after tour is dismissed
      window.localStorage.removeItem('onboarding-just-completed');
      window.localStorage.removeItem('show-dashboard-tour');
    }
  }, []);

  const handleDashboardTourNext = useCallback(() => {
    setDashboardTourStepIndex((prev) => {
      if (prev >= dashboardTourSteps.length - 1) {
        setShowFinalPrompt(true);
        return prev;
      }
      return prev + 1;
    });
  }, [dashboardTourSteps.length]);

  const handleDashboardTourBack = useCallback(() => {
    setDashboardTourStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  useEffect(() => {
    if (!showDashboardTour) return;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        handleDismissDashboardTour();
      }
      if (event.key === 'ArrowRight') {
        handleDashboardTourNext();
      }
      if (event.key === 'ArrowLeft') {
        handleDashboardTourBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    showDashboardTour,
    handleDismissDashboardTour,
    handleDashboardTourNext,
    handleDashboardTourBack
  ]);

  useEffect(() => {
    if (!showDashboardTour || !tourCardRect || !tourTooltipPlacement) {
      return;
    }

    const { top: cardTop, left: cardLeft, width: cardWidth, height: cardHeight } = tourCardRect;
    const { top: tooltipTop, left: tooltipLeft, width: tooltipWidth, placement } = tourTooltipPlacement;

    const tooltipHeight = tourTooltipRef.current?.offsetHeight || 0;
    const tooltipCenterX = tooltipLeft + tooltipWidth / 2;
    const tooltipCenterY = tooltipTop + tooltipHeight / 2;

    let arrowStartX = tooltipCenterX;
    let arrowStartY = tooltipCenterY;

    switch (placement) {
      case 'top':
        arrowStartY = tooltipTop + tooltipHeight - 24;
        break;
      case 'bottom':
        arrowStartY = tooltipTop + 24;
        break;
      case 'left':
        arrowStartX = tooltipLeft + tooltipWidth - 18;
        break;
      case 'right':
        arrowStartX = tooltipLeft + 18;
        break;
      default:
        arrowStartY = tooltipTop + 24;
    }

    const viewportWidth = viewportSize?.width || window.innerWidth || 0;
    const viewportHeight = viewportSize?.height || window.innerHeight || 0;
    const clamp = (value, min, max) => Math.max(min, Math.min(value, max));

    const edgeInset = 12;
    const cardCenterX = cardLeft + cardWidth / 2;
    const cardCenterY = cardTop + cardHeight / 2;

    let cardTargetX = cardCenterX;
    let cardTargetY = cardCenterY;

    let control1X = arrowStartX;
    let control1Y = arrowStartY;
    let control2X = cardTargetX;
    let control2Y = cardTargetY;

    switch (placement) {
      case 'top': {
        cardTargetX = clamp(cardCenterX, 0, viewportWidth);
        cardTargetY = clamp(cardTop + edgeInset, 0, viewportHeight);
        control1X = arrowStartX + (cardTargetX - arrowStartX) * 0.15;
        control1Y = arrowStartY - 36;
        control2X = cardTargetX + (arrowStartX - cardTargetX) * 0.15;
        control2Y = cardTargetY - 16;
        break;
      }
      case 'bottom': {
        cardTargetX = clamp(cardCenterX, 0, viewportWidth);
        cardTargetY = clamp(cardTop + cardHeight - edgeInset, 0, viewportHeight);
        control1X = arrowStartX + (cardTargetX - arrowStartX) * 0.15;
        control1Y = arrowStartY + 36;
        control2X = cardTargetX + (arrowStartX - cardTargetX) * 0.15;
        control2Y = cardTargetY + 16;
        break;
      }
      case 'left': {
        cardTargetX = clamp(cardLeft + edgeInset, 0, viewportWidth);
        cardTargetY = clamp(cardCenterY, 0, viewportHeight);
        control1X = arrowStartX - 36;
        control1Y = arrowStartY + (cardTargetY - arrowStartY) * 0.25;
        control2X = cardTargetX - 16;
        control2Y = cardTargetY + (arrowStartY - cardTargetY) * 0.25;
        break;
      }
      case 'right': {
        cardTargetX = clamp(cardLeft + cardWidth - edgeInset, 0, viewportWidth);
        cardTargetY = clamp(cardCenterY, 0, viewportHeight);
        control1X = arrowStartX + 36;
        control1Y = arrowStartY + (cardTargetY - arrowStartY) * 0.25;
        control2X = cardTargetX + 16;
        control2Y = cardTargetY + (arrowStartY - cardTargetY) * 0.25;
        break;
      }
      default: {
        cardTargetX = clamp(cardCenterX, 0, viewportWidth);
        cardTargetY = clamp(cardTop + cardHeight - edgeInset, 0, viewportHeight);
        control1X = arrowStartX + (cardTargetX - arrowStartX) * 0.2;
        control1Y = arrowStartY + 36;
        control2X = cardTargetX + (arrowStartX - cardTargetX) * 0.2;
        control2Y = cardTargetY + 16;
      }
    }

    const path = `M ${arrowStartX} ${arrowStartY} C ${control1X} ${control1Y}, ${control2X} ${control2Y}, ${cardTargetX} ${cardTargetY}`;
    setTourArrowPath(path);
  }, [showDashboardTour, tourCardRect, tourTooltipPlacement, viewportSize]);

  // Mobile-specific icons
  const TargetIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="2"/>
      <circle cx="12" cy="12" r="6" stroke="#3b82f6" strokeWidth="2"/>
      <circle cx="12" cy="12" r="2" fill="#3b82f6"/>
    </svg>
  );
 
  const TrophyIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 9H4C2.89543 9 2 8.10457 2 7V4C2 2.89543 2.89543 2 4 2H6M18 9H20C21.1046 9 22 8.10457 22 7V4C22 2.89543 21.1046 2 20 2H18M6 9V20C6 21.1046 6.89543 22 8 22H16C17.1046 22 18 21.1046 18 20V9M6 9H18" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M12 9V2" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
 
  // Mobile render function
  const renderMobileLayout = () => (
    <div className={`overview-mobile-active ${mobileStyles.mobileOverviewContainer}`}>
 
      {/* Main Course Card */}
      <div className={mobileStyles.mobileMainCourseCard}>
        <h2 className={mobileStyles.mobileCourseTitle}>
          {subjects[currentSubjectIndex]?.name || "Human Anatomy & Physiology I"}
        </h2>
        <div className={mobileStyles.mobileCourseIcon}>
          {subjects[currentSubjectIndex]?.code || "HA"}
        </div>
        <button className={mobileStyles.mobileStartButton} onClick={handleStartSubject}>
          Start
        </button>
      </div>
 
      {/* Course Carousel */}
      {subjects.length > 1 && (
        <div className={mobileStyles.mobileCourseCarousel}>
          <div className={mobileStyles.mobileCarouselContainer}>
            <button
              className={mobileStyles.mobileCarouselButton}
              onClick={() => handleSubjectNavigation('prev')}
              disabled={currentSubjectIndex === 0}
              aria-label="Previous subject"
            >
              ‹
            </button>
            <div
              className={mobileStyles.mobileCarouselContent}
              ref={carouselContentRef}
              onTouchStart={handleCarouselTouchStart}
              onTouchMove={handleCarouselTouchMove}
              onTouchEnd={handleCarouselTouchEnd}
            >
              {subjects.map((subject, index) => (
                <button
                  key={`mobile-subject-${index}`}
                  className={`${mobileStyles.mobileCoursePill} ${
                    currentSubjectIndex === index
                      ? mobileStyles.mobileCoursePillActive
                      : mobileStyles.mobileCoursePillInactive
                  }`}
                  onClick={() => setCurrentSubjectIndex(index)}
                  aria-label={`Select ${subject.name}`}
                  aria-pressed={currentSubjectIndex === index}
                >
                  {subject.name}
                </button>
              ))}
            </div>
            <button
              className={mobileStyles.mobileCarouselButton}
              onClick={() => handleSubjectNavigation('next')}
              disabled={currentSubjectIndex === subjects.length - 1}
              aria-label="Next subject"
            >
              ›
            </button>
          </div>
          <div className={mobileStyles.mobilePaginationDots}>
            {subjects.map((_, index) => (
              <div
                key={`mobile-dot-${index}`}
                className={`${mobileStyles.mobileDot} ${
                  currentSubjectIndex === index ? mobileStyles.active : mobileStyles.inactive
                }`}
              />
            ))}
          </div>
        </div>
      )}
 
      {/* Premium Card - Only show for non-premium users */}
      {!hasPremiumAccess && (
        <div className={mobileStyles.mobilePremiumCard}>
          <div className={mobileStyles.mobilePremiumContent}>
            <div className={mobileStyles.mobilePremiumIcon}>
              <div className={mobileStyles.mobilePremiumIconInner}></div>
            </div>
            <div className={mobileStyles.mobilePremiumText}>
              <h3>Unlock Premium</h3>
              <p>Get smarter, faster</p>
            </div>
          </div>
          <button
            className={mobileStyles.mobileExplorePremiumButton}
            onClick={handleExplorePremium}
          >
            Explore Premium
          </button>
        </div>
      )}
 
      {/* Today's Goals Card */}
      <div className={mobileStyles.mobileGoalsCard}>
        <div className={mobileStyles.mobileGoalsHeader}>
          <div className={mobileStyles.mobileTargetIcon}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="7" cy="7" r="6" fill="#60a5fa"/>
              <circle cx="7" cy="7" r="4" fill="none" stroke="white" strokeWidth="1"/>
              <circle cx="7" cy="7" r="2" fill="white"/>
              <circle cx="7" cy="7" r="0.7" fill="#60a5fa"/>
            </svg>
          </div>
          <h3 className={mobileStyles.mobileGoalsTitle}>Today's Goals</h3>
        </div>
        <div className={`${mobileStyles.mobileGoalsList} ${showAllGoals ? mobileStyles.mobileGoalsListScrollable : ''}`}>
          {todayGoals && todayGoals.length > 0 ? (
            visibleGoals.map((goal) => (
              <div key={goal.id} className={mobileStyles.mobileGoalItem} data-goal-id={goal.id}>
                <button
                  className={`${mobileStyles.mobileGoalCheckbox} ${
                    goal.completed ? mobileStyles.completed : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoalClick(goal);
                  }}
                  aria-label={`Open topic: ${goal.subject || goal.text}`}
                  title="Click to open this topic"
                >
                  {goal.completed ? '✓' : ''}
                </button>
                <div
                  className={mobileStyles.mobileGoalContent}
                  onClick={() => handleGoalClick(goal)}
                  title="Click to open this topic"
                >
                  <span className={`${mobileStyles.mobileGoalText} ${
                    goal.completed ? mobileStyles.completed : ''
                  }`}>
                    {goal.subject || goal.text}
                  </span>
                  <div className={mobileStyles.mobileGoalDetails}>
                    <span className={mobileStyles.mobileTopicName}>{goal.topicName || goal.topic || 'Topic'}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className={mobileStyles.mobileNoGoalsMessage}>
              <div className={mobileStyles.mobileNoGoalsIcon}>📋</div>
              <div className={mobileStyles.mobileNoGoalsText}>No Study Plan Generated</div>
            </div>
          )}
        </div>
         
        {todayGoals && todayGoals.length > 0 && (
          <>
            {todayGoals.length > 4 && (
              <div className={mobileStyles.mobileShowMore} onClick={toggleGoalsDisplay}>
                <span>{showAllGoals ? 'Show Less' : `Show ${todayGoals.length - 4} More`}</span>
                <span className={`${mobileStyles.mobileChevron} ${showAllGoals ? mobileStyles.up : ''}`}>
                  {showAllGoals ? '⌃' : '⌄'}
                </span>
              </div>
            )}
             
            <div className={mobileStyles.mobileGoalsProgress}>
              <span>Progress</span>
              <div className={mobileStyles.mobileProgressBar}>
                <div
                  className={mobileStyles.mobileProgressFill}
                  style={{ width: `${progressPercentage}%` }}
                ></div>
              </div>
              <span>{todayGoals ? todayGoals.filter(g => g.completed).length : 0}/{todayGoals ? todayGoals.length : 0}</span>
            </div>
          </>
        )}
      </div>
 
 
      {/* Leadership Board Card */}
      <div className={mobileStyles.mobileLeaderboardCard}>
        <div className={mobileStyles.mobileLeaderboardHeader}>
          <div className={mobileStyles.mobileTrophyIcon}>
            <Trophy size={20} color="#EAB308" />
          </div>
          <h3 className={mobileStyles.mobileLeaderboardTitle}>Leadership Board</h3>
        </div>
        <div className={mobileStyles.mobileLeaderboardList}>
          {isLoading && formattedLeaderboard.length === 0 ? (
            // Show loading skeleton for mobile leaderboard
            <div className={mobileStyles.mobileLeaderboardLoadingSkeleton}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className={mobileStyles.mobileLeaderboardItemSkeleton}>
                  <div className={mobileStyles.mobileRankCircleSkeleton}></div>
                  <div className={mobileStyles.mobileUserInfoSkeleton}>
                    <div className={mobileStyles.mobileUserNameSkeleton}></div>
                    <div className={mobileStyles.mobileUserXpSkeleton}></div>
                  </div>
                  {i <= 3 && <div className={mobileStyles.mobileRankMedalSkeleton}></div>}
                </div>
              ))}
            </div>
          ) : (
            formattedLeaderboard.map((user) => {
            // Build className for mobile entries
            let className = `${mobileStyles.mobileLeaderboardItem}`;
           
            if (user.isBottomEntry) {
              // Bottom entry - use rank-specific styling
              className += ` ${mobileStyles.bottomEntry}`;
              if (user.rank === 1) className += ` ${mobileStyles.rank1Bottom}`;
              else if (user.rank === 2) className += ` ${mobileStyles.rank2Bottom}`;
              else if (user.rank === 3) className += ` ${mobileStyles.rank3Bottom}`;
              else className += ` ${mobileStyles.rank4PlusBottom}`; // Rank 4+ gets blue styling
            } else {
              // Regular top 5 entries - use normal rank styling
              if (user.isCurrentUser) className += ` ${mobileStyles.currentUser}`;
              else if (user.rank === 1) className += ` ${mobileStyles.first}`;
              else if (user.rank === 2) className += ` ${mobileStyles.second}`;
              else if (user.rank === 3) className += ` ${mobileStyles.third}`;
            }
           
            return (
              <div
                key={`${user.isBottomEntry ? 'user-bottom' : 'rank'}-${user.rank}-${user.name || 'anon'}`}
                className={className}
              >
              <div className={`${mobileStyles.mobileRankCircle} ${
                user.rank === 1 ? mobileStyles.first :
                user.rank === 2 ? mobileStyles.second :
                user.rank === 3 ? mobileStyles.third :
                user.isCurrentUser ? mobileStyles.currentUser : mobileStyles.other
              }`}>
                {user.rank}
              </div>
              <div className={mobileStyles.mobileUserInfo}>
                <span className={mobileStyles.mobileUserName}>{user.name}</span>
                <span className={mobileStyles.mobileUserXP}>{user.xp} XP</span>
              </div>
              {user.isTop && (
                <div className={mobileStyles.mobileRankMedal}>
                  <Medal
                    size={24}
                    color={user.rank === 1 ? '#EAB308' : user.rank === 2 ? '#9CA3AF' : '#F97316'}
                  />
                </div>
              )}
              </div>
            );
          })
          )}
        </div>
      </div>
 
    </div>
  );
 
  // Show error state
  if (error) {
    return (
      <div className={isMobile ? mobileStyles.mobileOverviewContainer : styles.overviewContainer}>
        <div className={isMobile ? mobileStyles.mobileErrorCard : styles.errorMessage}>
          <div className={isMobile ? mobileStyles.mobileErrorIcon : styles.errorIcon}>⚠️</div>
          <h2 className={isMobile ? mobileStyles.mobileErrorTitle : styles.errorTitle}>
            Unable to load dashboard data
          </h2>
          <p className={isMobile ? mobileStyles.mobileErrorMessage : styles.errorDetails}>
            {error}
          </p>
          <button
            onClick={() => window.location.reload()}
            className={isMobile ? mobileStyles.mobileRetryButton : styles.retryButton}
            aria-label="Retry loading dashboard data"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
 
  // Render mobile layout for mobile devices
  if (isMobile) {
    return renderMobileLayout();
  }
 
  const highlightClipPath = tourHighlightRect && viewportSize
    ? `polygon(0 0, ${viewportSize.width}px 0, ${viewportSize.width}px ${viewportSize.height}px, 0 ${viewportSize.height}px, 0 0, ${tourHighlightRect.left}px ${tourHighlightRect.top}px, ${tourHighlightRect.left}px ${tourHighlightRect.top + tourHighlightRect.height}px, ${tourHighlightRect.left + tourHighlightRect.width}px ${tourHighlightRect.top + tourHighlightRect.height}px, ${tourHighlightRect.left + tourHighlightRect.width}px ${tourHighlightRect.top}px, ${tourHighlightRect.left}px ${tourHighlightRect.top}px)`
    : null;

  // When showing final prompt, do not highlight any card
  const activeTourStepId = showDashboardTour && !showFinalPrompt ? currentTourStep?.id : null;
  const isTourStepActive = (id) => activeTourStepId === id;
  const isFirstTourStep = dashboardTourStepIndex === 0;
  const isLastTourStep = dashboardTourStepIndex >= Math.max(0, dashboardTourSteps.length - 1);

  const dashboardTourOverlay = showDashboardTour && (showFinalPrompt || (currentTourStep && tourTooltipPlacement && tourArrowPath))
    ? (
        <div className={styles.streakTourOverlay} role="dialog" aria-modal="true" aria-label="Dashboard tour">
          <div
            className={styles.streakTourBackdrop}
            style={!showFinalPrompt && highlightClipPath ? { clipPath: highlightClipPath, WebkitClipPath: highlightClipPath } : undefined}
            onClick={handleDismissDashboardTour}
          ></div>
          {!showFinalPrompt && (
          <svg
            className={styles.streakTourArrow}
            viewBox={`0 0 ${viewportSize.width || 1} ${viewportSize.height || 1}`}
            aria-hidden="true"
            style={{ width: viewportSize.width || '100vw', height: viewportSize.height || '100vh' }}
          >
            <defs>
              <marker
                id="dashboardTourArrowHead"
                markerWidth="7"
                markerHeight="6"
                refX="1.4"
                refY="3"
                orient="auto"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M0.2 0.4 L5.6 3 M0.2 5.6 L5.6 3" />
              </marker>
            </defs>
            <path
              d={tourArrowPath}
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              markerEnd="url(#dashboardTourArrowHead)"
            />
          </svg>
          )}
          {!showFinalPrompt && (
          <div
            ref={tourTooltipRef}
            className={`${styles.streakTourTooltip} ${tourTooltipPlacement.placement === 'top' ? styles.tooltipAbove : tourTooltipPlacement.placement === 'bottom' ? styles.tooltipBelow : tourTooltipPlacement.placement === 'left' ? styles.tooltipSideLeft : styles.tooltipSideRight}`}
            style={{
              top: tourTooltipPlacement.top,
              left: tourTooltipPlacement.left,
              width: tourTooltipPlacement.width
            }}
          >
            <div className={styles.streakTourContent}>
              <h3>{currentTourStep.title}</h3>
              {currentTourStep.description && <p>{currentTourStep.description}</p>}
              {currentTourStep.bullets && currentTourStep.bullets.length > 0 && (
                <ul>
                  {currentTourStep.bullets.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              )}
              {currentTourStep.id !== 'start' && (
                <div className={styles.streakTourActions}>
                  <button
                    type="button"
                    className={styles.streakTourDismissButton}
                    onClick={handleDashboardTourNext}
                  >
                    {isLastTourStep ? 'Next' : 'Next'}
                  </button>
                </div>
              )}
            </div>
          </div>
          )}
          {showFinalPrompt && (
            <div className={styles.finalTourPrompt}>
              <div className={styles.finalTourCard}>
                <div className={styles.finalTitle}>Let’s complete one topic and gain streaks</div>
                 <button
                   className={styles.finalCta}
                   onClick={() => {
                     setShowFinalPrompt(false);
                     // Enable the start step then jump to it on next tick
                     setEnableStartStep(true);
                     setTimeout(() => {
                       const idx = (dashboardTourSteps || []).findIndex(s => s.id === 'start');
                       if (idx >= 0) {
                         setDashboardTourStepIndex(idx);
                         setShowDashboardTour(true);
                       } else {
                         const subjIdx = (dashboardTourSteps || []).findIndex(s => s.id === 'subject');
                         if (subjIdx >= 0) {
                           setDashboardTourStepIndex(subjIdx);
                           setShowDashboardTour(true);
                         }
                       }
                     }, 0);
                   }}
                 >
                  Let’s go
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null;

  return (
    <div className={`${styles.overviewContainer} ${!isLoading ? styles.skeletonToDataTransition : ''}`}>
      {dashboardTourOverlay && typeof window !== 'undefined'
        ? ReactDOM.createPortal(dashboardTourOverlay, document.body)
        : dashboardTourOverlay}

      {/* Left Column */}
      <div className={styles.leftColumn}>
        {/* Premium Card - Only show for non-premium users */}
        {!hasPremiumAccess && (
          <div
            ref={premiumCardRef}
            className={`${styles.premiumCard} ${isTourStepActive('premium') ? styles.cardTourHighlight : ''}`}
          >
            <div className={styles.premiumContent}>
              <div className={styles.premiumIcon}>
                <div className={styles.premiumIconInner}></div>
              </div>
              <div className={styles.premiumText}>
                <h3>Unlock Premium</h3>
                <p>Get smarter, faster</p>
              </div>
            </div>
            <button className={styles.explorePremiumBtn} onClick={handleExplorePremium}>
              Explore Premium
            </button>
          </div>
        )}
 
        {/* Daily Streak Card */}
        <div
          className={`${styles.streakCard} ${isTourStepActive('streak') ? styles.cardTourHighlight : ''}`}
          ref={streakCardRef}
        >
          <div className={styles.streakHeader}>
            <span className={styles.streakNumber}>
              {dailyStreak?.streak || 0}
              <LightningIcon size="24" color="#fbbf24" />
            </span>
          </div>
          <div className={styles.weeklyStreak}>
            {weeklyStreak.map((isActive, index) => (
              <div key={index} className={`${styles.streakDay} ${isActive ? styles.active : ''}`}>
                <LightningIcon color={isActive ? "white" : "#9ca3af"} size="20" />
              </div>
            ))}
          </div>
          <div className={styles.streakDays}>
            <span>M</span>
            <span>T</span>
            <span>W</span>
            <span>Th</span>
            <span>F</span>
            <span>S</span>
            <span>Su</span>
          </div>
        </div>
 
 
        {/* Today's Goals Card */}
        <div
          ref={goalsCardRef}
          className={`${styles.goalsCard} ${isTourStepActive('goals') ? styles.cardTourHighlight : ''}`}
        >
          <div className={styles.goalsHeader}>
            <div className={styles.targetIcon}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="10" cy="10" r="9" fill="#60a5fa"/>
                <circle cx="10" cy="10" r="6" fill="none" stroke="white" strokeWidth="1.5"/>
                <circle cx="10" cy="10" r="3" fill="white"/>
                <circle cx="10" cy="10" r="1" fill="#60a5fa"/>
              </svg>
            </div>
            <h3>Today's Goals</h3>
            {!goalsLoaded && !isLoading && (
              <button
                className={styles.refreshButton}
                onClick={() => window.dispatchEvent(new CustomEvent('refresh-dashboard'))}
                title="Refresh goals"
              >
                🔄
              </button>
            )}
            {isLoading && goalsLoaded && (
              <div className={styles.refreshingIndicator} title="Updating goals...">
                ⚡
              </div>
            )}
          </div>
          <div className={`${styles.goalsList} ${showAllGoals ? styles.goalsListScrollable : ''}`}>
            {isLoading && !goalsLoaded ? (
              // Show loading skeleton for goals
              <div className={styles.goalsLoadingSkeleton}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className={styles.goalItemSkeleton}>
                    <div className={styles.goalCheckboxSkeleton}></div>
                    <div className={styles.goalContentSkeleton}>
                      <div className={styles.goalTextSkeleton}></div>
                      <div className={styles.goalDetailsSkeleton}></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : todayGoals && todayGoals.length > 0 ? (
              visibleGoals.map((goal) => (
                <div key={goal.id} className={styles.goalItem} data-goal-id={goal.id}>
                <button
                  className={`${styles.goalCheckbox} ${goal.completed ? styles.completed : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleGoalClick(goal);
                  }}
                  aria-label={`Open topic: ${goal.subject || goal.text}`}
                  title="Click to open this topic"
                >
                  {goal.completed ? '✓' : ''}
                </button>
                  <div
                    className={styles.goalContent}
                    onClick={() => handleGoalClick(goal)}
                    title="Click to open this topic"
                  >
                    <span className={`${styles.goalText} ${goal.completed ? styles.completedText : ''}`}>
                      {goal.subject || goal.text}
                    </span>
                    <div className={styles.goalDetails}>
                      <span className={styles.topicName}>{goal.topicName || goal.topic || 'Topic'}</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.noGoalsMessage}>
                <div className={styles.noGoalsIcon}>📋</div>
                <div className={styles.noGoalsText}>No Study Plan Generated</div>
              </div>
            )}
          </div>
         
          {todayGoals && todayGoals.length > 0 && (
            <>
              {todayGoals.length > 4 && (
                <div className={styles.showMore} onClick={toggleGoalsDisplay}>
                  <span>{showAllGoals ? 'Show Less' : `Show ${todayGoals.length - 4} More`}</span>
                  <span className={`${styles.chevron} ${showAllGoals ? styles.up : ''}`}>
                    {showAllGoals ? '⌃' : '⌄'}
                  </span>
                </div>
              )}
             
              <div className={styles.goalsProgress}>
                <span>Progress</span>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <span>{todayGoals ? todayGoals.filter(g => g.completed).length : 0}/{todayGoals ? todayGoals.length : 0}</span>
              </div>
            </>
          )}
        </div>
      </div>
 
      {/* Center Column - Subject Display */}
      <div className={styles.centerColumn}>
        <div
          ref={subjectCardRef}
          className={`${styles.subjectCard} ${isTourStepActive('subject') ? styles.cardTourHighlight : ''} ${isTourStepActive('start') ? styles.cardDimDuringStart : ''}`}
        >
          <h2>{subjects[currentSubjectIndex]?.name || "Subject Loading..."}</h2>
          <div className={styles.subjectIcon} style={{ backgroundColor: subjects[currentSubjectIndex]?.color || "#64748b" }}>
            <span className={styles.subjectCode}>{subjects[currentSubjectIndex]?.code || "SB"}</span>
          </div>
          <button className={`${styles.startBtn} ${isTourStepActive('start') ? styles.startBtnHighlight : ''}`} onClick={handleStartSubject} ref={startButtonRef}>
            {subjects[currentSubjectIndex]?.progress > 0 ? 'Continue' : 'Start'}
          </button>
         
          {subjects.length > 1 && (
            <>
              <div className={styles.subjectNavigation}>
                <button
                  className={styles.navBtn}
                  onClick={() => handleSubjectNavigation('prev')}
                  disabled={currentSubjectIndex === 0}
                  aria-label="Previous subject"
                >
                  ‹
                </button>
                <div className={styles.subjectButtonsContainer} ref={desktopCarouselContentRef}>
                  {subjects.map((subject, index) => (
                    <button
                      key={`desktop-subject-${index}`}
                      className={`${styles.subjectBtn} ${currentSubjectIndex === index ? styles.active : ''}`}
                      onClick={() => setCurrentSubjectIndex(index)}
                      aria-label={`Select ${subject.name}`}
                      aria-pressed={currentSubjectIndex === index}
                    >
                      {subject.name}
                    </button>
                  ))}
                </div>
                <button
                  className={styles.navBtn}
                  onClick={() => handleSubjectNavigation('next')}
                  disabled={currentSubjectIndex === subjects.length - 1}
                  aria-label="Next subject"
                >
                  ›
                </button>
              </div>
              <div className={styles.subjectPagination}>
                {subjects.map((_, index) => (
                  <div
                    key={`desktop-dot-${index}`}
                    className={`${styles.paginationDot} ${currentSubjectIndex === index ? styles.active : ''}`}
                  ></div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
 
      {/* Right Column - Leadership Board */}
      <div className={styles.rightColumn}>
        <div
          ref={leaderboardCardRef}
          className={`${styles.leaderboardCard} ${isTourStepActive('leaderboard') ? styles.cardTourHighlight : ''}`}
        >
          <div className={styles.leaderboardHeader}>
            <div className={styles.trophyIcon}>
              <Trophy size={20} color="#EAB308" />
            </div>
            <h3>Leadership Board</h3>
          </div>
          <div className={styles.leaderboardList}>
            {isLoading && formattedLeaderboard.length === 0 ? (
              // Show loading skeleton for leaderboard
              <div className={styles.leaderboardLoadingSkeleton}>
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className={styles.leaderboardItemSkeleton}>
                    <div className={styles.rankCircleSkeleton}></div>
                    <div className={styles.userInfoSkeleton}>
                      <div className={styles.userNameSkeleton}></div>
                      <div className={styles.userXpSkeleton}></div>
                    </div>
                    {i <= 3 && <div className={styles.rankShieldSkeleton}></div>}
                  </div>
                ))}
              </div>
            ) : (
              formattedLeaderboard.map((user, index) => {
              // Build className for regular entries
              let className = `${styles.leaderboardItem}`;
             
              if (user.isBottomEntry) {
                // Bottom entry - use rank-specific styling
                className += ` ${styles.bottomEntry}`;
                if (user.rank === 1) className += ` ${styles.rank1Bottom}`;
                else if (user.rank === 2) className += ` ${styles.rank2Bottom}`;
                else if (user.rank === 3) className += ` ${styles.rank3Bottom}`;
                else className += ` ${styles.rank4PlusBottom}`; // Rank 4+ gets blue styling
              } else {
                // Regular top 5 entries - use normal rank styling
                if (user.rank === 1) className += ` ${styles.topRank}`;
                else if (user.rank === 2) className += ` ${styles.rank2Item}`;
                else if (user.rank === 3) className += ` ${styles.rank3Item}`;
                else if (user.isCurrentUser) className += ` ${styles.currentUser}`;
              }
             
              return (
                <div
                  key={`${user.isBottomEntry ? 'user-bottom' : 'rank'}-${user.rank}-${user.name || 'anon'}`}
                  className={className}
                >
                <div className={`${styles.rankCircle} ${
                  user.rank === 1 ? styles.topRankCircle :
                  user.rank === 2 ? styles.rank2Circle :
                  user.rank === 3 ? styles.rank3Circle :
                  user.isCurrentUser ? styles.currentUserCircle : ''
                }`}>
                  {user.rank}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.userName}>{user.name}</span>
                  <span className={styles.userXp}>{user.xp} XP</span>
                </div>
                {user.isTop && (
                  <div className={styles.rankShield}>
                    <Medal
                      size={20}
                      color={user.rank === 1 ? '#EAB308' : user.rank === 2 ? '#9CA3AF' : '#F97316'}
                    />
                  </div>
                )}
                </div>
              );
            })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
 
export default Overview;

