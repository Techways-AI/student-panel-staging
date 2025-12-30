// components/CourseContent.js
'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation'; // Import Next.js router
import Link from 'next/link';
import { useTheme } from '../context/ThemeContext';
import { useLayout } from '../context/LayoutContext';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import styles from './CourseContent.module.css';
import mobileStyles from './CourseContentMobile.module.css';
import quizModalStyles from './QuizModal.module.css';
const AITutor = dynamic(() => import('./AITutor'), { ssr: false });
const Notes = dynamic(() => import('./Notes'), { ssr: false });
const QuizComponent = dynamic(() => import('./QuizComponent'), { ssr: false });
const QuizCompleted = dynamic(() => import('./QuizCompleted'), { ssr: false });
const VideoPlayer = dynamic(() => import('./VideoPlayer'), { ssr: false });
import { quizAPI, subjectContentAPI, studentContentAPI } from '../lib/api';
import { getApiBaseUrl, createApiHeaders, fetchWithFallback } from '../utils/apiUtils';
import { useQuizHandlers } from '../hooks/useQuizHandlers';

// ===== Completion Helper Utilities (DRY optimistic update + verification) =====
// Lightweight debounce to avoid rapid duplicate verifications
const __debounce = (fn, wait = 200) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
};

// Centralized progress event dispatching across the app
const __dispatchProgressEvents = (type, topicKey, topicTitle) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('progress-updated', { detail: { type, topicKey, topicTitle } }));
  window.dispatchEvent(new CustomEvent('dashboard-refresh'));
  window.dispatchEvent(new CustomEvent('study-plan-updated', { detail: { type, topic: topicTitle } }));
};

// Optimistic topic completion with backend verification
const optimisticTopicComplete = async ({
  unitIndex,
  topicIndex,
  topicTitle,
  markCompletedLocal,
  updateTopicProgress,
  verifyFn,                 // optional async function returning boolean
  forceRefreshCompletion,   // optional force refresh function
}) => {
  const topicKey = `${unitIndex}-${topicIndex}`;

  // Optimistic UI state for immediate checkmark
  if (markCompletedLocal) {
    markCompletedLocal(topicTitle);
  }

  // Notify other widgets to refresh
  __dispatchProgressEvents('topic-completed', topicKey, topicTitle);

  // Debounced verification to avoid redundant backend hits
  const doVerify = __debounce(async () => {
    try {
      if (typeof verifyFn === 'function') {
        const ok = await verifyFn();
        if (!ok && typeof forceRefreshCompletion === 'function') {
          await forceRefreshCompletion();
        }
      } else if (typeof forceRefreshCompletion === 'function') {
        await forceRefreshCompletion();
      }
    } catch {
      // Keep optimistic state; future fetches will reconcile
    }
  }, 200);

  await doVerify();
};

// Optimistic refresh helper (does NOT set completion true). Useful for video/notes steps.
const optimisticTopicRefresh = async ({
  unitIndex,
  topicIndex,
  topicTitle,
  forceRefreshCompletion,
  verifyFn,
}) => {
  const topicKey = `${unitIndex}-${topicIndex}`;
  __dispatchProgressEvents('topic-progress-updated', topicKey, topicTitle);
  const doVerify = __debounce(async () => {
    try {
      if (typeof verifyFn === 'function') {
        await verifyFn();
      }
      if (typeof forceRefreshCompletion === 'function') {
        await forceRefreshCompletion();
      }
    } catch {
      // ignore; UI will reconcile on next fetch
    }
  }, 200);
  await doVerify();
};

// CourseContent Skeleton Loading Component
const CourseContentSkeleton = ({ isMobile, isDarkMode }) => {
  // Apply theme class on a parent wrapper so descendant selectors like
  // ".darkTheme .courseContentSkeleton" work correctly with CSS Modules
  const themeClass = isDarkMode
    ? (isMobile ? mobileStyles.darkTheme : styles.darkTheme)
    : (isMobile ? mobileStyles.lightTheme : styles.lightTheme);

  return (
    <div className={themeClass}>
      <div className={isMobile ? mobileStyles.courseContentSkeleton : styles.courseContentSkeleton}>
        {/* Desktop Skeleton Layout */}
        {!isMobile ? (
          <>
          {/* Left Panel: Course Content List Skeleton */}
          <div className={`${styles.sidebarSkeleton} ${isDarkMode ? styles.darkTheme : ''}`}>
            {/* Header Skeleton */}
            <div className={styles.headerSkeleton}>
              <div className={styles.backButtonSkeleton}></div>
              <div className={styles.subjectTitleSkeleton}></div>
            </div>
            
            {/* Progress Section Skeleton */}
            <div className={styles.progressSectionSkeleton}>
              <div className={styles.progressTitleSkeleton}></div>
              <div className={styles.progressBarSkeleton}></div>
              <div className={styles.progressTextSkeleton}></div>
            </div>
            
            {/* Units Section Skeleton */}
            <div className={styles.unitsSectionSkeleton}>
              <div className={styles.unitsTitleSkeleton}></div>
              
              {/* Unit Skeletons */}
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.unitSkeleton}>
                  <div className={styles.unitHeaderSkeleton}>
                    <div className={styles.unitTitleSkeleton}></div>
                    <div className={styles.unitProgressSkeleton}></div>
                  </div>
                  <div className={styles.topicsListSkeleton}>
                    {[1, 2, 3].map((j) => (
                      <div key={j} className={styles.topicSkeleton}>
                        <div className={styles.topicIconSkeleton}></div>
                        <div className={styles.topicInfoSkeleton}>
                          <div className={styles.topicTitleSkeleton}></div>
                          <div className={styles.topicDurationSkeleton}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Content Area Skeleton */}
          <div className={`${styles.contentAreaSkeleton} ${isDarkMode ? styles.darkTheme : ''}`}>
            {/* Content Header Skeleton */}
            <div className={styles.contentHeaderSkeleton}>
              <div className={styles.contentTitleSkeleton}></div>
            </div>
            
            {/* Tabs Skeleton */}
            <div className={styles.tabsSkeleton}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.tabSkeleton}></div>
              ))}
            </div>
            
            {/* Video Container Skeleton */}
            <div className={styles.videoContainerSkeleton}></div>
            
            {/* Content Info Skeleton */}
            <div className={styles.contentInfoSkeleton}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={styles.infoItemSkeleton}>
                  <div className={styles.infoIconSkeleton}></div>
                  <div className={styles.infoTextSkeleton}></div>
                </div>
              ))}
            </div>
            
            {/* Description Skeleton */}
            <div className={styles.descriptionSkeleton}></div>
          </div>
        </>
      ) : (
        /* Mobile Skeleton Layout */
        <>
          {/* Header Skeleton */}
          <div className={`${mobileStyles.headerSkeleton} ${isDarkMode ? mobileStyles.darkTheme : ''}`}>
            <div className={mobileStyles.backButtonSkeleton}></div>
            <div className={mobileStyles.subjectTitleSkeleton}></div>
          </div>
          
          {/* Content Area Skeleton */}
          <div className={mobileStyles.contentAreaSkeleton}>
            {/* Tabs Skeleton */}
            <div className={mobileStyles.tabsSkeleton}>
              {[1, 2, 3].map((i) => (
                <div key={i} className={mobileStyles.tabSkeleton}></div>
              ))}
            </div>
            
            {/* Video Container Skeleton */}
            <div className={mobileStyles.videoContainerSkeleton}></div>
            
            {/* Content Info Skeleton */}
            <div className={mobileStyles.contentInfoSkeleton}>
              {[1, 2].map((i) => (
                <div key={i} className={mobileStyles.infoItemSkeleton}>
                  <div className={mobileStyles.infoIconSkeleton}></div>
                  <div className={mobileStyles.infoTextSkeleton}></div>
                </div>
              ))}
            </div>
            
            {/* Description Skeleton */}
            <div className={mobileStyles.descriptionSkeleton}></div>
          </div>
          </>
        )}
      </div>
    </div>
  );
};



const CourseContent = ({ subject, onBack, isLoading: externalLoading, subscriptionStatus, subscriptionData, onRefreshCourseData }) => {
  const router = useRouter();
  const { isDarkMode, toggleTheme } = useTheme();
  const { setShowUpgrade } = useLayout();
  const { user } = useAuth();
  
  // Get streak data from dashboard hook
  const { dailyStreak } = useDashboard(user?.id);
  
  // Sequential learning progress tracking - DECLARE FIRST to avoid TDZ issues
  const [topicProgress, setTopicProgress] = useState({}); // Track progress for each topic
  const topicProgressRef = useRef({});
  
  // Lesson product tour (multi-step) - DECLARE EARLY to avoid TDZ issues
  const [lessonTourStep, setLessonTourStep] = useState(-1); // -1 means hidden
  const lessonTourStepRef = useRef(-1); // Ref to track current tour step for useEffects
  
  // Mobile detection state
  const [isMobile, setIsMobile] = useState(false);
  

  // State variables - DECLARE BEFORE useEffects that use them
  const [selectedUnit, setSelectedUnit] = useState(0);
  const [selectedTopic, setSelectedTopic] = useState(0);
  const [activeTab, setActiveTab] = useState('video');
  const [isLoading, setIsLoading] = useState(externalLoading || true); // Start with loading state
  const [minLoadingComplete, setMinLoadingComplete] = useState(false); // Ensure minimum loading time
  const [userManualSelection, setUserManualSelection] = useState(false); // Track if user manually selected a topic
  // Mobile: prevent auto-open after user collapses a unit
  const [preventAutoOpenOnMobile, setPreventAutoOpenOnMobile] = useState(false);
  const [preventAutoExpand, setPreventAutoExpand] = useState(false);
  // Track if user has manually expanded/collapsed any unit
  const [hasManuallyExpandedUnit, setHasManuallyExpandedUnit] = useState(false);
  // Mobile: track which unit's topics list is visually expanded, independent of selected content
  const [mobileExpandedUnit, setMobileExpandedUnit] = useState(-1);
  // Desktop: track which unit's topics list is visually expanded, independent of selected content
  const [desktopExpandedUnit, setDesktopExpandedUnit] = useState(-1);
  const [isContentLoading, setIsContentLoading] = useState(false); // Track content loading
  const [showContent, setShowContent] = useState(false); // Start with hidden content until loaded
  const [videoProgress, setVideoProgress] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [fetchedVideoUrl, setFetchedVideoUrl] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);
  // Quiz handlers - extracted to useQuizHandlers hook
  // Persisted flag: selection came from URL topic, suppress auto-next-uncompleted logic
  const selectedFromURLRef = useRef(false);
  const initialSyncRunRef = useRef(false);

  // Reset initial sync and manual selection on subject change
  useEffect(() => {
    setUserManualSelection(false);
    initialSyncRunRef.current = false;
  }, [subject?.id || subject?.title]); // Run whenever subject changes


  // ASK AI Modal State
  const [isAskAIModalOpen, setIsAskAIModalOpen] = useState(false);
  const openAskAIModal = () => {
    setIsAskAIModalOpen(true);
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      const body = document.body;
      // Preserve previous styles to restore later
      if (body) {
        body.dataset.prevOverflow = body.style.overflow || '';
        body.dataset.prevHeight = body.style.height || '';
        body.dataset.prevPosition = body.style.position || '';
        body.dataset.prevTop = body.style.top || '';
        body.dataset.prevWidth = body.style.width || '';
        // Store scrollY and lock body using fixed positioning (most reliable on mobile)
        const scrollY = window.scrollY || window.pageYOffset || 0;
        body.dataset.prevScrollY = String(scrollY);
        body.style.overflow = 'hidden';
        body.style.height = '100%';
        body.style.position = 'fixed';
        body.style.top = `-${scrollY}px`;
        body.style.width = '100%';
      }
      if (html) {
        html.dataset.prevOverflow = html.style.overflow || '';
        html.dataset.prevHeight = html.style.height || '';
        html.style.overflow = 'hidden';
        html.style.height = '100%';
      }

      // Block touchmove and wheel events globally while modal is open
      const blockScroll = (e) => { e.preventDefault(); };
      body.__blockScrollHandler = blockScroll;
      document.addEventListener('touchmove', blockScroll, { passive: false });
      document.addEventListener('wheel', blockScroll, { passive: false });
    }
  };
  const closeAskAIModal = () => {
    setIsAskAIModalOpen(false);
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      const body = document.body;
      if (body) {
        body.style.overflow = body.dataset.prevOverflow || '';
        body.style.height = body.dataset.prevHeight || '';
        const prevScrollY = parseInt(body.dataset.prevScrollY || '0', 10) || 0;
        body.style.position = body.dataset.prevPosition || '';
        body.style.top = body.dataset.prevTop || '';
        body.style.width = body.dataset.prevWidth || '';
        delete body.dataset.prevOverflow;
        delete body.dataset.prevHeight;
        delete body.dataset.prevPosition;
        delete body.dataset.prevTop;
        delete body.dataset.prevWidth;
        delete body.dataset.prevScrollY;
        // Restore scroll position
        window.scrollTo(0, prevScrollY);
      }
      if (html) {
        html.style.overflow = html.dataset.prevOverflow || '';
        html.style.height = html.dataset.prevHeight || '';
        delete html.dataset.prevOverflow;
        delete html.dataset.prevHeight;
      }

      // Unblock events
      const blockScroll = body && body.__blockScrollHandler;
      if (blockScroll) {
        document.removeEventListener('touchmove', blockScroll, { passive: false });
        document.removeEventListener('wheel', blockScroll, { passive: false });
        delete body.__blockScrollHandler;
      }
    }
  };

  // Format time helper function
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Helper function to clean subject name to match database format
  // Removes course codes like "BP301T: " or "PS101: " from the beginning
  // This matches the backend clean_subject_name logic in apps/api/app/utils/subject_utils.py
  const cleanSubjectName = useCallback((subjectName) => {
    if (!subjectName) return subjectName || '';
    
    const trimmed = subjectName.trim();
    
    // Pattern 1: "CODE: Subject Name" format (e.g., "BP301T: Pharmaceutical Organic Chemistry")
    if (trimmed.includes(':')) {
      const parts = trimmed.split(':', 2);
      if (parts.length === 2) {
        const codePart = parts[0].trim();
        const subjectPart = parts[1].trim();
        // Check if first part looks like a course code (2-3 letters + 3 digits + optional letter)
        if (/^[A-Z]{2,3}\d{3}[A-Z]?$/.test(codePart)) {
          return subjectPart || '';
        }
      }
    }
    
    // Pattern 2: "CODE Subject Name" format (space instead of colon)
    const words = trimmed.split(/\s+/);
    if (words.length >= 2) {
      const firstWord = words[0];
      // Check if first word looks like a course code
      if (/^[A-Z]{2,3}\d{3}[A-Z]?$/.test(firstWord)) {
        return words.slice(1).join(' ').trim() || '';
      }
    }
    
    // If no pattern matches, return as-is
    return trimmed;
  }, []);

  // Consistent subject key for persistence/hydration
  const getSubjectKey = useCallback(() => {
    return subject?.id || subject?.fullTitle || cleanSubjectName(subject?.title || subject?.name || 'default');
  }, [subject, cleanSubjectName]);

  // Helper function to get topic key - useCallback for stable reference
  const getTopicKey = useCallback((unitIndex, topicIndex) => `${unitIndex}-${topicIndex}`, []);

  // Handle locked content clicks - show tooltip instead of redirecting
  const handleLockedContentClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Don't redirect, just prevent the click
  };

  // Mobile detection effect
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  // INSTANT DISPLAY: Reduce minimum loading time if content is preloaded
  useEffect(() => {
    const hasPreloadedContent = subject?.preloadedUnits && Array.isArray(subject.preloadedUnits) && subject.preloadedUnits.length > 0;
    const minTime = hasPreloadedContent ? 50 : 300; // 50ms if preloaded, 300ms otherwise
    
    const timer = setTimeout(() => {
      setMinLoadingComplete(true);
    }, minTime);

    return () => clearTimeout(timer);
  }, [subject?.preloadedUnits]);


  // Helper function to get current topic progress - uses ref to avoid direct reference to topicProgress
  // MUST be useCallback for stable reference in hooks
  const getCurrentTopicProgress = useCallback(() => {
    const topicKey = getTopicKey(selectedUnit, selectedTopic);
    // Read from ref which is updated via updateTopicProgress
    return topicProgressRef.current[topicKey] || { videoWatched: false, notesRead: false, quizCompleted: false };
  }, [selectedUnit, selectedTopic, getTopicKey]);

  // Helper function to update topic progress
  // MUST be useCallback for stable reference in hooks
  const updateTopicProgress = useCallback((step, completed = true) => {
    const topicKey = getTopicKey(selectedUnit, selectedTopic);
    setTopicProgress(prev => {
      const updated = {
        ...prev,
        [topicKey]: {
          ...prev[topicKey],
          [step]: completed
        }
      };
      // Update ref with new value
      topicProgressRef.current = updated;
      return updated;
    });
  }, [selectedUnit, selectedTopic, getTopicKey]);
  
  const takeQuizButtonRef = useRef(null);
  const videoContainerRef = useRef(null);
  const vimeoPlayerRef = useRef(null);

  // Removed updateTakeQuizPromptPosition - using tour cards instead

  const handleRegisterTakeQuizButton = useCallback(
    (node) => {
      takeQuizButtonRef.current = node;
    },
    []
  );

  const handleNotesReadyForQuiz = useCallback(() => {
    // Show tour step 5 (Take MCQs button) when notes are read
    // Check if this is the first time seeing the button (tour not dismissed)
    try {
      if (typeof window !== 'undefined') {
        const tourDismissed = window.localStorage.getItem('coursecontent-take-mcqs-tour-dismissed');
        if (!tourDismissed) {
          // Use requestAnimationFrame for immediate check, then fallback to setTimeout if needed
          const showTour = () => {
            if (takeQuizButtonRef.current) {
              const rect = takeQuizButtonRef.current.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0) {
                setLessonTourStep(5);
                return true;
              }
            }
            return false;
          };

          // Try immediately with requestAnimationFrame (faster)
          if (typeof window !== 'undefined') {
            requestAnimationFrame(() => {
              if (!showTour()) {
                // If button not ready, try again after a short delay
                setTimeout(() => {
                  if (!showTour()) {
                    // Last retry after slightly longer delay
                    setTimeout(showTour, 200);
                  }
                }, 100);
              }
            });
          }
        }
      }
    } catch (err) {
      console.error('Error showing tour:', err);
    }
  }, []);


  // Watch for when Take MCQs button becomes available and show tour
  useEffect(() => {
    // Only trigger step 5 if we're on notes tab and tour is not active
    if (activeTab === 'notes' && lessonTourStepRef.current === -1) {
      const progress = getCurrentTopicProgress();
      const notesRead = progress.notesRead || false;
      
      // Only show step 5 if notes are read and tour wasn't dismissed
      if (notesRead) {
        try {
          if (typeof window !== 'undefined') {
            const tourDismissed = window.localStorage.getItem('coursecontent-take-mcqs-tour-dismissed');
            if (!tourDismissed) {
              // Optimized check with faster timing
              const checkAndShowTour = () => {
                // Check if tour step is still -1 and button exists (use ref to avoid closure issues)
                if (lessonTourStepRef.current === -1 && takeQuizButtonRef.current) {
                  const rect = takeQuizButtonRef.current.getBoundingClientRect();
                  if (rect.width > 0 && rect.height > 0) {
                    // Use functional update to check current state (only set if currently -1)
                    setLessonTourStep((currentStep) => {
                      if (currentStep === -1) {
                        return 5;
                      }
                      return currentStep;
                    });
                    return true; // Successfully shown
                  }
                }
                return false; // Not ready yet
              };

              // Try immediately with requestAnimationFrame (faster than setTimeout)
              let timer1, timer2;
              if (typeof window !== 'undefined') {
                requestAnimationFrame(() => {
                  if (!checkAndShowTour()) {
                    // If not ready, try after a short delay
                    timer1 = setTimeout(() => {
                      if (!checkAndShowTour()) {
                        // Last retry after slightly longer delay
                        timer2 = setTimeout(checkAndShowTour, 150);
                      }
                    }, 100);
                  }
                });
              }
              
              return () => {
                if (timer1) clearTimeout(timer1);
                if (timer2) clearTimeout(timer2);
              };
            }
          }
        } catch (err) {
          console.error('Error in tour useEffect:', err);
        }
      }
    }
  }, [activeTab, getCurrentTopicProgress]);

  // Removed TakeQuizPrompt repositioning useEffect - using tour cards instead

  // Lesson product tour (multi-step) - already declared at line 247
  const leftPanelRef = useRef(null);
  const centerPanelRef = useRef(null);
  const aiTutorPanelRef = useRef(null);
  const contentAreaRef = useRef(null);

  // Protect lesson content: disable selection/copy/cut/paste/right-click and discourage PrintScreen
  useEffect(() => {
    const el = contentAreaRef.current;
    if (!el) return;

    let screenshotResetTimeout = null;

    const preventDefaultHandler = (e) => {
      try { e.preventDefault(); } catch {}
    };

    const applyScreenshotMask = () => {
      try {
        const previousFilter = el.style.filter;
        el.dataset.prevFilter = previousFilter ?? '';
        el.style.filter = 'brightness(0)';
        if (screenshotResetTimeout) {
          clearTimeout(screenshotResetTimeout);
        }
        screenshotResetTimeout = setTimeout(() => {
          try {
            const prev = el.dataset.prevFilter;
            el.style.filter = prev !== undefined ? prev : '';
            delete el.dataset.prevFilter;
          } catch {}
        }, 2000);
        try { navigator.clipboard && navigator.clipboard.writeText(''); } catch {}
      } catch {}
    };

    const handlePrintScreen = (e) => {
      if (!e) return;
      const key = typeof e.key === 'string' ? e.key : '';
      const keyLower = key.toLowerCase();
      const isPrintScreen = key === 'PrintScreen';
      const isSnippingShortcut = keyLower === 's' && e.shiftKey && (e.metaKey || e.ctrlKey);
      if (isPrintScreen || isSnippingShortcut) {
        applyScreenshotMask();
      }
    };

    el.addEventListener('contextmenu', preventDefaultHandler);
    el.addEventListener('copy', preventDefaultHandler);
    el.addEventListener('cut', preventDefaultHandler);
    el.addEventListener('paste', preventDefaultHandler);
    document.addEventListener('keydown', handlePrintScreen);
    document.addEventListener('keyup', handlePrintScreen);

    return () => {
      try {
        el.removeEventListener('contextmenu', preventDefaultHandler);
        el.removeEventListener('copy', preventDefaultHandler);
        el.removeEventListener('cut', preventDefaultHandler);
        el.removeEventListener('paste', preventDefaultHandler);
      } catch {}
      document.removeEventListener('keyup', handlePrintScreen);
      document.removeEventListener('keydown', handlePrintScreen);
      if (screenshotResetTimeout) {
        clearTimeout(screenshotResetTimeout);
      }
    };
  }, []);
  
  // Video loading state management
  const [isVideoLoading, setIsVideoLoading] = useState(false);
  const [videoLoadError, setVideoLoadError] = useState(null);
  const videoChangeTimeoutRef = useRef(null);
  const lastVideoIdRef = useRef(null);

  const enterFullscreen = useCallback(() => {
    const reqFs = (el) => {
      if (!el) return false;
      if (el.requestFullscreen) { el.requestFullscreen(); return true; }
      if (el.webkitRequestFullscreen) { el.webkitRequestFullscreen(); return true; }
      if (el.msRequestFullscreen) { el.msRequestFullscreen(); return true; }
      if (el.mozRequestFullScreen) { el.mozRequestFullScreen(); return true; }
      return false;
    };
    let did = false;
    if (vimeoPlayerRef && vimeoPlayerRef.current && typeof vimeoPlayerRef.current.requestFullscreen === 'function') {
      try {
        const p = vimeoPlayerRef.current.requestFullscreen();
        if (p && typeof p.catch === 'function') { p.catch(() => {}); }
        did = true;
      } catch {}
    }
    if (!did) {
      did = reqFs(videoContainerRef?.current);
    }
    if (!did) {
      setTimeout(() => {
        if (vimeoPlayerRef && vimeoPlayerRef.current && typeof vimeoPlayerRef.current.requestFullscreen === 'function') {
          try {
            const p2 = vimeoPlayerRef.current.requestFullscreen();
            if (p2 && typeof p2.catch === 'function') { p2.catch(() => {}); }
          } catch {}
        } else {
          reqFs(videoContainerRef?.current);
        }
      }, 300);
    }
  }, []);

  // Sync ref with state to avoid TDZ issues in useEffects
  // Directly access lessonTourStep - it's declared before this effect, so it's safe
  useEffect(() => {
    lessonTourStepRef.current = lessonTourStep;
  }, [lessonTourStep]);

  // Show lesson tour when arriving from Overview CTA (only if onboarding just completed)
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        // Check if onboarding just completed
        const onboardingJustCompleted = window.localStorage.getItem('onboarding-just-completed') === 'true';
        const flag = window.localStorage.getItem('show-coursecontent-video-tour');
        // Only show tour if flag is set AND onboarding just completed
        if (flag === '1' && onboardingJustCompleted) {
          window.localStorage.removeItem('show-coursecontent-video-tour');
          // Small delay to ensure refs are ready
          const timer = setTimeout(() => {
            setLessonTourStep(0);
            setActiveTab('video');
          }, 300);
          return () => clearTimeout(timer);
        } else {
          // Clear flag if it exists but onboarding didn't just complete
          if (flag === '1') {
            window.localStorage.removeItem('show-coursecontent-video-tour');
          }
          // Ensure no stray flags cause jumping to final step
          try { window.localStorage.removeItem('lesson-tour-once'); } catch {}
          // Use functional update to avoid referencing lessonTourStep directly
          setLessonTourStep((currentStep) => {
            if (currentStep !== -1) {
              return -1;
            }
            return currentStep;
          });
        }
      }
    } catch (err) {
      console.error('❌ Error in tour initialization:', err);
    }
  }, []);

  // Quiz handlers will be initialized after currentTopic and currentUnit are defined
  
  // Compatibility setters (for code that might still reference them)
  const setQuizQuestions = useCallback((questions) => {
    console.warn('setQuizQuestions called - quiz questions are managed by useQuizHandlers hook');
  }, []);
  
  const setIsQuizLoading = useCallback((loading) => {
    console.warn('setIsQuizLoading called - loading state is managed by useQuizHandlers hook');
  }, []);
  
  const setQuizError = useCallback((error) => {
    console.warn('setQuizError called - error state is managed by useQuizHandlers hook');
  }, []);

  // AI Tutor state
  const [currentDocumentId, setCurrentDocumentId] = useState(null);
  const [documentContent, setDocumentContent] = useState(null);
  const [isDocumentLoading, setIsDocumentLoading] = useState(false);
  const lastDocFetchRef = useRef(null);

  const [topicStartTime, setTopicStartTime] = useState(null);

  // Prevent parent (unitsContainer) from scrolling when the topics list can scroll
  const handleTopicsWheel = useCallback((e) => {
    if (isMobile) return; // desktop-only behavior
    const el = e.currentTarget;
    const canScrollDown = el.scrollTop + el.clientHeight < el.scrollHeight;
    const canScrollUp = el.scrollTop > 0;
    if ((e.deltaY > 0 && canScrollDown) || (e.deltaY < 0 && canScrollUp)) {
      // Allow the topics list to consume the wheel and stop it from bubbling to unitsContainer
      e.stopPropagation();
    }
  }, [isMobile]);

  // Ref will be initialized when updateTopicProgress is first called
  // No useEffect needed - ref starts empty and gets updated via setTopicProgress

  // Sync expanded unit with selectedUnit when selection changes
  // Only auto-expand if user hasn't manually interacted with units
  useEffect(() => {
    if (selectedUnit >= 0 && !preventAutoExpand && !hasManuallyExpandedUnit) {
      // Skip auto-expanding on mobile to avoid default expanding Unit 1.
      // Mobile expansion is user-driven via handleMobileUnitToggle.
      if (!isMobile) {
        setDesktopExpandedUnit(selectedUnit);
      }
    }
  }, [isMobile, selectedUnit, preventAutoExpand, hasManuallyExpandedUnit]);

  // Generate course data with error handling
  const courseData = useMemo(() => {
    if (!subject) {
      return null;
    }


    try {
      // Transform backend response to match frontend expectations
      const transformUnits = (units) => {
        if (!Array.isArray(units)) return [];
        
        return units.map((unit, unitIndex) => {
          // Validate unit structure
          if (!unit || typeof unit !== 'object') {
            console.warn(`Invalid unit at index ${unitIndex}:`, unit);
            return {
              title: `Unit ${unitIndex + 1}`,
              topics: []
            };
          }
          
          return {
            title: unit.name || unit.title,
            topics: Array.isArray(unit.topics) ? unit.topics.map((topic, topicIndex) => {
              // Handle string topics
              if (typeof topic === 'string') {
                return {
                  title: topic,
                  duration: '15 min',
                  videoUrl: null,
                  files: [],
                  hasVideo: true, // Assume true to trigger fetch
                  hasDocument: false,
                  isAccessible: true,
                  isLocked: false,
                  // Remove isCompleted so checkTopicCompletion can use API/cache
                  description: 'Topic content'
                };
              }

              // Validate topic structure
              if (!topic || typeof topic !== 'object') {
                console.warn(`Invalid topic at unit ${unitIndex}, topic ${topicIndex}:`, topic);
                return null; // Skip invalid topics
              }
              
              // Process topic data
              const hasExistingVideo = Boolean(topic.hasVideo && topic.videoUrl);
              return {
                title: topic.topicName || topic.title,
                duration: topic.duration || '15 min',
                videoUrl: topic.videoUrl || null,
                files: Array.isArray(topic.files) ? topic.files : [],
                hasVideo: hasExistingVideo || true, // Assume true for Year 2+ topics to show icon
                hasDocument: Boolean(topic.hasDocument && Array.isArray(topic.files) && topic.files.length > 0),
                isAccessible: topic.isAccessible !== false,
                isLocked: Boolean(topic.isLocked),
                // Remove isCompleted so checkTopicCompletion can use API/cache
                description: topic.description || 'Topic content'
              };
            }).filter(topic => topic !== null) : []
          };
        });
      };

      // Validate subject structure
      const validatedSubject = {
        title: subject.title || subject.fullTitle || 'Course',
        preloadedUnits: Array.isArray(subject.preloadedUnits) ? subject.preloadedUnits : []
      };

      const subjectForCourse = validatedSubject;

      const data = {
        title: validatedSubject.title,
        units: transformUnits(validatedSubject.preloadedUnits)
      };
      
      return data;
    } catch (err) {
      console.error('❌ Error creating course data:', err);
      
      // Return empty data - only display what comes from backend
      return {
        title: subject?.title || subject?.fullTitle || 'Course',
        units: []
      };
    }
  }, [subject]);

  const hasUnits = useMemo(() => Array.isArray(courseData?.units) && courseData.units.length > 0, [courseData]);

  const hasCourseTopics = useMemo(() => {
    if (!courseData?.units?.length) return false;
    return courseData.units.some(unit => Array.isArray(unit.topics) && unit.topics.length > 0);
  }, [courseData]);

  // Loading state management with skeleton loading
  useEffect(() => {
    if (!subject) {
      setShowContent(false);
      setIsLoading(false);
      return;
    }

    // If external loading (from parent), keep showing skeleton
    if (externalLoading) {
      setShowContent(false);
      setIsLoading(true);
      return;
    }

    // Always wait for minimum loading time to ensure skeleton is visible
    if (!minLoadingComplete) {
      setShowContent(false);
      setIsLoading(true);
      return;
    }

    if (!courseData) {
      setShowContent(false);
      setIsLoading(true);
      return;
    }

    if (hasCourseTopics) {
      setShowContent(true);
      setIsLoading(false);
      return;
    }
    setShowContent(true);
    setIsLoading(false);
  }, [subject, courseData, externalLoading, minLoadingComplete, hasCourseTopics]);

  // Completion state and helpers now come from useQuizHandlers (see destructuring)

  // Helper function to check if a tab is accessible - uses completion state from hook
  const isTabAccessible = (tab) => {
    const isCompleted = selectedUnit !== null && selectedTopic !== null ? isTopicCompleted(selectedUnit, selectedTopic) : false;
    
    if (isCompleted === true) {
      const blocked = tab === 'quiz';
      return !blocked;
    }
    
    // If completion status is unknown (undefined), allow access to avoid blocking the user while fetching
    if (isCompleted === undefined) {
      return true;
    }
    
    const progress = getCurrentTopicProgress();
    
    const videoWatched = progress.videoWatched || false;
    const notesRead = progress.notesRead || false;
    const quizCompleted = progress.quizCompleted || false;
    
    switch (tab) {
      case 'video':
        return true;
      case 'notes':
        return videoWatched;
      case 'quiz':
        return videoWatched && notesRead;
      default:
        return false;
    }
  };

  // Helper function to get next accessible tab
  const getNextAccessibleTab = () => {
    const progress = getCurrentTopicProgress();
    
    if (!progress.videoWatched) return 'video';
    if (!progress.notesRead) return 'notes';
    if (!progress.quizCompleted) return 'quiz';
    return null;
  };

  // Completion hydration/persistence handled in useQuizHandlers


  // Bulk completion handled in useQuizHandlers

  // Helper function to check if a topic is the next uncompleted topic
  const isNextUncompletedTopic = useCallback((unitIdx, topicIdx) => {
    // Always return false to prevent any next topic highlighting
    return false;
  }, []);

  // Function to find topic by name
  const findTopicByName = (topicName, units) => {
    if (!topicName || !units) return null;
    
    for (let unitIndex = 0; unitIndex < units.length; unitIndex++) {
      const unit = units[unitIndex];
      if (unit.topics) {
        for (let topicIndex = 0; topicIndex < unit.topics.length; topicIndex++) {
          const topic = unit.topics[topicIndex];
          if (topic.title && topic.title.toLowerCase().includes(topicName.toLowerCase())) {
            return { unitIndex, topicIndex };
          }
        }
      }
    }
    return null;
  };

  // Handle URL parameters for direct topic navigation
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const topicParam = urlParams.get('topic');
      
      if (topicParam && courseData && courseData.units) {
        const topicLocation = findTopicByName(topicParam, courseData.units);
        
        if (topicLocation) {
          // Mark as manual selection to prevent auto-select logic from overriding
          setUserManualSelection(true);
          setPreventAutoExpand(false);
          setPreventAutoOpenOnMobile(false);
          selectedFromURLRef.current = true; // persist suppression

          setSelectedUnit(topicLocation.unitIndex);
          setSelectedTopic(topicLocation.topicIndex);
          setActiveTab('video');

          // Fetch supporting content immediately
          fetchDocumentForTopic(topicLocation.unitIndex, topicLocation.topicIndex);

          // Optionally release manual selection flag (keep URL-origin suppression)
          setTimeout(() => {
            setUserManualSelection(false);
          }, 2000);
        } else {
        }
      }
    }
  }, [courseData]);

  // Current unit and topic
  const currentUnit = useMemo(() => {
    return courseData?.units[selectedUnit] || null;
  }, [courseData, selectedUnit]);

  const currentTopic = useMemo(() => {
    if (selectedUnit < 0 || !currentUnit) return null;
    const topic = currentUnit?.topics[selectedTopic] || null;
    
    // Debug logging for current topic
    if (topic) {
    } else {
    }
    
    return topic;
  }, [currentUnit, selectedTopic, selectedUnit]);

  // Fetch video URL for current topic if not already provided in curriculum data
  useEffect(() => {
    const fetchVideoContent = async () => {
      if (!currentTopic || !currentTopic.title) {
        setFetchedVideoUrl(null);
        return;
      }

      // If videoUrl already exists in topic, use it (backward compatibility)
      if (currentTopic.videoUrl) {
        setFetchedVideoUrl(currentTopic.videoUrl);
        setIsVideoLoading(false);
        return;
      }

      try {
        setIsVideoLoading(true);
        const response = await studentContentAPI.getTopicContent(currentTopic.title, 'video');
        
        if (response && response.items && response.items.length > 0) {
          const item = response.items[0];
          
          if (item.video_url) {
            // If it's an internal API path, prefix with base URL
            if (item.video_url.startsWith('/api/')) {
              setFetchedVideoUrl(`${getApiBaseUrl()}${item.video_url}`);
            } else {
              // External URL (e.g., Vimeo)
              setFetchedVideoUrl(item.video_url);
            }
          } else {
            setFetchedVideoUrl(null);
          }
        } else {
          setFetchedVideoUrl(null);
        }
      } catch (error) {
        console.error('❌ Error fetching topic video:', error);
        setFetchedVideoUrl(null);
      } finally {
        setIsVideoLoading(false);
      }
    };

    fetchVideoContent();
  }, [currentTopic]);

  const totalTopics = useMemo(() => {
    return (
      courseData?.units.reduce((total, unit) => total + unit.topics.length, 0) || 0
    );
  }, [courseData]);

  const currentTopicIndex = useMemo(() => {
    if (!courseData || selectedUnit < 0) return 0;
    let index = 0;
    for (let i = 0; i < selectedUnit; i++) {
      index += courseData.units[i].topics.length;
    }
    return index + selectedTopic + 1;
  }, [courseData, selectedUnit, selectedTopic]);

  // Removed body class toggling to avoid global repaint

  // Add course content class to body and html when component mounts
  useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const body = document.body;
    const html = document.documentElement;

    body.classList.add('course-content-active');
    html.classList.add('course-content-active');

    let isIOS = false;
    if (typeof navigator !== 'undefined') {
      const ua = navigator.userAgent || '';
      isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
      if (isIOS) {
        body.classList.add('ios');
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('course-content-toggle'));
    }

    return () => {
      body.classList.remove('course-content-active');
      html.classList.remove('course-content-active');
      if (isIOS) {
        body.classList.remove('ios');
      }
      // Restore scrolling by removing inline styles
      body.style.overflow = '';
      body.style.height = '';
      html.style.overflow = '';
      html.style.height = '';
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('course-content-toggle'));
      }
    };
  }, []);


  // Function to fetch document ID and content for AI Tutor
  const fetchDocumentForTopic = useCallback(async (unitIdx, topicIdx) => {
    if (!courseData || !subject) return;
    
    const unit = courseData.units[unitIdx];
    const topic = unit?.topics[topicIdx];
    
    if (!topic || !subject.fullPath) {
      setCurrentDocumentId(null);
      setDocumentContent(null);
      return;
    }

    // Build the full path: subject.fullPath/Unit Name/Topic Name
    const fullPath = `${subject.fullPath}/${unit.title}/${topic.title}`;

    // Deduplicate only after a successful fetch; allow retry if we still have no document id
    if (lastDocFetchRef.current === fullPath && currentDocumentId) {
      return;
    }
    lastDocFetchRef.current = fullPath;

    setIsDocumentLoading(true);
    
    try {
      // Get document ID
      let resolvedDocumentId = null;

      console.log('📂 AI Tutor document lookup', {
        fullPath,
        files: Array.isArray(topic.files) ? topic.files : []
      });

      // 1) Prefer topic/university-based lookup (new) with fullPath as hint
      const documentIdResponse = await subjectContentAPI.getDocumentId({
        topic: topic.title,
        university: (user?.university || subject?.university || subject?.university_name || 'PCI'),
        fullPath
      });
      if (documentIdResponse?.success && documentIdResponse.document_id) {
        resolvedDocumentId = documentIdResponse.document_id;
      } else {
        // 2) Fallback: try resolving via S3/file key if the topic has a document file
        const files = Array.isArray(topic.files) ? topic.files : [];
        for (const file of files) {
          const type = (file?.file_type || file?.type || '').toLowerCase();
          const mime = (file?.mime_type || file?.mimeType || '').toLowerCase();
          const name = (file?.name || file?.title || '').toLowerCase();
          const isDoc = type.includes('document') || type.includes('pdf') || mime.includes('pdf') || name.endsWith('.pdf');
          if (!isDoc) continue;

          const docKey = file?.s3_key || file?.file_key || file?.key;
          if (!docKey) continue;

          console.log('🔑 AI Tutor: trying document lookup by key', { docKey, file });
          try {
            const keyResponse = await subjectContentAPI.getDocumentIdFromKey(docKey);
            if (keyResponse?.success && keyResponse.document_id) {
              resolvedDocumentId = keyResponse.document_id;
              break;
            } else if (keyResponse?.potential_matches) {
              console.log('🧐 AI Tutor: no exact key match; potential matches', keyResponse.potential_matches);
            }
          } catch (keyErr) {
            console.warn('AI Tutor: document ID lookup by key failed', keyErr);
          }
        }
      }

      if (resolvedDocumentId) {
        console.log('✅ AI Tutor: resolved document ID', resolvedDocumentId);
        setCurrentDocumentId(resolvedDocumentId);

        // Optionally fetch document content for better context
        try {
          const notesResponse = await subjectContentAPI.getNotesByDocumentId(resolvedDocumentId);
          if (notesResponse.found) {
            setDocumentContent(notesResponse);
          }
        } catch (contentError) {
          setDocumentContent(null);
        }
      } else {
        setCurrentDocumentId(null);
        setDocumentContent(null);
      }
    } catch (error) {
      console.error('❌ Error fetching document for AI Tutor:', error);
      setCurrentDocumentId(null);
      setDocumentContent(null);
    } finally {
      setIsDocumentLoading(false);
    }
  }, [courseData, subject]);

  // State to track if we're in the middle of quiz completion navigation
  // MUST be defined before useQuizHandlers since it's passed as a dependency
  const [isNavigatingAfterQuiz, setIsNavigatingAfterQuiz] = useState(false);

  // Quiz handlers - all quiz-related functionality extracted to useQuizHandlers hook
  // MUST be called after currentTopic, currentUnit, fetchDocumentForTopic, and isNavigatingAfterQuiz are defined
  const {
    // Quiz generation state
    isQuizLoading,
    quizError,
    quizQuestions,
    quizMetadata,
    quizCompleted,
    quizScore,
    generateQuizFromHook,
    resetQuizFromHook,
    setQuizCompleted,
    setQuizScore,
    setQuizMetadata,
    // Quiz UI state
    quizIndex,
    setQuizIndex,
    selectedOption,
    setSelectedOption,
    showQuizResults,
    setShowQuizResults,
    showCompletedQuizModal,
    setShowCompletedQuizModal,
    // Quiz handlers
    fetchQuizForTopic,
    handleQuizSubmit,
    handleQuizCompletionNavigation,
    // Completion state/helpers
    topicCompletionStatus,
    completionCheckComplete,
    isTopicCompleted,
    forceRefreshCompletion,
    getSequentialCompletionEnd,
    getNextUncompletedTopic: getNextUncompletedTopicFromHook,
    getNextTopicForward: getNextTopicForwardFromHook,
    getLatestCompletedTopic,
    markCompletedLocal,
    fetchCompletion
  } = useQuizHandlers({
    currentTopic,
    subject,
    courseData,
    selectedUnit,
    selectedTopic,
    currentUnit,
    cleanSubjectName,
    updateTopicProgress,
    getCurrentTopicProgress,
    onRefreshCourseData,
    fetchDocumentForTopic,
    isMobile,
    preventAutoOpenOnMobile,
    preventAutoExpand,
    setMobileExpandedUnit,
    setDesktopExpandedUnit,
    setSelectedUnit,
    setSelectedTopic,
    setActiveTab,
    setIsNavigatingAfterQuiz
  });

  // Helper function to ensure last completed topic stays highlighted
  const ensureLastCompletedTopicHighlighted = useCallback(() => {
    if (!courseData) return;
    // Do not override user's manual selection
    if (userManualSelection) {
      return;
    }
    
    // Check if all topics are completed
    const nextTopic = getNextUncompletedTopicFromHook();
    if (!nextTopic) {
      // All topics completed, find the last completed topic
      const lastCompleted = getLatestCompletedTopic();
      if (lastCompleted && (selectedUnit !== lastCompleted.unitIndex || selectedTopic !== lastCompleted.topicIndex)) {
        setSelectedUnit(lastCompleted.unitIndex);
        setSelectedTopic(lastCompleted.topicIndex);
      }
    }
  }, [courseData, getNextUncompletedTopicFromHook, getLatestCompletedTopic, selectedUnit, selectedTopic, userManualSelection]);

  // Ensure last completed topic stays highlighted when all topics are completed
  useEffect(() => {
    if (courseData && completionCheckComplete) {
      // Don't auto-adjust if user is interacting
      if (userManualSelection) return;
      ensureLastCompletedTopicHighlighted();
    }
  }, [courseData, completionCheckComplete, ensureLastCompletedTopicHighlighted, topicCompletionStatus, userManualSelection]);

  // Wrapper function to generate quiz for current topic (uses generateQuizFromHook from hook)
  const generateQuizForTopic = useCallback(async () => {
    if (!currentTopic || !subject || !currentUnit) return;
    
    // Generate quiz from content_library document
    await generateQuizFromHook(currentTopic.title, subject, currentUnit);
  }, [currentTopic, subject, currentUnit, generateQuizFromHook]);

  // Generate quiz when quiz tab is activated
  useEffect(() => {
    if (activeTab === 'quiz' && currentTopic) {
      generateQuizForTopic();
    }
  }, [activeTab, currentTopic, generateQuizForTopic]);

  // Reset to appropriate topic when course data changes AND completion checking is done
  // This is the INITIAL sync - it should only run ONCE per subject
  useEffect(() => {
    if (courseData?.units.length > 0 && completionCheckComplete && !initialSyncRunRef.current && !isNavigatingAfterQuiz && !userManualSelection && !selectedFromURLRef.current && !(isMobile && preventAutoOpenOnMobile)) {
      // Mark initial sync as done so it doesn't re-run on subsequent progress updates
      initialSyncRunRef.current = true;
      
      let selectedUnitIdx = 0;
      let selectedTopicIdx = 0;
      
      // Always prioritize showing the next uncompleted topic (the one with blue highlight)
      const nextTopic = getNextUncompletedTopicFromHook();
      if (nextTopic) {
        selectedUnitIdx = nextTopic.unitIndex;
        selectedTopicIdx = nextTopic.topicIndex;
      } else {
        // All topics completed, find the latest completed topic
        const latestCompletedTopic = getLatestCompletedTopic();
        if (latestCompletedTopic) {
          selectedUnitIdx = latestCompletedTopic.unitIndex;
          selectedTopicIdx = latestCompletedTopic.topicIndex;
        } else {
          selectedUnitIdx = 0;
          selectedTopicIdx = 0;
        }
      }
      
      console.log('🏁 CourseContent: Performing initial topic selection sync:', { unit: selectedUnitIdx, topic: selectedTopicIdx });
      setSelectedUnit(selectedUnitIdx);
      setSelectedTopic(selectedTopicIdx);
      setActiveTab('video');
      setPreventAutoExpand(false); // Ensure unit is expanded if a topic is selected
      
      // Fetch document for the selected topic
      fetchDocumentForTopic(selectedUnitIdx, selectedTopicIdx);
      
    }
  }, [courseData, completionCheckComplete, isNavigatingAfterQuiz, getLatestCompletedTopic, getNextUncompletedTopicFromHook, userManualSelection, isMobile, preventAutoOpenOnMobile]);

  // Effect to update selection when completion status changes (to show next uncompleted topic)
  // But only if user hasn't manually selected a topic AND the current topic is actually finished
  useEffect(() => {
    // Only auto-navigate if the CURRENT topic is confirmed as COMPLETED.
    // This prevents jumping to the next topic just because a video ended or status is being refreshed.
    const isCurrentTopicDone = selectedUnit !== null && selectedTopic !== null ? isTopicCompleted(selectedUnit, selectedTopic) : false;

    // Only auto-navigate if we are on the quiz tab AND the current topic is done.
    // This prevents jumping to next topic when video ends or while reading notes.
    if (courseData?.units.length > 0 && completionCheckComplete && isCurrentTopicDone === true && activeTab === 'quiz' && !isNavigatingAfterQuiz && !userManualSelection && !selectedFromURLRef.current && !(isMobile && preventAutoOpenOnMobile)) {
      const nextTopic = getNextUncompletedTopicFromHook();
      if (nextTopic && (selectedUnit !== nextTopic.unitIndex || selectedTopic !== nextTopic.topicIndex)) {
        console.log('⏭️ Auto-navigating to next uncompleted topic:', nextTopic);
        setSelectedUnit(nextTopic.unitIndex);
        setSelectedTopic(nextTopic.topicIndex);
        setActiveTab('video');
        setPreventAutoExpand(false); // Ensure unit is expanded if a topic is selected
        fetchDocumentForTopic(nextTopic.unitIndex, nextTopic.topicIndex);
      }
    }
  }, [topicCompletionStatus, activeTab, courseData, completionCheckComplete, isNavigatingAfterQuiz, selectedUnit, selectedTopic, getNextUncompletedTopicFromHook, userManualSelection, isMobile, preventAutoOpenOnMobile]);

  // Navigation handler: Back to subjects
  const handleBackToSubjects = useCallback(() => {
    if (typeof onBack === 'function') {
      try { onBack(); } catch (e) { /* no-op */ }
      return;
    }
    router.push('/course');
  }, [onBack, router]);

  // Handle unit and topic selection...
  const handleUnitSelect = useCallback((unitIndex) => {
    if (unitIndex >= 0 && unitIndex < (courseData?.units.length || 0)) {
      // Mark that user has manually interacted with unit expansion
      setHasManuallyExpandedUnit(true);
      
      // Mark as manual interaction to prevent auto-select effects from re-opening units on mobile
      setUserManualSelection(true);
      
      // Keep the manual selection flag active for a longer period to prevent auto-interference
      setTimeout(() => {
        setUserManualSelection(false);
      }, 2000); // 2 seconds should be enough to prevent auto-selection interference
      
      // Check if this unit is currently expanded
      const currentlyExpanded = isMobile ? mobileExpandedUnit : desktopExpandedUnit;
      const isClosing = currentlyExpanded === unitIndex;
      
      if (isClosing) {
        // Collapse the unit - just hide topics list, keep content visible
        if (isMobile) {
          setMobileExpandedUnit(-1);
        } else {
          setDesktopExpandedUnit(-1);
        }
        setPreventAutoOpenOnMobile(true);
      } else {
        // Expand the unit and select first topic
        setSelectedUnit(unitIndex);
        setSelectedTopic(0);
        setActiveTab('video');
        setPreventAutoExpand(false);
        setPreventAutoOpenOnMobile(false);
        
        // Set the expanded unit state
        if (isMobile) {
          setMobileExpandedUnit(unitIndex);
        } else {
          setDesktopExpandedUnit(unitIndex);
        }
        
        // Fetch document for the first topic
        fetchDocumentForTopic(unitIndex, 0);
      }
    }
  }, [courseData, isMobile, mobileExpandedUnit, desktopExpandedUnit, fetchDocumentForTopic]);

  // Mobile-only: toggle unit topics list without affecting selected content
  const handleMobileUnitToggle = useCallback((unitIndex) => {
    if (!isMobile) {
      // Fallback to normal select behavior on non-mobile
      handleUnitSelect(unitIndex);
      return;
    }
    const isClosing = mobileExpandedUnit === unitIndex;
    if (isClosing) {
      setPreventAutoOpenOnMobile(true);
      setMobileExpandedUnit(-1);
      // Keep selectedUnit/selectedTopic unchanged to preserve visible content
    } else {
      // Mark that user has manually expanded a unit so auto-sync doesn't override on mobile
      setHasManuallyExpandedUnit(true);
      setPreventAutoOpenOnMobile(false);
      setMobileExpandedUnit(unitIndex);
      // Optionally align selected content with newly opened unit
      setSelectedUnit(unitIndex);
      setSelectedTopic(0);
      setActiveTab('video');
    }
  }, [isMobile, mobileExpandedUnit, handleUnitSelect]);

  const handleTopicSelect = useCallback((unitIdx, topicIdx) => {
    // Removed prompt state updates - using tour cards instead

    if (
      unitIdx >= 0 &&
      unitIdx < (courseData?.units.length || 0) &&
      topicIdx >= 0 &&
      topicIdx < (courseData?.units[unitIdx]?.topics.length || 0)
    ) {
      // Force immediate state update for mobile
      // Track topic start time
      setTopicStartTime(Date.now());
      
      // Mark as manual selection to prevent auto-redirect
      setUserManualSelection(true);
      // User explicitly selected a topic; allow auto logic in future navigations
      selectedFromURLRef.current = false;
      setPreventAutoExpand(false);
      // On mobile, explicit topic selection should allow opening
      if (isMobile) {
        setPreventAutoOpenOnMobile(false);
      }
      
      // Force immediate state updates - critical for mobile
      setSelectedUnit(unitIdx);
      setSelectedTopic(topicIdx);
      setActiveTab('video');
      
      // Fetch document ID for the selected topic
      fetchDocumentForTopic(unitIdx, topicIdx);
      
      // Check if this is the last completed topic and all topics are completed
      const isLastCompletedTopic = isTopicCompleted(unitIdx, topicIdx) && !getNextUncompletedTopicFromHook();
      if (isLastCompletedTopic) {
      }
    } else {
      console.error(`❌ INVALID TOPIC SELECTION: unitIdx=${unitIdx}, topicIdx=${topicIdx}`);
    }
  }, [courseData, isTopicCompleted, getNextUncompletedTopicFromHook, isMobile]);

  useEffect(() => {
    // Removed prompt state updates - using tour cards instead
  }, [selectedUnit, selectedTopic]);


  const handleTabChange = useCallback(async (tab) => {
    if (!['video', 'notes', 'quiz'].includes(tab)) return;

    // Check if current topic is completed
      const isCurrentTopicCompleted = selectedUnit !== null && selectedTopic !== null && isTopicCompleted(selectedUnit, selectedTopic);
      
    // Always allow switching if topic is completed (except blocking quiz retake)
    if (isCurrentTopicCompleted === true) {
        if (tab === 'quiz') {
          setShowCompletedQuizModal(true);
          return;
        }
        setActiveTab(tab);
        return;
      }
      
    // For non-completed or unknown topics, use isTabAccessible check
    // but with a special case for 'notes' to be more permissive
    const isAccessible = isTabAccessible(tab);
    
    // DEBUG: Log tab change attempt
    console.log(`🔄 Attempting to switch to tab: ${tab}, isAccessible: ${isAccessible}`);
          
    if (isAccessible || tab === 'notes' || tab === 'video') {
      console.log(`✅ Setting active tab to: ${tab}`);
        setActiveTab(tab);
        
      // Load content if switching to specific tabs
      if (tab === 'notes') {
        console.log('📖 Switching to notes, triggering document fetch...');
        fetchDocumentForTopic(selectedUnit, selectedTopic);
      } else if (tab === 'quiz') {
        fetchQuizForTopic(selectedUnit, selectedTopic);
      }
    } else {
      console.warn(`🚫 Access denied to tab: ${tab}`);
    }
  }, [selectedUnit, selectedTopic, isTabAccessible, isTopicCompleted, fetchDocumentForTopic, fetchQuizForTopic]);

  // handleQuizCompletionNavigation is now provided by useQuizHandlers hook

  const handleNextAction = useCallback(() => {
    // Log current document context whenever the user clicks the primary "start/continue" button
    console.log('📄 Start/Continue clicked', {
      activeTab,
      documentId: currentDocumentId,
      topic: currentTopic?.title || null
    });

    if (!courseData || !courseData.units || selectedUnit < 0) {
      console.warn('Cannot proceed with next action: missing course data or invalid selectedUnit');
      return;
    }

    // Removed prompt check - using tour cards instead
    if (activeTab === 'video') {
      // Mark video as watched and move to notes
      const topicKey = getTopicKey(selectedUnit, selectedTopic);
      // Update state and ref synchronously
      setTopicProgress(prev => {
        const updated = {
          ...prev,
          [topicKey]: {
            ...prev[topicKey],
            videoWatched: true
          }
        };
        // Update ref immediately with new value
        topicProgressRef.current = updated;
        return updated;
      });
      
      // Use handleTabChange to ensure proper tab switching with all checks
      handleTabChange('notes');
    } else if (activeTab === 'notes') {
      // Mark notes as read and move to quiz
      updateTopicProgress('notesRead', true);
      
      // Mark notes as completed for task tracking
      if (currentTopic) {
        const markNotesCompleted = async () => {
          try {
            const token = localStorage.getItem('token');
            if (!token) {
              console.warn('No auth token found, skipping notes completion tracking');
              return;
            }

            // Determine subject/topic identifiers for study plan tracking
            const subjectName = subject?.name || subject?.fullTitle || subject?.title || '';
            const topicName = currentTopic?.title || 'Unknown Topic';

            if (!subjectName) {
              console.warn('Unable to determine subject name for study plan tracking');
              return;
            }

            // First, find the correct study plan task ID based on subject and topic
            const findTaskResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app'}/api/study-plan/task/find-by-topic?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topicName)}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              }
            });

            if (!findTaskResponse.ok) {
              console.warn('Could not find study plan task, skipping notes completion tracking');
              return;
            }

            const taskInfo = await findTaskResponse.json();
            if (!taskInfo.task_id) {
              console.warn('No study plan task found for this topic, skipping notes completion tracking');
              return;
            }
            // Now mark the notes as completed using the correct task ID
            const taskData = {
              task_id: taskInfo.task_id
            };
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app'}/api/study-plan/task/mark-notes-completed`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(taskData)
            });

            if (response.ok) {
              const data = await response.json();
              // Dispatch custom event to notify other components about study plan update
              window.dispatchEvent(new CustomEvent('study-plan-updated', { 
                detail: { 
                  type: 'notes-completed',
                  taskId: taskInfo.task_id,
                  subject: subject,
                  topic: currentTopic?.title
                } 
              }));
            } else {
              console.error('❌ Failed to track task notes completion:', response.statusText);
            }
          } catch (error) {
            console.error('❌ Error tracking task notes completion:', error);
          }
        };

        markNotesCompleted();
      }
      
      setActiveTab('quiz');
      
      // Ensure quiz is loaded
      if (currentTopic) {
        fetchQuizForTopic(selectedUnit, selectedTopic);
      }
      } else if (activeTab === 'quiz') {
        // Mark quiz as completed and move to next topic
        updateTopicProgress('quizCompleted', true);
        
        // Mark current topic as completed in completion status
        const currentTitle = currentTopic?.title;
        if (currentTitle && markCompletedLocal) {
          markCompletedLocal(currentTitle);
        }
        
        // Check if tour card is showing - if so, don't auto-navigate yet
        if (lessonTourStepRef.current === 7) {
          return; // Don't navigate while tour is showing
        }
        
        // Find next topic forward (unknown/false), fallback to global uncompleted
        let nextTopic = getNextTopicForwardFromHook();
        if (!nextTopic) {
          nextTopic = getNextUncompletedTopicFromHook();
        }
        if (nextTopic) {
          if (!(isMobile && preventAutoOpenOnMobile) && !preventAutoExpand) {
            // Update selected topic and unit
            setSelectedUnit(nextTopic.unitIndex);
            setSelectedTopic(nextTopic.topicIndex);
            setActiveTab('video');
            // Ensure the corresponding unit is visually expanded for highlight
            if (isMobile) {
              setMobileExpandedUnit(nextTopic.unitIndex);
            } else {
              setDesktopExpandedUnit(nextTopic.unitIndex);
            }
            
            // Fetch document for the new topic
            fetchDocumentForTopic(nextTopic.unitIndex, nextTopic.topicIndex);
            
            // Show completion feedback
          } else {
          }
        } else {
          // Stay on the current (last) topic and keep it highlighted
          // Don't change selectedUnit/selectedTopic to maintain the blue highlight
        }
      }
  }, [activeTab, selectedTopic, selectedUnit, courseData, currentUnit, currentTopic, updateTopicProgress, getNextUncompletedTopicFromHook, isMobile, preventAutoOpenOnMobile, handleTabChange, getTopicKey]);

  const handleVideoPlay = useCallback(() => {
    setIsVideoPlaying(true);
    setVideoLoadError(null);
    
    // Start tracking time
    setTopicStartTime(Date.now());
  }, []);

  const handleVideoPause = useCallback(() => {
    setIsVideoPlaying(false);
    
    // Record time spent on topic
    if (topicStartTime) {
      const timeSpent = (Date.now() - topicStartTime) / 1000 / 60; // Convert to minutes
    }
  }, [topicStartTime]);

  const handleVideoEnded = useCallback(() => {
    setIsVideoPlaying(false);
    
    // Temporarily set manual selection to prevent auto-navigation effects from jumping topics
    setUserManualSelection(true);
    setTimeout(() => {
      setUserManualSelection(false);
    }, 2000);

    const progressSnapshot = getCurrentTopicProgress();

    // Mark video as watched when it ends
    if (!progressSnapshot.videoWatched) {
      updateTopicProgress('videoWatched', true);
    }

    // Removed ContinueToNotesPrompt - using tabs for navigation instead
    // Prompts should not appear on initial load, only after user actions

    // Mark video as completed for task tracking
    if (currentTopic) {
      // Call API to mark video as completed for the current task
      const markVideoCompleted = async () => {
        try {
          const token = localStorage.getItem('token');
          if (!token) {
            console.warn('No auth token found, skipping video completion tracking');
            return;
          }
          // Extract subject name from subject object
          const subjectName = subject?.name || subject?.fullTitle || subject?.title || 'Unknown Subject';
          // Extract topic name from currentTopic object
          const topicName = currentTopic?.title || 'Unknown Topic';
          // First, find the correct study plan task ID based on subject and topic
          const timestamp = Date.now();
          
          const findTaskUrl = `${getApiBaseUrl()}/api/study-plan/task/find-by-topic?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topicName)}&_t=${timestamp}`;
          const streakUrl = `${getApiBaseUrl()}/api/daily-goal/daily-streak/update?_t=${timestamp}`;
          
          const streakPayload = {
            subject: cleanSubjectName(subject?.title || subject),
            unit: currentUnit?.title || 'Unit',
            topic: currentTopic?.title || 'Topic',
            year: parseInt(subject?.year) || 1,
            semester: parseInt(subject?.semester) || 1,
            video_id: `${subject?.title || subject}_${currentTopic?.title}`,
            activity_date: new Date().toISOString().split('T')[0]
          };
          
          const result = await fetchWithFallback(
            findTaskUrl,
            {
              method: 'GET',
              headers: createApiHeaders(token)
            },
            streakUrl,
            {
              method: 'POST',
              headers: createApiHeaders(token),
              body: JSON.stringify(streakPayload)
            }
          );

          if (result.success && result.data && result.data.task_id) {
            // We found a study plan task, mark video as completed
            const markVideoUrl = `${getApiBaseUrl()}/api/study-plan/task/mark-video-completed?_t=${timestamp}`;
            const markVideoResult = await fetchWithFallback(
              markVideoUrl,
              {
                method: 'POST',
                headers: createApiHeaders(token),
                body: JSON.stringify({ task_id: result.data.task_id })
              }
            );
            
            if (markVideoResult.success) {
              // Dispatch custom event to notify other components
              window.dispatchEvent(new CustomEvent('task-updated', { 
                detail: { 
                  type: 'video-completed',
                  subject: subject,
                  topic: currentTopic?.title,
                  taskId: result.data.task_id
                } 
              }));
              
              // Dispatch streak-updated event to trigger navbar refresh
              window.dispatchEvent(new CustomEvent('streak-updated', { 
                detail: { 
                  type: 'video-completed',
                  subject: subject,
                  topic: currentTopic?.title,
                  taskId: result.data.task_id
                } 
              }));

              // Optimistic UI update
              try {
                const topicKey = getTopicKey(selectedUnit, selectedTopic);
                // Mark video watched in local step progress
                updateTopicProgress('videoWatched', true);
                
                // Do NOT delete completion status here, as it triggers auto-navigation
                // before the student can even read the notes or take the quiz.
                
                // Notify dashboard/streak hooks to refetch
                if (typeof window !== 'undefined') {
                  window.dispatchEvent(new CustomEvent('progress-updated', { detail: { type: 'video-completed', topicKey } }));
                  window.dispatchEvent(new CustomEvent('dashboard-refresh'));
                  window.dispatchEvent(new CustomEvent('study-plan-updated', { detail: { type: 'video-completed', topic: currentTopic?.title } }));
                }
              } catch (e) {
                console.warn('⚠️ Post-completion optimistic update failed (task path):', e);
              }
            } else {
              console.error('❌ Failed to track video completion:', markVideoResult.message || 'Unknown error');
            }
            return;
          }

          // If no study plan task was found, just log it
          // Optimistic UI update and forced refresh to avoid stale cached completion
          try {
            const topicKey = getTopicKey(selectedUnit, selectedTopic);
            // Mark video watched in local step progress
            updateTopicProgress('videoWatched', true);
            // Trigger a fresh completion check
            if (typeof forceRefreshCompletion === 'function') {
              await forceRefreshCompletion();
            }
            // Notify dashboard/streak hooks to refetch
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('progress-updated', { detail: { type: 'video-completed', topicKey } }));
              window.dispatchEvent(new CustomEvent('dashboard-refresh'));
              window.dispatchEvent(new CustomEvent('study-plan-updated', { detail: { type: 'video-completed', topic: currentTopic?.title } }));
            }
          } catch (e) {
            console.warn('⚠️ Post-completion optimistic update failed:', e);
          }
        } catch (error) {
          console.error('❌ Error tracking task video completion:', error);
        }
      };

      markVideoCompleted();
    }
    
    // Record completion time
    if (topicStartTime) {
      const timeSpent = (Date.now() - topicStartTime) / 1000 / 60; // Convert to minutes
    }

    // Auto-switch to notes tab when video ends to maintain proper learning order
    if (activeTab === 'video') {
      console.log('🎬 Video ended, automatically moving to Notes tab');
      handleTabChange('notes');
    }
  }, [topicStartTime, currentTopic, getCurrentTopicProgress, updateTopicProgress, activeTab, handleTabChange, getTopicKey, selectedUnit, selectedTopic, subject, currentUnit]);

  // Combined play/pause handler for mobile
  const handleVideoPlayPause = useCallback(() => {
    if (isVideoPlaying) {
      handleVideoPause();
    } else {
      handleVideoPlay();
    }
  }, [isVideoPlaying, handleVideoPlay, handleVideoPause]);

  // Global fallback to prevent errors
  if (typeof window !== 'undefined') {
    window.handleVideoPlayPause = handleVideoPlayPause;
  }

  const handleVideoTimeUpdate = useCallback((currentTime) => {
    setVideoCurrentTime(currentTime);
    if (videoDuration > 0) {
      const progress = (currentTime / videoDuration) * 100;
      setVideoProgress(progress);
      
      // Mark video as watched when it reaches 80% completion
      if (progress >= 80 && !getCurrentTopicProgress().videoWatched) {
        updateTopicProgress('videoWatched', true);
      }
    }
  }, [videoDuration, getCurrentTopicProgress, updateTopicProgress]);

  const handleVideoDurationChange = useCallback((duration) => {
    setVideoDuration(duration);
    setIsVideoLoading(false);
  }, []);

  const handleVideoError = useCallback((error) => {
    console.error('❌ Video error:', error);
    setIsVideoPlaying(false);
    setIsVideoLoading(false);
    setVideoLoadError(error.message || 'Video playback error');
  }, []);

  // Debounced video change handler to prevent rapid DOM manipulation
  const handleVideoChange = useCallback((newVideoId) => {
    // Clear any existing timeout
    if (videoChangeTimeoutRef.current) {
      clearTimeout(videoChangeTimeoutRef.current);
    }

    if (topic && typeof topic.thread_video_id !== 'undefined' && topic.thread_video_id !== null) {
      newVideoId = topic.thread_video_id;
    }

    const hasVideoSource = Boolean(newVideoId || fetchedVideoUrl || topic?.videoUrl);

    if (!hasVideoSource) {
      setIsVideoLoading(false);
      setVideoLoadError(null);
      return;
    }

    // Set loading state
    setIsVideoLoading(true);
    setVideoLoadError(null);

    // Debounce video changes to prevent rapid DOM manipulation
    videoChangeTimeoutRef.current = setTimeout(() => {
      lastVideoIdRef.current = newVideoId;
      setIsVideoLoading(false);
    }, 300); // 300ms debounce
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (videoChangeTimeoutRef.current) {
        clearTimeout(videoChangeTimeoutRef.current);
      }
    };
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (vimeoPlayerRef.current && vimeoPlayerRef.current.requestFullscreen) {
      vimeoPlayerRef.current.requestFullscreen();
    } else {
      // Fallback to container fullscreen
      const el = videoContainerRef.current;
      if (!el) return;
      const doc = document;
      const isFs = doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement;
      if (!isFs) {
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
        else if (el.msRequestFullscreen) el.msRequestFullscreen();
      } else {
        if (doc.exitFullscreen) doc.exitFullscreen();
        else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
        else if (doc.msExitFullscreen) doc.msExitFullscreen();
      }
    }
  }, []);

  const formatDuration = useCallback((duration) => {
    if (!duration) return '0:00';
    
    // If duration is in seconds (number), format it
    if (typeof duration === 'number') {
      const minutes = Math.floor(duration / 60);
      const seconds = Math.floor(duration % 60);
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // If duration is in format like "15:30", convert to minutes
    if (/^\d{1,2}:\d{2}$/.test(duration)) {
      const minutes = duration.split(':')[0];
      return `${minutes} min`;
    }
    
    return duration;
  }, []);

  const splitUnitTitle = useCallback((title) => {
    if (!title) return ['Unit', ''];
    const parts = String(title).split(':');
    if (parts.length >= 2) {
      return [parts[0].trim(), parts.slice(1).join(':').trim()];
    }
    return [title, ''];
  }, []);

  // generateQuizForTopic wrapper is now defined after useQuizHandlers hook (see above)

  // Quiz reset is now handled inside useQuizHandlers hook

  // Video player is ready when topic changes - no autoplay
  // Note: currentTopic and activeTab are declared before this, so they're safe to use
  useEffect(() => {
    if (currentTopic && activeTab === 'video') {
    }
  }, [currentTopic, activeTab]);

  // handleQuizSubmit is now provided by useQuizHandlers hook

  // Debug: Expose test function to manually trigger tour
  // MUST be declared before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.testTour = (step = 0) => {
        setLessonTourStep(step);
      };
    }
  }, []);
  

  // Calculate values that depend on hooks BEFORE any early returns
  // This ensures consistent hook order on every render
  const shouldShowSkeleton = externalLoading || isLoading || !showContent;
  
  // Get current tour step (use ref to avoid TDZ issues in JSX)
  // MUST be calculated before early returns to maintain hook order
  const currentTourStep = lessonTourStepRef.current;
  
  // Show skeleton loading when data is being loaded or subject is not yet available
  // NOTE: All hooks must be declared BEFORE this point to follow Rules of Hooks
  if (!subject) {
    if (shouldShowSkeleton) {
      return <CourseContentSkeleton isMobile={isMobile} isDarkMode={isDarkMode} />;
    }
    return null; // Return null if no subject provided and no loading state
  }

  // Notify global loader whether a skeleton is active
  try {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(shouldShowSkeleton ? 'page-skeleton-start' : 'page-skeleton-end'));
    }
  } catch {}

  // Show skeleton while loading course data (external loading or internal loading)
  if (shouldShowSkeleton) {
    return <CourseContentSkeleton isMobile={isMobile} isDarkMode={isDarkMode} />;
  }

  // Calculate hook-dependent values AFTER early returns (but hooks are already declared)
  // These are just regular variable assignments, not hook calls
  const units = Array.isArray(courseData?.units) ? courseData.units : [];
  const showEmptyState = !hasCourseTopics;
  
  return (
    <div className={`${isMobile ? mobileStyles['course-content-container'] : styles.container} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
      {(currentTourStep >= 0 && typeof window !== 'undefined' && typeof document !== 'undefined' && document.body) ? ReactDOM.createPortal(
        (() => {
          const getRect = (el) => {
            if (!el) return null;
            try { return el.getBoundingClientRect(); } catch { return null; }
          };
          let highlightRect = null;
          const step = lessonTourStepRef.current; // Use ref to avoid TDZ
          if (step === 1) highlightRect = getRect(leftPanelRef.current);
          if (step === 2) highlightRect = getRect(centerPanelRef.current);
          if (step === 3) highlightRect = getRect(aiTutorPanelRef.current);
          if (step === 5) {
            highlightRect = getRect(takeQuizButtonRef.current);
            if (!highlightRect) {
              console.warn('⚠️ Tour step 5: Take MCQs button rect not found. Button ref:', takeQuizButtonRef.current);
              // Try to find the button by querySelector as fallback
              if (typeof document !== 'undefined') {
                const button = document.querySelector('[aria-label="Take MCQs"]') || 
                  Array.from(document.querySelectorAll('button')).find(btn => 
                    btn.textContent?.includes('Take MCQs') || btn.textContent?.includes('Take Quiz')
                  );
                if (button) {
                  highlightRect = getRect(button);
                }
              }
            } else {
            }
          }
          // Steps 6 and 7 don't need highlight - they're centered overlay cards
          if (step === 6 || step === 7) {
            highlightRect = null; // No highlight for completion/smart coach cards
          }

          // Position the tooltip card near the highlighted area
          // Get viewport dimensions first
          const gutter = 16; // distance from highlighted area
          const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
          const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
          
          // Calculate actual card width based on step and screen size
          let cardWidth = 360;
          if (step === 6 || step === 7) {
            // For steps 6 & 7, use responsive width (90vw with max 420px)
            const maxWidth = 420;
            cardWidth = Math.min(vw * 0.9, maxWidth);
          }
          
          // Increase card height for steps 6 and 7 to accommodate longer text
          // Also adjust for mobile to account for larger fonts
          const baseCardHeight = (step === 6 || step === 7) ? 200 : 160;
          const cardHeight = isMobile && (step === 6 || step === 7) 
            ? baseCardHeight + 20  // Extra height for mobile due to larger fonts
            : baseCardHeight;
          let cardLeft = (vw - cardWidth) / 2;
          let cardTop = (vh - cardHeight) / 2;
          
          // Handle steps 6 and 7 first (centered overlay cards)
          if (step === 6 || step === 7) {
            // Quiz completion and Smart Coach cards → center on screen
            cardLeft = (vw - cardWidth) / 2;
            cardTop = (vh - cardHeight) / 2;
          } else if (highlightRect) {
            if (step === 1) {
              // left panel → prefer right side; if no space, fall back to below
              const preferRightLeft = highlightRect.right + gutter;
              if (preferRightLeft + cardWidth <= vw - gutter) {
                cardLeft = preferRightLeft;
                cardTop = Math.max(gutter, Math.min(highlightRect.top, vh - cardHeight - gutter));
              } else {
                cardLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
                cardTop = Math.min(vh - cardHeight - gutter, highlightRect.bottom + gutter);
              }
            } else if (step === 2) {
              // center panel → prefer above; if not enough space, place below
              const preferTop = highlightRect.top - cardHeight - gutter;
              if (preferTop >= gutter) {
                cardTop = preferTop;
                cardLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
              } else {
                cardTop = Math.min(vh - cardHeight - gutter, highlightRect.bottom + gutter);
                cardLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
              }
            } else if (step === 3) {
              // AI tutor (right panel) → prefer left side; if no space, place below
              const preferLeftLeft = highlightRect.left - cardWidth - gutter;
              if (preferLeftLeft >= gutter) {
                cardLeft = preferLeftLeft;
                cardTop = Math.max(gutter, Math.min(highlightRect.top, vh - cardHeight - gutter));
              } else {
                cardLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
                cardTop = Math.min(vh - cardHeight - gutter, highlightRect.bottom + gutter);
              }
            } else if (step === 5) {
              // Take MCQs button → prefer above with extra offset to move it higher
              const extraOffset = 60; // Move card higher up
              const preferTop = highlightRect.top - cardHeight - gutter - extraOffset;
              if (preferTop >= gutter) {
                cardTop = preferTop;
                cardLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
              } else {
                // If not enough space above, place it above but closer
                cardTop = Math.max(gutter, highlightRect.top - cardHeight - gutter - 20);
                cardLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
              }
            }

            // Final safety: ensure card does NOT overlap the highlighted zone
            const intersects = (l, t) => {
              const r = l + cardWidth;
              const b = t + cardHeight;
              const hx1 = highlightRect.left, hy1 = highlightRect.top, hx2 = highlightRect.right, hy2 = highlightRect.bottom;
              return !(r <= hx1 || l >= hx2 || b <= hy1 || t >= hy2);
            };

            if (intersects(cardLeft, cardTop)) {
              // Try right
              let tryLeft = Math.min(highlightRect.right + gutter, vw - cardWidth - gutter);
              let tryTop = Math.max(gutter, Math.min(highlightRect.top, vh - cardHeight - gutter));
              if (!intersects(tryLeft, tryTop)) { cardLeft = tryLeft; cardTop = tryTop; }
              else {
                // Try left
                tryLeft = Math.max(gutter, highlightRect.left - cardWidth - gutter);
                tryTop = Math.max(gutter, Math.min(highlightRect.top, vh - cardHeight - gutter));
                if (!intersects(tryLeft, tryTop)) { cardLeft = tryLeft; cardTop = tryTop; }
                else {
                  // Try below
                  tryLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
                  tryTop = Math.min(vh - cardHeight - gutter, highlightRect.bottom + gutter);
                  if (!intersects(tryLeft, tryTop)) { cardLeft = tryLeft; cardTop = tryTop; }
                  else {
                    // Try above
                    tryLeft = Math.max(gutter, Math.min(highlightRect.left + highlightRect.width/2 - cardWidth/2, vw - cardWidth - gutter));
                    tryTop = Math.max(gutter, highlightRect.top - cardHeight - gutter);
                    cardLeft = tryLeft; cardTop = tryTop; // last resort
                  }
                }
              }
            }
          }

          return (
            <div
              className={`${styles.videoTourOverlayBackdrop} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}
              role="dialog"
              aria-modal="true"
              style={(highlightRect && step !== 6 && step !== 7) ? { background: 'transparent', backdropFilter: 'none', WebkitBackdropFilter: 'none' } : undefined}
            >
              {(highlightRect && step !== 6 && step !== 7) ? (
                <>
                  {/* Create a non-blurred hole by covering all sides around the rect */}
                  {/* Top cover */}
                  <div style={{ position: 'fixed', inset: `0 0 ${window.innerHeight - highlightRect.top}px 0`, height: `${highlightRect.top}px`, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201 }} />
                  {/* Bottom cover */}
                  <div style={{ position: 'fixed', top: `${highlightRect.bottom}px`, left: 0, right: 0, bottom: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201 }} />
                  {/* Left cover */}
                  <div style={{ position: 'fixed', top: `${highlightRect.top}px`, bottom: `${window.innerHeight - highlightRect.bottom}px`, left: 0, width: `${highlightRect.left}px`, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201 }} />
                  {/* Right cover */}
                  <div style={{ position: 'fixed', top: `${highlightRect.top}px`, bottom: `${window.innerHeight - highlightRect.bottom}px`, left: `${highlightRect.right}px`, right: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)', zIndex: 1201 }} />

                  {/* subtle outline on the highlighted area */}
                  <div
                    aria-hidden="true"
                    style={{
                      position: 'fixed',
                      top: `${highlightRect.top - 4}px`,
                      left: `${highlightRect.left - 4}px`,
                      width: `${highlightRect.width + 8}px`,
                      height: `${highlightRect.height + 8}px`,
                      borderRadius: '12px',
                      boxShadow: '0 0 0 3px rgba(250,204,21,0.9), 0 18px 48px rgba(59,130,246,0.22)',
                      pointerEvents: 'none',
                      zIndex: 1202
                    }}
                  />
                  {/* Arrow pointing to button (only for step 5) */}
                  {step === 5 && highlightRect && (() => {
                    const cardCenterX = cardLeft + cardWidth / 2;
                    const cardBottomY = cardTop + cardHeight; // Start from bottom of card
                    const buttonCenterX = highlightRect.left + highlightRect.width / 2;
                    const buttonTopY = highlightRect.top; // Point to top of button, not center
                    
                    // Calculate direction
                    const dx = buttonCenterX - cardCenterX;
                    const dy = buttonTopY - cardBottomY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    // Stop arrow 15px before the button to avoid overlapping
                    const stopDistance = distance - 15;
                    const stopX = cardCenterX + (dx / distance) * stopDistance;
                    const stopY = cardBottomY + (dy / distance) * stopDistance;
                    
                    return (
                      <svg
                        style={{
                          position: 'fixed',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: '100%',
                          zIndex: 1202,
                          pointerEvents: 'none'
                        }}
                      >
                        <defs>
                          <marker
                            id="arrowhead-take-mcqs"
                            markerWidth="16"
                            markerHeight="16"
                            refX="14"
                            refY="8"
                            orient="auto"
                          >
                            <polygon
                              points="0 0, 16 8, 0 16"
                              fill="rgba(250,204,21,0.95)"
                            />
                          </marker>
                        </defs>
                        <line
                          x1={cardCenterX}
                          y1={cardBottomY}
                          x2={stopX}
                          y2={stopY}
                          stroke="rgba(250,204,21,0.95)"
                          strokeWidth="5"
                          markerEnd="url(#arrowhead-take-mcqs)"
                          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
                        />
                      </svg>
                    );
                  })()}
                </>
              ) : (
                // Fallback: full darken when no highlight
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(2px)' }} />
              )}
              <div 
                className={styles.videoTourCard} 
                style={{ 
                  width: (step === 6 || step === 7) 
                    ? (isMobile ? '95vw' : '90vw') 
                    : (isMobile ? '90vw' : '360px'),
                  maxWidth: (step === 6 || step === 7) ? '420px' : '420px',
                  position: 'fixed', 
                  left: `${cardLeft}px`, 
                  top: `${cardTop}px`, 
                  zIndex: 1203,
                  display: 'block !important',
                  visibility: 'visible !important',
                  opacity: '1 !important',
                  pointerEvents: 'auto',
                  margin: (step === 6 || step === 7) ? 'auto' : '0'
                }}
                data-tour-step={currentTourStep}
              >
                {currentTourStep === 0 && (
                  <>
                    <div className={styles.videoTourTitle}>Welcome to lessons</div>
                    <div className={styles.videoTourText}>We’ll guide you in 3 quick steps.</div>
                  </>
                )}
                {currentTourStep === 1 && (
                  <>
                    <div className={styles.videoTourTitle}>Units & topics</div>
                    <div className={styles.videoTourText}>On the left panel you’ll find all course units. Click a unit to see its topics, then select a topic to start the lesson.</div>
                  </>
                )}
                {currentTourStep === 2 && (
                  <>
                    <div className={styles.videoTourTitle}>Player & tabs</div>
                    <div className={styles.videoTourText}>This is your learning area — watch the video here, then switch to the Notes or MCQs tabs to explore more.</div>
                  </>
                )}
                {currentTourStep === 3 && (
                  <>
                    <div className={styles.videoTourTitle}>AI Tutor</div>
                    <div className={styles.videoTourText}>Meet your AI Tutor! You can ask questions anytime — it answers using this topic’s notes for accurate help.</div>
                  </>
                )}
                {currentTourStep === 4 && (
                  <>
                    <div className={styles.videoTourTitle}>Watch the complete video</div>
                    <div className={styles.videoTourText}>Then click Continue to Notes. This helps you build streaks.</div>
                  </>
                )}
                {currentTourStep === 5 && (
                  <>
                    <div className={styles.videoTourTitle}>Take MCQs to test your knowledge</div>
                    <div className={styles.videoTourText}>After reading the notes, click the "Take MCQs" button to test what you've learned. This completes the topic!</div>
                  </>
                )}
                {currentTourStep === 7 && (
                  <>
                    <div className={styles.videoTourTitle}>Analyze your performance</div>
                    <div className={styles.videoTourText}>Visit Smart Coach to see detailed analytics, identify your strengths and weaknesses, and get personalized recommendations!</div>
                  </>
                )}

                {currentTourStep >= 0 && currentTourStep < 4 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, justifyContent: 'flex-start' }}>
                    <button 
                      className={styles.videoTourCTA} 
                      onClick={() => {
                        const nextStep = currentTourStep + 1;
                        setLessonTourStep(nextStep);
                      }}
                    >
                      Next
                    </button>
                  </div>
                )}
                {currentTourStep === 4 && (
                  <button
                    className={styles.videoTourCTA}
                    onClick={() => {
                      setLessonTourStep(-1);
                      try { videoContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch {}
                      try {
                        if (vimeoPlayerRef.current && typeof vimeoPlayerRef.current.play === 'function') {
                          vimeoPlayerRef.current.play();
                        } else if (vimeoPlayerRef.current && typeof vimeoPlayerRef.current.togglePlayPause === 'function') {
                          vimeoPlayerRef.current.togglePlayPause();
                        }
                      } catch {}
                    }}
                  >
                    Start watching
                  </button>
                )}
                {currentTourStep === 5 && (
                  <button
                    className={styles.videoTourCTA}
                    onClick={() => {
                      setLessonTourStep(-1);
                      // Mark tour as dismissed
                      try {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('coursecontent-take-mcqs-tour-dismissed', 'true');
                          // Clear onboarding flag if this is the last step user sees
                          const onboardingJustCompleted = window.localStorage.getItem('onboarding-just-completed') === 'true';
                          if (onboardingJustCompleted) {
                            window.localStorage.removeItem('onboarding-just-completed');
                          }
                        }
                      } catch {}
                      // Navigate to quiz tab
                      handleTabChange('quiz');
                    }}
                  >
                    Got it!
                  </button>
                )}
                {currentTourStep === 7 && (
                  <button
                    className={styles.videoTourCTA}
                    onClick={() => {
                      setLessonTourStep(-1);
                      try {
                        if (typeof window !== 'undefined') {
                          window.localStorage.setItem('coursecontent-quiz-completion-tour-dismissed', 'true');
                          // Clear onboarding flag after tour is completed
                          window.localStorage.removeItem('onboarding-just-completed');
                          // Navigate to Smart Coach
                          router.push('/smart-coach');
                        }
                      } catch {}
                      // Also trigger navigation to next topic after a delay
                      setTimeout(() => {
                        handleQuizCompletionNavigation();
                      }, 300);
                    }}
                  >
                    Let's Go!
                  </button>
                )}
              </div>
            </div>
          );
        })(),
        document.body)
      : null}

      {/* Top Navigation */}
      {!(isMobile && (activeTab === 'notes' || activeTab === 'quiz')) && (
        <div className={`${isMobile ? mobileStyles['course-content-header'] : styles.topNavBar} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
        <div className={isMobile ? mobileStyles['topNavLeft'] : styles.topNavLeft}>
          <button
            className={isMobile ? mobileStyles['topNavBackButton'] : styles.topNavBackButton}
            onClick={handleBackToSubjects}
            aria-label="Back to courses"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
        </div>
        <div className={isMobile ? mobileStyles['topNavCenter'] : styles.topNavCenter}>
          <h1 className={isMobile ? mobileStyles['topNavCourseTitle'] : styles.topNavCourseTitle}>
            {!isMobile && (
              <span aria-hidden="true" style={{display:'inline-flex',alignItems:'center',justifyContent:'center',width:22,height:22,borderRadius:6,background:'rgba(120,195,255,0.18)',border:'1px solid rgba(120,195,255,0.28)',marginRight:8}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{color:'#2563eb'}}>
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
                  <path d="M20 22H6.5a2.5 2.5 0 0 1 0-5H20"/>
                  <path d="M14 17V2"/>
                  <path d="M14 2l6 3-6 3"/>
                </svg>
              </span>
            )}
            {courseData.title}
          </h1>
          {!isMobile && (
          <span className={styles.topNavSubtitle}>
            {currentUnit ? `${currentUnit.title} • Topic ${selectedTopic + 1}` : 'Select a unit to begin'}
          </span>
          )}
        </div>
        {!isMobile && (
        <div className={styles.topNavRight}>
          <button 
            className={styles.themeToggleButton}
            aria-label="Toggle dark mode"
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="5"/>
                <path d="M12 1v2"/>
                <path d="M12 21v2"/>
                <path d="M4.22 4.22l1.42 1.42"/>
                <path d="M18.36 18.36l1.42 1.42"/>
                <path d="M1 12h2"/>
                <path d="M21 12h2"/>
                <path d="M4.22 19.78l1.42-1.42"/>
                <path d="M18.36 5.64l1.42-1.42"/>
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
          <div className={styles.topNavIndicators}>
            <div className={styles.streakBadge}>
              <span className={styles.streakNumber}>{dailyStreak?.streak || 0}</span>
              <svg
                className={styles.streakIcon}
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
            </div>
              <Link href="/Profile" style={{ textDecoration: 'none' }}>
                <div 
                  className={styles.profileIcon}
                  style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }}
                >
                  <span className={styles.profileAvatar}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                      <circle cx="12" cy="7" r="4"/>
                    </svg>
                  </span>
                </div>
              </Link>
          </div>
        </div>
        )}
      </div>
      )}

      {/* Main Content */}
      <div 
        className={`${!isMobile ? styles.mainContent : ''} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}
        style={isMobile ? { 
          paddingBottom: '2rem', // Normal padding for mobile
          minHeight: '100vh'
        } : {}}
      >
        {/* Left Panel: Course Content List */}
        {isMobile ? (
          /* Mobile: No bottom sheet trigger - removed for cleaner mobile experience */
          null
        ) : (
          /* Desktop: Full Course Content List */
        <div ref={leftPanelRef} className={`${styles.leftPanel} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
          <div className={`${styles.courseContentHeader} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2>Course Content</h2>
            </div>
            
          </div>
          {/* Units Container (no scroll on desktop; topics handle scroll) */}
          <div
            className={styles.unitsContainer}
            style={!isMobile ? { overflowY: 'visible', maxHeight: 'none' } : undefined}
          >
            {/* Units and Topics */}
          {units.map((unit, unitIdx) => (
            <div key={unitIdx} role="treeitem" className={`${styles.unitSection} ${unit.isLocked ? styles.unitSectionLocked : ''}`}>
              {/* Unit Header */}
              <div
                className={`${styles.unitHeader} ${isMobile ? mobileExpandedUnit === unitIdx ? styles.unitHeaderActive : '' : desktopExpandedUnit === unitIdx ? styles.unitHeaderActive : ''}
                } ${isMobile ? mobileExpandedUnit === unitIdx ? styles.unitHeaderOpen : '' : desktopExpandedUnit === unitIdx ? styles.unitHeaderOpen : ''} ${unit.isLocked ? styles.unitHeaderLocked : ''}`}
                onClick={() => unit.isLocked ? handleLockedContentClick() : handleUnitSelect(unitIdx)}
                tabIndex={unit.isLocked ? -1 : 0}
                role="button"
                aria-label={`${unit.isLocked ? 'Locked: ' : ''}Select ${unit.title}`}
                title={unit.isLocked ? 'Upgrade to access this unit' : ''}
                onKeyDown={(e) => {
                  if (!unit.isLocked && (e.key === 'Enter' || e.key === ' ')) handleUnitSelect(unitIdx);
                }}
              >
                {(() => {
                  const [titleLeft, titleRight] = splitUnitTitle(unit.title);
                  return (
                    <div className={styles.unitTextGroup}>
                      <div className={styles.unitTitle}>{titleLeft}</div>
                      <div className={styles.unitSubtitle}>{titleRight || unit.subtitle || unit.description || ''}</div>
                    </div>
                  );
                })()}
                        <span className={styles.unitArrow} aria-hidden="true">›</span>
              </div>
              {/* Topics List (animated expand/collapse) */}
              {(() => {
                const isOpen = isMobile ? mobileExpandedUnit === unitIdx : desktopExpandedUnit === unitIdx;
                // Compute progress percentage: green line up to active topic for this unit
                const activeIdx = selectedUnit === unitIdx ? selectedTopic : -1;
                const totalTopics = unit.topics?.length || 0;
                const progressPct = activeIdx >= 0 && totalTopics > 0
                  ? Math.min(100, ((activeIdx + 1) / totalTopics) * 100)
                  : 0;
                return (
                  <div
                    className={`${styles.topicsList} ${isOpen ? styles.topicsOpen : styles.topicsClosed}`}
                    role="group"
                    aria-hidden={!isOpen}
                    style={{ '--progress-pct': `${progressPct}%` }}
                    onWheel={!isMobile ? handleTopicsWheel : undefined}
                  >
                     {unit.topics.map((topic, topicIdx) => {
                       const topicKey = `${unitIdx}-${topicIdx}`;
                       const isCompleted = isTopicCompleted(unitIdx, topicIdx);
                       const isSelected = selectedUnit === unitIdx && selectedTopic === topicIdx;
                       return (
                         <div
                           key={topicIdx}
                           className={`${styles.topicCard} ${
                             isNextUncompletedTopic(unitIdx, topicIdx) ? styles.topicCardNext : ''
                           } ${isCompleted ? styles.topicCardCompleted : ''} ${topic.isLocked ? styles.topicCardLocked : ''} ${isSelected ? styles.topicCardSelected : ''}`}
                          onClick={() => topic.isLocked ? handleLockedContentClick() : handleTopicSelect(unitIdx, topicIdx)}
                          tabIndex={isOpen && !topic.isLocked ? 0 : -1}
                          role="button"
                          aria-label={`${topic.isLocked ? 'Locked: ' : ''}Select ${topic.title}`}
                          title={topic.isLocked ? 'Upgrade to access this topic' : ''}
                          onKeyDown={(e) => {
                            if (!topic.isLocked && (e.key === 'Enter' || e.key === ' ')) handleTopicSelect(unitIdx, topicIdx);
                          }}
                        >
                           <span
                             className={
                               `${styles.topicMarker} ` +
                               (isCompleted
                                 ? styles.topicMarkerCompleted
                                 : isSelected
                                   ? styles.topicMarkerActive
                                   : styles.topicMarkerUpcoming)
                             }
                             aria-hidden="true"
                           />
                           <div className={styles.topicTitleRow}>
                             <span className={styles.topicTitle}>
                               {topic.title || 'No Title'}
                             </span>
                           </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          ))}
          </div> {/* Close unitsContainer */}
        </div>
        )}

        {/* Center Panel: Content */}
        <div ref={centerPanelRef} className={`${isMobile ? mobileStyles['center-panel'] : styles.centerPanel} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
          {showEmptyState ? (
            <div className={styles.centerEmptyState}>
              <div className={styles.emptyStateContent}>
                <div className={styles.emptyStateIcon} aria-hidden="true">
                  <svg
                    width="64"
                    height="64"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="4" width="18" height="14" rx="2" ry="2" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    <path d="M8 15h.01" />
                  </svg>
                </div>
                <h2 className={styles.emptyStateTitle}>Content coming soon</h2>
                <p className={styles.emptyStateSubtitle}>
                  We're preparing this course material. Please check back later for updates.
                </p>
              </div>
            </div>
          ) : (
            <>
          {/* Tabs - desktop only (hidden on mobile, replaced by action icons) */}
          {!isMobile && (
            <div className={`${styles.contentTabs} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`} role="tablist" aria-label="Content tabs">
              {['video', 'notes', 'quiz'].map((tab) => {
                const isAccessible = showContent ? isTabAccessible(tab) : false;
                const progress = showContent
                  ? getCurrentTopicProgress()
                  : { videoWatched: false, notesRead: false, quizCompleted: false };
                const isCompleted = tab === 'video' ? progress.videoWatched :
                                   tab === 'notes' ? progress.notesRead :
                                   progress.quizCompleted;
                const isTopicCompletedFlag = showContent && selectedUnit !== null && selectedTopic !== null && isTopicCompleted(selectedUnit, selectedTopic);
                const topicKey = selectedUnit !== null && selectedTopic !== null ? `${selectedUnit}-${selectedTopic}` : 'N/A';
                const cachedCompletionStatus = selectedUnit !== null && selectedTopic !== null ? topicCompletionStatus[topicKey] : undefined;
                const isVisuallyDisabled = !isAccessible || (isTopicCompletedFlag && tab === 'quiz');
                const allowClickWhenCompletedQuiz = isTopicCompletedFlag && tab === 'quiz';
                const isActuallyDisabled = !isAccessible && !allowClickWhenCompletedQuiz;
                return (
                  <button
                    key={tab}
                    type="button"
                    className={`${styles.tab} ${styles.tabPill} ${activeTab === tab ? styles.tabActive : ''} ${isVisuallyDisabled ? styles.tabDisabled : ''} ${(selectedUnit !== null && selectedTopic !== null && isTopicCompleted(selectedUnit, selectedTopic) && tab !== 'quiz') ? styles.tabDirectAccess : ''}`}
                    onClick={() => handleTabChange(tab)}
                    disabled={isActuallyDisabled}
                    tabIndex={0}
                    role="tab"
                    aria-selected={activeTab === tab}
                    aria-disabled={isVisuallyDisabled}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') handleTabChange(tab);
                    }}
                    title={
                      (isTopicCompletedFlag && tab === 'quiz')
                        ? 'MCQs already completed for this topic'
                        : (!isAccessible
                          ? `Click to check if topic is completed, or complete ${tab === 'notes' ? 'video' : 'video and notes'} first`
                          : `Access ${tab === 'quiz' ? 'MCQs' : tab}`)
                    }
                  >
                    <span className={styles.tabIcon} aria-hidden="true">
                      {tab === 'video' ? (
                        <svg className={styles.tabIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <polygon points="5,3 19,12 5,21" />
                        </svg>
                      ) : tab === 'notes' ? (
                        <svg className={styles.tabIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14,2 14,8 20,8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                          <polyline points="10,9 9,9 8,9" />
                        </svg>
                      ) : (
                        <svg className={styles.tabIconSvg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                      )}
                    </span>
                    {tab === 'quiz' ? 'MCQs' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                );
              })}
            </div>
          )}

          {/* Content Area */}
          <div ref={contentAreaRef} className={`${isMobile ? mobileStyles['content-area'] : styles.contentArea} ${isMobile && activeTab === 'notes' ? mobileStyles['notes-active'] : ''} ${isMobile && activeTab === 'video' ? mobileStyles['video-expanded'] : ''} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)} protected-content`} role="tabpanel" aria-label={`${activeTab} content`} style={{ WebkitUserSelect: 'none', userSelect: 'none', MozUserSelect: 'none', msUserSelect: 'none' }}>
            
            {/* Mobile Course Title - Do not show above video when on Video tab */}
            {isMobile && activeTab !== 'video' && (
             <div className={`${mobileStyles['course-title-section']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']} ${isMobile && (activeTab === 'notes' || activeTab === 'quiz') ? mobileStyles['hide-on-mobile'] : ''}`}>
              <h2 className={mobileStyles['course-title']}>
                {currentTopic?.title || 'Select a topic to begin learning'}
              </h2>
            </div>
            )}

            {isContentLoading && (
              <div className={styles.contentLoading}>
                <div className={styles.loadingSpinner} />
                <p>Loading content...</p>
              </div>
            )}
            {!isContentLoading && activeTab === 'video' && (
              isMobile ? (
                <div className={mobileStyles['video-player-wrapper']}>
                  {/* Mobile: render player directly without container */}
                  {isVideoLoading && (
                    <div className={styles.videoLoadingOverlay}>
                      <div className={styles.loadingSpinner} />
                      <p>Loading video...</p>
                    </div>
                  )}

                  {videoLoadError && (
                    <div className={styles.videoErrorOverlay}>
                      <div className={styles.errorContent}>
                        <div className={styles.errorIcon}>⚠️</div>
                        <h3>Video Error</h3>
                        <p>{videoLoadError}</p>
                        <button
                          className={styles.retryButton}
                          onClick={() => {
                            setVideoLoadError(null);
                            setIsVideoLoading(false);
                          }}
                        >
                          🔄 Try Again
                        </button>
                      </div>
                      <VideoUrlGuide />
                    </div>
                  )}

                  {isVideoLoading ? (
                    <div className={`${mobileStyles['no-video-container']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}>
                      <div className={mobileStyles['no-video-content']}>
                        <div className={mobileStyles['icon-circle']} style={{ animation: 'spin 2s linear infinite' }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                          </svg>
                        </div>
                        <h3>Loading Video...</h3>
                      </div>
                    </div>
                  ) : (fetchedVideoUrl || currentTopic?.videoUrl) && !videoLoadError && currentTopic?.isAccessible !== false ? (
                    <VideoPlayer
                      ref={vimeoPlayerRef}
                      videoUrl={fetchedVideoUrl || currentTopic.videoUrl}
                      onPlay={handleVideoPlay}
                      onPause={handleVideoPause}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onDurationChange={handleVideoDurationChange}
                      onError={handleVideoError}
                      onEnded={handleVideoEnded}
                      className={mobileStyles['video-player']}
                      autoplay={false}
                      muted={false}
                      loop={false}
                      controls={true}
                    />
                  ) : currentTopic?.isAccessible === false ? (
                    <div className={`${mobileStyles['no-video-container']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}>
                      <div className={mobileStyles['no-video-content']}>
                        <div className={mobileStyles['no-video-icon']}>🔒</div>
                        <h3>Content Locked</h3>
                        <p>Your free trial has expired.</p>
                        <p>Upgrade to premium to access all content.</p>
                      </div>
                    </div>
                  ) : !videoLoadError ? (
                    <div className={`${mobileStyles['no-video-container']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}>
                      <div className={mobileStyles['no-video-content']}>
                        <div className={mobileStyles['no-video-icon']}>📹</div>
                        <h3>No Video Available</h3>
                        <p>This topic doesn't have an associated video yet.</p>
                        <p>Please check back later or contact support if you believe this is an error.</p>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className={`${styles.videoContainer} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`} ref={videoContainerRef}>
                  {/* Desktop: Show actual video player */}
                  {isVideoLoading ? (
                    <div className={styles.noVideoContainer}>
                      <div className={styles.noVideoContent}>
                        <div className={styles.loadingSpinner}></div>
                        <h3>Loading Video...</h3>
                      </div>
                    </div>
                  ) : (fetchedVideoUrl || currentTopic?.videoUrl) && !videoLoadError && currentTopic?.isAccessible !== false ? (
                    <div className={styles.videoPlayer}>
                      <VideoPlayer
                        ref={vimeoPlayerRef}
                        videoUrl={fetchedVideoUrl || currentTopic.videoUrl}
                        onPlay={handleVideoPlay}
                        onPause={handleVideoPause}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onDurationChange={handleVideoDurationChange}
                        onError={handleVideoError}
                        onEnded={handleVideoEnded}
                        className={styles.videoPlayer}
                        autoplay={false}
                        muted={false}
                        loop={false}
                        controls={true}
                      />
                    </div>
                  ) : currentTopic?.isAccessible === false ? (
                    <div className={styles.noVideoContainer}>
                      <div className={styles.noVideoContent}>
                        <div className={styles.noVideoIcon}>🔒</div>
                        <h3>Content Locked</h3>
                        <p>Your free trial has expired.</p>
                        <p>Upgrade to premium to access all content.</p>
                      </div>
                    </div>
                  ) : !videoLoadError ? (
                    <div className={styles.noVideoContainer}>
                      <div className={styles.noVideoContent}>
                        <div className={styles.noVideoIcon}>📹</div>
                        <h3>No Video Available</h3>
                        <p>This topic doesn't have an associated video yet.</p>
                        <p>Please check back later or contact support if you believe this is an error.</p>
                      </div>
                    </div>
                  ) : null}

                  {/* Overlay moved to portal at root level */}
                </div>
              )
            )}
            {/* Mobile Course Title - Below video player on Video tab */}
            {isMobile && activeTab === 'video' && (
              <div className={`${mobileStyles['course-title-section']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}>
                <h2 className={mobileStyles['course-title']}>
                  {currentTopic?.title || 'Select a topic to begin learning'}
                </h2>
              </div>
            )}
            
            {/* Mobile Action Icons Row (Video, Notes, MCQs, Ask AI, Continue) */}
            {isMobile && activeTab === 'video' && (
              <div className={`${mobileStyles['action-icons-row']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}
                   role="group" aria-label="Quick actions">
                {/* Video */}
                <button
                  type="button"
                  className={mobileStyles['action-icon']}
                  onClick={() => {
                    if (activeTab !== 'video') {
                      handleTabChange('video');
                    }
                    if (!isMobile) {
                      enterFullscreen();
                    }
                  }}
                  aria-label="Video"
                >
                  <div className={mobileStyles['icon-circle']}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="5,3 19,12 5,21" />
                    </svg>
                  </div>
                  <span className={mobileStyles['icon-label']}>Video</span>
                </button>

                {/* Notes */}
                <button
                  type="button"
                  className={mobileStyles['action-icon']}
                  onClick={() => handleTabChange('notes')}
                  disabled={!isTabAccessible('notes')}
                  aria-label="Notes"
                >
                  <div className={mobileStyles['icon-circle']}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14,2 14,8 20,8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10,9 9,9 8,9" />
                    </svg>
                  </div>
                  <span className={mobileStyles['icon-label']}>Notes</span>
                </button>

                {/* MCQs */}
                <button
                  type="button"
                  className={mobileStyles['action-icon']}
                  onClick={() => handleTabChange('quiz')}
                  disabled={!isTabAccessible('quiz') && !(selectedUnit !== null && selectedTopic !== null && isTopicCompleted(selectedUnit, selectedTopic))}
                  aria-label="MCQs"
                  title={
                    (selectedUnit !== null && selectedTopic !== null && isTopicCompleted(selectedUnit, selectedTopic))
                      ? 'MCQs already completed for this topic'
                      : (!isTabAccessible('quiz') ? 'Complete video and notes first' : 'Take MCQs')
                  }
                >
                  <div className={mobileStyles['icon-circle']}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                  </div>
                  <span className={mobileStyles['icon-label']}>MCQs</span>
                </button>

                {/* Ask AI */}
                <button
                  type="button"
                  className={mobileStyles['action-icon']}
                  onClick={openAskAIModal}
                  aria-label="Ask AI Tutor"
                >
                  <div className={mobileStyles['icon-circle']}>
                    <img src="/assets/user-.png" alt="Ask AI" className={mobileStyles['icon-image']} />
                  </div>
                  <span className={mobileStyles['icon-label']}>Ask AI</span>
                </button>

                {/* Continue to Notes (Arrow) */}
                <button
                  type="button"
                  className={`${mobileStyles['action-icon']} ${mobileStyles['quiz-like']}`}
                  onClick={handleNextAction}
                  disabled={!currentTopic}
                  aria-label="Continue to Notes"
                  title="Continue to Notes"
                >
                  <div className={mobileStyles['icon-circle']}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </div>
                  <span className={mobileStyles['icon-label']}>Continue</span>
                </button>
              </div>
            )}

            {/* Mobile Course Content Section - Inline, below Continue to Notes (only on Video tab) */}
            {isMobile && activeTab === 'video' && hasUnits && (
              <div className={`${mobileStyles['mobile-course-content']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}
                   aria-label="Mobile Course Content Section">
                <div className={mobileStyles['mobile-course-content-header']}>
                  <span className={mobileStyles['mobile-course-icon']} aria-hidden="true">
                    <img src="/assets/book.png" alt="" />
                  </span>
                  <h3>Course Content</h3>
                </div>
                <div className={mobileStyles['mobile-units-inline']}>
                  {units.map((unit, unitIdx) => {
                    const [primaryTitleRaw, secondaryTitleRaw] = splitUnitTitle(unit.title || `Unit ${unitIdx + 1}`);
                    const primaryTitle = (primaryTitleRaw || '').trim() || `Unit ${unitIdx + 1}`;
                    const secondaryTitle = (secondaryTitleRaw || '').trim();

                    return (
                      <div key={unitIdx} className={mobileStyles['mobile-accordion']}>
                        <div
                          className={`${mobileStyles['mobile-accordion-header']} ${unit.isLocked ? mobileStyles['mobile-unit-inline-locked'] : ''} ${mobileExpandedUnit === unitIdx ? mobileStyles['mobile-accordion-open'] : ''}`}
                          onClick={() => unit.isLocked ? handleLockedContentClick() : (isMobile ? handleMobileUnitToggle(unitIdx) : handleUnitSelect(unitIdx))}
                          tabIndex={unit.isLocked ? -1 : 0}
                          role="button"
                          aria-label={`${unit.isLocked ? 'Locked: ' : ''}Select ${unit.title}`}
                          title={unit.isLocked ? 'Upgrade to access this unit' : ''}
                          aria-expanded={mobileExpandedUnit === unitIdx}
                          onKeyDown={(e) => {
                            if (!unit.isLocked && (e.key === 'Enter' || e.key === ' ')) handleUnitSelect(unitIdx);
                          }}
                        >
                          <div className={mobileStyles['mobile-accordion-text']}>
                            <span className={mobileStyles['mobile-accordion-title']}>{primaryTitle}</span>
                            {secondaryTitle && (
                              <span className={mobileStyles['mobile-accordion-subtitle']}>{secondaryTitle}</span>
                            )}
                          </div>
                          <svg className={mobileStyles['mobile-accordion-chevron']} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <path d="M6 9l6 6 6-6" />
                          </svg>
                        </div>
                      <div
                        className={`${mobileStyles['mobile-topics-inline']} ${mobileExpandedUnit === unitIdx ? mobileStyles['mobile-topics-inline-open'] : mobileStyles['mobile-topics-inline-closed']}`}
                        aria-hidden={mobileExpandedUnit !== unitIdx}
                      >
                        {(() => {
                          const seqEnd = getSequentialCompletionEnd(unitIdx);
                          return unit.topics.map((topic, topicIdx) => {
                          const topicKey = getTopicKey(unitIdx, topicIdx);
                          const isAccessible = topic.isAccessible !== false;
                          const progressive = topicIdx <= seqEnd;
                          return (
                            <div
                              key={topicIdx}
                              className={`${mobileStyles['mobile-topic-inline']} ${!isAccessible ? mobileStyles['mobile-topic-inline-locked'] : ''} ${isTopicCompleted(unitIdx, topicIdx) ? mobileStyles['mobile-topic-inline-completed'] : ''} ${progressive ? mobileStyles['mobile-topic-inline-progressive'] : ''} ${(selectedUnit === unitIdx && selectedTopic === topicIdx) ? mobileStyles['mobile-topic-inline-current'] : ''}`}
                              style={{ '--idx': topicIdx }}
                              onClick={() => {
                                if (!isAccessible) {
                                  handleLockedContentClick();
                                  return;
                                }
                                handleTopicSelect(unitIdx, topicIdx);
                              }}
                              tabIndex={isAccessible ? 0 : -1}
                              role="button"
                              aria-label={`${!isAccessible ? 'Locked: ' : ''}${topic.title}`}
                              title={!isAccessible ? 'Upgrade to access this topic' : ''}
                              onKeyDown={(e) => {
                                if (isAccessible && (e.key === 'Enter' || e.key === ' ')) {
                                  handleTopicSelect(unitIdx, topicIdx);
                                }
                              }}
                            >
                              <div className={mobileStyles['mobile-topic-inline-info']}>
                                <span className={`${mobileStyles['mobile-topic-check']} ${isTopicCompleted(unitIdx, topicIdx) ? mobileStyles['mobile-topic-check-completed'] : ''}`}></span>
                                <div className={mobileStyles['mobile-topic-inline-title']}>{topic.title}</div>
                                {topic.duration && (
                                  <div className={mobileStyles['mobile-topic-inline-duration']}>
                                    {formatTime(topic.duration)}
                                  </div>
                                )}
                              </div>
                              {/* No right-side icons for topics as requested */}
                            </div>
                          );
                          });
                        })()}
                      </div>
                    </div>
                  );
                  })}
                </div>
              </div>
            )}


            
            {activeTab === 'notes' && (
              <>
                {currentTopic?.isAccessible === false ? (
                  <div className={`${isMobile ? '' : styles.videoContainer} ${isDarkMode ? (isMobile ? '' : styles.darkTheme) : (isMobile ? '' : styles.lightTheme)}`}>
                    <div className={styles.noVideoContainer}>
                      <div className={styles.noVideoContent}>
                        <div className={styles.noVideoIcon}>🔒</div>
                        <h3>Content Locked</h3>
                        <p>Your free trial has expired.</p>
                        <p>Upgrade to premium to access all content.</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {isMobile && (
                      <div style={{ 
                        position: 'fixed',
                        top: '10px',
                        left: '1rem',
                        zIndex: 1001
                      }}>
                        <button 
                          onClick={() => setActiveTab('video')}
                          style={{ 
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            background: 'none',
                            border: 'none',
                            color: '#6b7280',
                            fontSize: '1rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            padding: '0.5rem',
                            borderRadius: '6px',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.background = '#f3f4f6';
                            e.target.style.color = '#1a1a2e';
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.background = 'none';
                            e.target.style.color = '#6b7280';
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M19 12H5M12 19l-7-7 7-7"/>
                          </svg>
                          Back to Video
                        </button>
                      </div>
                    )}
                    <Notes 
                      currentTopic={currentTopic} 
                      subject={subject} 
                      currentUnit={currentUnit}
                      onBackToVideo={() => setActiveTab('video')}
                      onTakeQuiz={() => {
                        setActiveTab('quiz');
                      }}
                      notesCompleted={getCurrentTopicProgress().notesRead || false}
                      onReadyForQuiz={handleNotesReadyForQuiz}
                      registerTakeQuizButton={handleRegisterTakeQuizButton}
                    onNotesRead={() => {
                      updateTopicProgress('notesRead', true);

                      
                      // Don't auto-advance to quiz - let user click Take Quiz button
                      // Mark notes as completed for task tracking
                      if (currentTopic) {
                        const markNotesCompleted = async () => {
                          try {
                            const token = localStorage.getItem('token');
                            if (!token) {
                              console.warn('No auth token found, skipping notes completion tracking');
                              return;
                            }

                            // Extract subject name from subject object
                            const subjectName = subject?.name || subject?.fullTitle || subject?.title || 'Unknown Subject';

                            // Extract topic name from currentTopic object
                            const topicName = currentTopic?.title || 'Unknown Topic';

                            // First, find the correct study plan task ID based on subject and topic
                            const findTaskResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app'}/api/study-plan/task/find-by-topic?subject=${encodeURIComponent(subjectName)}&topic=${encodeURIComponent(topicName)}`, {
                              method: 'GET',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                              }
                            });

                            if (!findTaskResponse.ok) {
                              console.warn('Could not find study plan task, skipping notes completion tracking');
                              return;
                            }

                            const taskInfo = await findTaskResponse.json();
                            if (!taskInfo.task_id) {
                              console.warn('No study plan task found for this topic, skipping notes completion tracking');
                              return;
                            }
                            // Now mark the notes as completed using the correct task ID
                            const taskData = {
                              task_id: taskInfo.task_id
                            };
                            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app'}/api/study-plan/task/mark-notes-completed`, {
                              method: 'POST',
                              headers: {
                                'Authorization': `Bearer ${token}`,
                                'Content-Type': 'application/json',
                              },
                              body: JSON.stringify(taskData)
                            });

                            if (response.ok) {
                              const data = await response.json();
                              // Dispatch custom event to notify other components about study plan update
                              window.dispatchEvent(new CustomEvent('study-plan-updated', { 
                                detail: { 
                                  type: 'notes-completed',
                                  taskId: taskInfo.task_id,
                                  subject: subject,
                                  topic: currentTopic?.title
                                } 
                              }));
                            } else {
                              console.error('❌ Failed to track task notes completion:', response.statusText);
                            }
                          } catch (error) {
                            console.error('❌ Error tracking task notes completion:', error);
                          }
                        };

                        markNotesCompleted();
                      }
                    }}
                  />
                  </>
                )}
              </>
            )}
            {activeTab === 'quiz' && (
              <div className={`${isMobile ? mobileStyles['quiz-container'] : styles.videoContainer} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
                {currentTopic?.isAccessible === false ? (
                  <div className={styles.noVideoContainer}>
                    <div className={styles.noVideoContent}>
                      <div className={styles.noVideoIcon}>🔒</div>
                      <h3>Content Locked</h3>
                      <p>Your free trial has expired.</p>
                      <p>Upgrade to premium to access all content.</p>
                    </div>
                  </div>
                ) : (
                  <>
                {isMobile && (
                  <div style={{ padding: '1rem 1rem 0.5rem 1rem' }}>
                    <button 
                      onClick={() => setActiveTab('notes')}
                      style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        background: 'none',
                        border: 'none',
                        color: '#6b7280',
                        fontSize: '1rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        padding: '0.5rem',
                        borderRadius: '6px',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.target.style.background = '#f3f4f6';
                        e.target.style.color = '#1a1a2e';
                      }}
                      onMouseLeave={(e) => {
                        e.target.style.background = 'none';
                        e.target.style.color = '#6b7280';
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M19 12H5M12 19l-7-7 7-7"/>
                      </svg>
                      Back to Notes
                    </button>
                  </div>
                )}
                {isQuizLoading ? (
                  <div className={styles.quizLoading}>
                    <div className={styles.loadingSpinner} />
                    <p>Loading Quiz</p>
                  </div>
                ) : quizError ? (
                  <div className={styles.quizError}>
                    <h3>⚠️ Quiz Generation Error</h3>
                    <p>{quizError}</p>
                    <button 
                      onClick={generateQuizForTopic}
                      className={styles.retryButton}
                    >
                      Retry
                    </button>
                  </div>
                ) : (quizCompleted && quizMetadata?.existingQuiz) ? (
                  <div style={{ padding: isMobile ? '0 1rem' : '0' }}>
                    <QuizCompleted
                      score={quizScore ?? 0}
                      totalQuestions={quizMetadata?.totalQuestions ?? (quizQuestions?.length || 0)}
                      completedAt={quizMetadata?.completedAt}
                      onBack={() => setActiveTab('notes')}
                      onNextTopic={handleNextAction}
                      hasNextTopic={Boolean(
                        getNextTopicForwardFromHook?.() || getNextUncompletedTopicFromHook?.()
                      )}
                    />
                  </div>
                ) : quizCompleted ? (
                  isMobile ? (
                  <div 
                    className={`${styles.quizResults} ${isDarkMode ? styles.darkTheme : ''} ${isMobile ? mobileStyles['quiz-results-mobile'] : ''}`}
                    style={{
                      opacity: showQuizResults ? 1 : 0,
                      transform: showQuizResults ? 'translateY(0)' : 'translateY(20px)',
                      transition: 'opacity 0.6s ease-out, transform 0.6s ease-out'
                    }}
                  >
                    {/* Celebration Particles - Micro animation for all quiz completions */}
                    {showQuizResults && (
                      <>
                        {/* Micro Celebration Animation - Confetti */}
                        {[...Array(isMobile ? 6 : 12)].map((_, i) => (
                          <div
                            key={`confetti-${i}`}
                            style={{
                              position: 'absolute',
                              top: '-10px',
                              left: `${10 + i * (isMobile ? 14 : 7)}%`,
                              width: isMobile ? '6px' : '8px',
                              height: isMobile ? '6px' : '8px',
                              backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'][i % 5],
                              borderRadius: '2px',
                              animation: `confettiFall ${1.5 + Math.random()}s ease-out ${i * 0.1}s forwards`,
                              zIndex: 10
                            }}
                          />
                        ))}
                        
                        {/* Micro Celebration Animation - Sparkles */}
                        {[...Array(isMobile ? 4 : 8)].map((_, i) => (
                          <div
                            key={`sparkle-${i}`}
                            style={{
                              position: 'absolute',
                              top: `${20 + i * (isMobile ? 15 : 10)}%`,
                              left: `${15 + i * (isMobile ? 15 : 10)}%`,
                              width: isMobile ? '3px' : '4px',
                              height: isMobile ? '3px' : '4px',
                              backgroundColor: '#fbbf24',
                              borderRadius: '50%',
                              boxShadow: '0 0 4px #fbbf24',
                              animation: `particleBurst ${1 + Math.random() * 0.5}s ease-out ${i * 0.15}s forwards`,
                              zIndex: 8
                            }}
                          />
                        ))}
                        
                        {/* Micro Celebration Animation - Fireworks (only for high scores) */}
                        {quizScore >= (quizQuestions.length || 5) * 0.7 && [...Array(isMobile ? 2 : 4)].map((_, i) => (
                          <div
                            key={`firework-${i}`}
                            style={{
                              position: 'absolute',
                              top: `${30 + i * (isMobile ? 20 : 15)}%`,
                              right: `${10 + i * (isMobile ? 30 : 20)}%`,
                              width: isMobile ? '8px' : '12px',
                              height: isMobile ? '8px' : '12px',
                              border: '2px solid #10b981',
                              borderRadius: '50%',
                              animation: `fireworks ${1.5 + i * 0.2}s ease-out ${0.3 + i * 0.15}s forwards`,
                              zIndex: 9
                            }}
                          />
                        ))}
                      </>
                    )}
                    
                    <h3>🎉 Quiz Completed!</h3>
                    <p>You scored {quizScore} out of {quizQuestions.length || 5}</p>
                    <p className={`${quizScore >= (quizQuestions.length || 5) * 0.7 ? 
                        (isMobile ? mobileStyles['mobile-success-text'] : styles.successText) : 
                        (isMobile ? mobileStyles['mobile-warning-text'] : styles.warningText)
                      }`}>
                      {quizScore >= (quizQuestions.length || 5) * 0.7 ? 'Excellent Achievement! 🏆' : 'Keep practicing! 💪'}
                    </p>
                    
                    {/* Achievement Badge for High Scores */}
                    {showQuizResults && !isMobile && quizScore >= (quizQuestions.length || 5) * 0.9 && (
                      <div
                        style={{
                          position: 'absolute',
                          top: '10px',
                          right: '10px',
                          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                          color: 'white',
                          padding: '0.5rem',
                          borderRadius: '50%',
                          fontSize: '1.5rem',
                          animation: 'starTwinkle 2s ease-in-out infinite',
                          zIndex: 15,
                          boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)'
                        }}
                      >
                        🏆
                      </div>
                    )}
                    
                    <button 
                      onClick={handleNextAction}
                      className={isMobile ? mobileStyles['continue-button'] : styles.nextButton}
                      style={{
                        opacity: showQuizResults ? 1 : 0,
                        transform: showQuizResults ? 'translateY(0)' : 'translateY(10px)',
                        transition: 'opacity 0.8s ease-out 0.3s, transform 0.8s ease-out 0.3s',
                        background: quizScore >= (quizQuestions.length || 5) * 0.7 ? 
                          'linear-gradient(135deg, #10b981, #059669)' : 
                          'linear-gradient(135deg, #3b82f6, #2563eb)',
                        boxShadow: quizScore >= (quizQuestions.length || 5) * 0.7 ? 
                          '0 4px 12px rgba(16, 185, 129, 0.3)' : 
                          '0 4px 12px rgba(59, 130, 246, 0.3)'
                      }}
                    >
                      {quizScore >= (quizQuestions.length || 5) * 0.7 ? 'Continue to Next Topic 🚀' : 'Continue to Next Topic →'}
                    </button>
                  </div>
                  ) : (
                    // Desktop/laptop: show only the Continue button to avoid quizResults card flicker
                    <div className={styles.nextRow}>
                      <button
                        onClick={handleNextAction}
                        className={styles.nextButton}
                        aria-label="Continue to Next Topic"
                      >
                        Continue to Next Topic →
                      </button>
                    </div>
                  )
                ) : (
                  <QuizComponent 
                    questions={quizQuestions}
                    onSubmit={handleQuizSubmit}
                  />
                )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Continue button for Notes tab */}
          {activeTab === 'notes' && (() => {
            const progress = getCurrentTopicProgress();
            const notesRead = progress.notesRead || false;
            const isTourHighlightingButton = currentTourStep === 5;
            
            return (
            <div className={styles.nextRow}>
              <button
                ref={handleRegisterTakeQuizButton}
                className={isMobile ? mobileStyles['continue-button'] : styles.nextButton}
                  onClick={() => {
                    if (notesRead) {
                      // Dismiss tour if active
                      if (isTourHighlightingButton) {
                        setLessonTourStep(-1);
                        try {
                          if (typeof window !== 'undefined') {
                            window.localStorage.setItem('coursecontent-take-mcqs-tour-dismissed', 'true');
                            // Clear onboarding flag if user dismisses tour early
                            const onboardingJustCompleted = window.localStorage.getItem('onboarding-just-completed') === 'true';
                            if (onboardingJustCompleted) {
                              window.localStorage.removeItem('onboarding-just-completed');
                            }
                          }
                        } catch {}
                      }
                      handleNextAction();
                    }
                  }}
                  disabled={!currentTopic || !notesRead}
                  aria-label={notesRead ? "Take MCQs" : "Complete Notes First"}
                  style={{
                    backgroundColor: notesRead ? undefined : '#9ca3af',
                    cursor: notesRead ? 'pointer' : 'not-allowed',
                    opacity: notesRead ? 1 : 0.7,
                    animation: notesRead ? (isTourHighlightingButton ? 'pulse 1s infinite, glow 2s infinite' : 'pulse 2s infinite') : 'none',
                    boxShadow: isTourHighlightingButton ? '0 0 20px rgba(250,204,21,0.6), 0 0 40px rgba(250,204,21,0.4)' : undefined,
                    transform: isTourHighlightingButton ? 'scale(1.05)' : undefined,
                    transition: 'all 0.3s ease'
                  }}
                >
                  {notesRead ? 'Take MCQs →' : 'Complete Notes First'}
              </button>
            </div>
            );
          })()}

          {/* Continue button for Video tab */}
          {activeTab === 'video' && !isMobile && (() => {
            const progress = getCurrentTopicProgress();
            const videoWatched = progress.videoWatched || false;
            
            return (
              <div className={styles.nextRow}>
                <button
                  className={styles.nextButton}
                  onClick={() => {
                    if (videoWatched) {
                      handleNextAction();
                    }
                  }}
                  disabled={!currentTopic || !videoWatched}
                  aria-label={videoWatched ? "Continue to Notes" : "Watch Video First"}
                  style={{
                    backgroundColor: videoWatched ? undefined : '#9ca3af',
                    cursor: videoWatched ? 'pointer' : 'not-allowed',
                    opacity: videoWatched ? 1 : 0.7,
                    animation: videoWatched ? 'pulse 2s infinite' : 'none'
                  }}
                >
                  {videoWatched ? 'Continue to Notes →' : 'Watch Video First'}
                </button>
              </div>
            );
          })()}
          </>
          )}
        </div>
        {/* Mobile Take MCQs button removed - using main content area button instead */}

        {/* Right Panel: AI Tutor */}
        {!isMobile && (
          /* Desktop: Full AI Tutor Panel */
          <div ref={aiTutorPanelRef} className={`${styles.rightPanel} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
            <AITutor 
              selectedTopic={currentTopic}
              documentContent={documentContent}
              currentDocumentId={currentDocumentId}
              learningSubject={subject?.fullTitle}
              subjectCode={subject?.code}
              activeYear={subject?.year}
              activeSemester={subject?.semester}
              subscriptionStatus={subscriptionData}
              subscriptionData={subscriptionData}
            />
          </div>
        )}
      </div>



      {/* Mobile ASK AI Modal */}
      {isMobile && (
        <>
          {/* ASK AI Modal Backdrop */}
          {isAskAIModalOpen && (
            <div
              className={mobileStyles['ask-ai-modal-backdrop']}
              onClick={closeAskAIModal}
              style={{
                position: 'fixed', inset: 0, width: '100vw', height: '100dvh',
                margin: 0, padding: 0, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch',
                zIndex: 2147483647
              }}
            >
              <div
                className={`${mobileStyles['ask-ai-modal']} ${isAskAIModalOpen ? mobileStyles['ask-ai-modal-open'] : ''} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  position: 'fixed', inset: 0, height: '100dvh', maxHeight: '100dvh', width: '100%',
                  borderRadius: 0, boxShadow: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column'
                }}
              >
                {/* Modal Header - hidden to remove top gap */}
                <div className={mobileStyles['ask-ai-modal-header']} style={{ display: 'none' }}>
                </div>
                {/* ASK AI Modal Content - Right Panel Content */}
                <div
                  className={mobileStyles['ask-ai-modal-content']}
                  style={{ flex: '1 1 auto', minHeight: 0, height: '100%', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
                >
                  {/* Close Button positioned at top-right, opposite to AI Tutor header */}
                  <div className={mobileStyles['close-button-top-right']}>
                    <button className={mobileStyles['ask-ai-modal-close']} onClick={closeAskAIModal}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>
                  
                  {/* AI Tutor Component */}
                  <AITutor 
                    selectedTopic={currentTopic}
                    documentContent={documentContent}
                    currentDocumentId={currentDocumentId}
                    learningSubject={subject?.fullTitle}
                    subjectCode={subject?.code}
                    activeYear={subject?.year}
                    activeSemester={subject?.semester}
                    subscriptionStatus={subscriptionData}
                    subscriptionData={subscriptionData}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
      {/* Quiz Completed Modal */}
      {showCompletedQuizModal && (
        <div className={quizModalStyles.quizModalOverlay} role="dialog" aria-modal="true" aria-label="Quiz Completed">
          <div className={quizModalStyles.quizModalContent} onClick={(e) => e.stopPropagation()}>
            <button className={quizModalStyles.quizModalClose} onClick={() => setShowCompletedQuizModal(false)} aria-label="Close">
          
            </button>
            <h3 style={{ marginTop: 0 }}>Quiz Completed</h3>
            <p>You have already completed the quiz for this topic.</p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setShowCompletedQuizModal(false)} className={styles.nextQuestionButton}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CourseContent;

