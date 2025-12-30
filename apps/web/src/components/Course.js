'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo, useTransition, memo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';
import styles from './Course.module.css';
import mobileStyles from './CourseMobile.module.css';
const CourseContent = dynamic(() => import('./CourseContent'), { ssr: false });
import { currentCourseAPI } from '@/lib/api';
import { FaLock } from 'react-icons/fa';


const SEMESTERS = [1, 2];
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

// Debounce utility
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

// Optimized mobile detection hook
const useMobileDetection = () => {
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
    };
    
    checkMobile();
    const resizeHandler = debounce(checkMobile, 100);
    window.addEventListener('resize', resizeHandler);
    
    return () => {
      window.removeEventListener('resize', resizeHandler);
    };
  }, []);
  
  return isMobile;
};

// Skeleton Loading Components
const SemesterCardSkeleton = ({ currentStyles }) => (
  <div className={currentStyles['semester-card-skeleton']}>
    <div className={currentStyles['semester-header-skeleton']}>
      <div className={currentStyles['semester-title-skeleton']}></div>
      <div className={currentStyles['semester-progress-skeleton']}></div>
    </div>
    <div className={currentStyles['semester-content-skeleton']}>
      <div className={currentStyles['semester-xp-skeleton']}></div>
      <div className={currentStyles['semester-percentage-skeleton']}></div>
      <div className={currentStyles['semester-progress-bar-skeleton']}></div>
    </div>
    <div className={currentStyles['semester-subjects-skeleton']}>
      {[1, 2, 3].map(i => (
        <div key={i} className={currentStyles['subject-item-skeleton']}>
          <div className={currentStyles['subject-icon-skeleton']}></div>
          <div className={currentStyles['subject-details-skeleton']}>
            <div className={currentStyles['subject-name-skeleton']}></div>
            <div className={currentStyles['subject-info-skeleton']}></div>
            <div className={currentStyles['subject-progress-bar-skeleton']}></div>
          </div>
          <div className={currentStyles['subject-chevron-skeleton']}></div>
        </div>
      ))}
    </div>
  </div>
);

const LoadingSkeleton = ({ currentStyles }) => (
  <div className={currentStyles['course-container']}>
    <div className={currentStyles['course-header']}>
      <div className={currentStyles['header-top']}>
        <h1>My Subjects</h1>
        <div className={currentStyles['trial-pill-skeleton']}></div>
      </div>
    </div>
    
    <div className={currentStyles['year-switcher-skeleton']}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className={currentStyles['year-tab-skeleton']}></div>
      ))}
    </div>
    
    <div className={currentStyles['semesters-grid']}>
      <SemesterCardSkeleton currentStyles={currentStyles} />
      <SemesterCardSkeleton currentStyles={currentStyles} />
    </div>
  </div>
);


export default function Course() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { isDarkMode } = useTheme();
  const { subscriptionStatus, refreshSubscription } = useSubscription();
  
  // Use optimized mobile detection
  const isMobile = useMobileDetection();
  const currentStyles = isMobile ? mobileStyles : styles;  // No memo for simpler code
  
  // Core state variables
  const [activeTab, setActiveTab] = useState('all');
  const [activeYear, setActiveYear] = useState(null);
  const [activeSemester, setActiveSemester] = useState(null); // Will be set based on user's current semester
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [userYearSem, setUserYearSem] = useState({ year: 1, semester: 1 });
  
  // Loading states
  const [isInitialRenderReady, setIsInitialRenderReady] = useState(false);
  const [xpLoading, setXpLoading] = useState(true);
  const [curriculumLoading, setCurriculumLoading] = useState(true);
  const [isPreloading, setIsPreloading] = useState(false);
  const [isSubjectLoading, setIsSubjectLoading] = useState(false); // Track subject loading
  const [loadingSubject, setLoadingSubject] = useState(null); // Track which subject's Start button is loading
  
  // CACHE-LESS: Removed preloaded content caching
  const [subjectsWithProgress, setSubjectsWithProgress] = useState([]);
  const [semesterXPData, setSemesterXPData] = useState({});
  
  // UI control states
  const [hasInitializedFromUserData, setHasInitializedFromUserData] = useState(false);
  const [userHasManuallySelectedTab, setUserHasManuallySelectedTab] = useState(false);
  const [showAllYears, setShowAllYears] = useState(true);
  const [userClosedSemester, setUserClosedSemester] = useState(false);
  const [hasClickedStartLearning, setHasClickedStartLearning] = useState(false);
  
  // Use a ref to track user's semester preference to avoid circular dependencies
  const userClosedSemesterRef = useRef(false);
  
  // Performance optimization states
  const [isRendering, setIsRendering] = useState(false);
  const [preFilteredSubjects, setPreFilteredSubjects] = useState(null);
  const [isSemesterTransitioning, setIsSemesterTransitioning] = useState(false);
  const [allPreRenderedSubjects, setAllPreRenderedSubjects] = useState({});
  const [isPending, startTransition] = useTransition();
  
  // Refs
  const subjectsRef = useRef(null);
  const overlayRef = useRef(null);
  const overlayEnteredRef = useRef(false);
  const suppressAutoOpenRef = useRef(false);
  
  // Handle URL parameters for subject selection
  useEffect(() => {
    const subjectParam = searchParams.get('subject');
    if (selectedSubject || suppressAutoOpenRef.current || !allPreRenderedSubjects || Object.keys(allPreRenderedSubjects).length === 0) return;
    if (subjectParam) {
      // Find the subject across all years and semesters
      let foundSubject = null;
      let foundYear = 1;
      let foundSemester = 1;
      
      for (let year = 1; year <= 4; year++) {
        for (let semester = 1; semester <= 2; semester++) {
          const semesterSubjects = allPreRenderedSubjects[`${year}-${semester}`] || [];
          const subject = semesterSubjects.find(sub => {
            return sub.code === subjectParam;
          });
          
          if (subject) {
            foundSubject = subject;
            foundYear = year;
            foundSemester = semester;
            break;
          }
        }
        if (foundSubject) break;
      }
      
      if (foundSubject) {
        setActiveYear(foundYear);
        setActiveSemester(foundSemester);
        setActiveTab('all'); // Show all subjects for the selected year/semester
      }
    }
  }, [searchParams, selectedSubject, allPreRenderedSubjects]);

  // When a subject query is present, open it once selectedSubject is not yet set
  useEffect(() => {
    const openSubjectFromURL = async () => {
      const subjectParam = searchParams.get('subject');
      if (!subjectParam || selectedSubject || suppressAutoOpenRef.current || !allPreRenderedSubjects || Object.keys(allPreRenderedSubjects).length === 0) return;

      // Find by code across all subjects from fetched curriculum data
      let foundSubject = null;
      for (let year = 1; year <= 4 && !foundSubject; year++) {
        for (let semester = 1; semester <= 2 && !foundSubject; semester++) {
          const semesterSubjects = allPreRenderedSubjects[`${year}-${semester}`] || [];
          const match = semesterSubjects.find(sub => {
            return sub.code === subjectParam;
          });
          if (match) {
            foundSubject = match;
          }
        }
      }

      if (foundSubject) {
        try { 
          await handleStartSubject(foundSubject); 
        } catch (error) {
          console.error('Error starting subject from URL:', error);
        }
      }
    };

    openSubjectFromURL();
  }, [searchParams, selectedSubject, activeYear, activeSemester, allPreRenderedSubjects]);

  // Topic-only navigation: if URL has ?topic=... but no subject, try to find and open the subject containing that topic
  useEffect(() => {
    const topicOnly = searchParams.get('topic');
    const subjectParam = searchParams.get('subject');
    if (!topicOnly || subjectParam || selectedSubject || !activeYear || !activeSemester || !allPreRenderedSubjects || Object.keys(allPreRenderedSubjects).length === 0) return;

    let cancelled = false;
    const findAndOpenSubjectByTopic = async () => {
      try {
        const semesterSubjects = allPreRenderedSubjects[`${activeYear}-${activeSemester}`] || [];
        const topicLower = topicOnly.toLowerCase();

        for (const subject of semesterSubjects) {
          if (cancelled) return;
          
          // Check if subject has unitsData with topics
          const unitsData = subject.unitsData || [];
          let found = false;
          
          for (const unit of unitsData) {
            if (cancelled) return;
            const topics = unit.topics || [];
            if (topics.some(topic => {
              const topicName = typeof topic === 'string' ? topic : (topic.name || topic.title || '');
              return topicName.toLowerCase().includes(topicLower);
            })) {
              found = true;
              break;
            }
          }
          
          if (found) {
            if (cancelled) return;
            await handleStartSubject(subject);
            // Update URL to include subject while preserving topic
            try {
              const url = new URL(window.location.href);
              url.searchParams.set('subject', subject.code);
              window.history.replaceState({}, '', url.toString());
            } catch (_) {}
            break;
          }
        }
      } catch (error) {
        console.warn('Topic-only navigation lookup failed:', error);
      }
    };

    findAndOpenSubjectByTopic();
    return () => { cancelled = true; };
  }, [searchParams, selectedSubject, activeYear, activeSemester, allPreRenderedSubjects]);
  
  // Curriculum subjects fetching removed
  useEffect(() => {
    // Subjects are now preloaded from the curriculum API on mount
    // and kept in the allPreRenderedSubjects state
  }, [userYearSem?.year, userYearSem?.semester, activeYear, activeSemester]);

  // Removed preloadSubjectContent - subjects are fetched from curriculum API on mount

  // Fetch semester XP data when active year changes
  useEffect(() => {
    const fetchSemesterXP = async (year) => {
      try {
        setXpLoading(true);
        
        // Dynamically get semesters for this year from pre-rendered subjects
        const availableSemesters = Object.keys(allPreRenderedSubjects)
          .filter(key => key.startsWith(`${year}-`))
          .map(key => parseInt(key.split('-')[1], 10))
          .sort((a, b) => a - b);

        if (availableSemesters.length === 0) {
          setSemesterXPData({});
          setXpLoading(false);
          return;
        }

        // Fetch XP for each available semester
        const xpResults = await Promise.allSettled(
          availableSemesters.map(sem => currentCourseAPI.getSemesterXP(year, sem))
        );
        
        const xpData = {};
        xpResults.forEach((result, index) => {
          const sem = availableSemesters[index];
          xpData[sem] = result.status === 'fulfilled' 
            ? result.value 
          : { earned_xp: 0, estimated_total_xp: 0, progress_percentage: 0 };
        });
        
        setSemesterXPData(xpData);
        setXpLoading(false);
        
      } catch (error) {
        console.error('Error fetching semester XP:', error);
        setXpLoading(false);
      }
    };
    
    if (activeYear && activeYear !== null && Object.keys(allPreRenderedSubjects).length > 0) {
      fetchSemesterXP(activeYear);
    }
  }, [activeYear, allPreRenderedSubjects]);

  // Debug: Track selectedSubject state changes
  useEffect(() => {
    
  }, [selectedSubject]);

  // Dispatch skeleton events based on loading state
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(isInitialRenderReady ? 'page-skeleton-end' : 'page-skeleton-start'));
      }
    } catch {}
  }, [isInitialRenderReady]);

  // Essential data fetching for user data and progress
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const [userData, progressData] = await Promise.all([
          currentCourseAPI.getCurrentCourse(),
          currentCourseAPI.getAllSubjectsProgress()
        ]);

        const userYear = userData.year || 1;
        const userSemester = userData.semester || 1;

        setUserYearSem({ year: userYear, semester: userSemester });
        setSubjectsWithProgress(progressData.subjects || []);
        setActiveYear(userYear);
        if (!userClosedSemesterRef.current) {
          setActiveSemester(userSemester);
        }
        setHasInitializedFromUserData(true);
      } catch (error) {
        setActiveYear((prev) => prev ?? 1);
        if (!userClosedSemesterRef.current) {
          setActiveSemester((prev) => prev ?? (userYearSem?.semester || 1));
        }
      }
    };

    // Prime UI immediately using locally available data (e.g., stored user info)
    const storedUserInfo = typeof window !== 'undefined' ? (() => {
      try {
        const raw = localStorage.getItem('userInfo');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    })() : null;

    if (storedUserInfo?.year) {
      setActiveYear(storedUserInfo.year);
      if (!userClosedSemesterRef.current) {
        setActiveSemester(storedUserInfo.semester || 1);
      }
      setUserYearSem({
        year: storedUserInfo.year,
        semester: storedUserInfo.semester || 1
      });
    } else {
      setActiveYear((prev) => prev ?? 1);
      if (!userClosedSemesterRef.current) {
        setActiveSemester((prev) => prev ?? 1);
      }
    }

    setShowAllYears(true);
    setIsInitialRenderReady(true);

    // Fetch subscription status and progress in the background after initial paint
    queueMicrotask(() => {
      refreshSubscription();
      fetchUserData();
    });
  }, []);

  // Fetch curriculum data
  useEffect(() => {
    const fetchCurriculum = async () => {
      try {
        setCurriculumLoading(true);
        const data = await currentCourseAPI.getStudentCurriculum();
        
        console.log('📚 Fetched curriculum data:', data);
        
        if (data && data.years) {
          const transformedSubjects = {};
          
          data.years.forEach(yearObj => {
            const year = yearObj.year;
            (yearObj.semesters || []).forEach(semObj => {
              const semester = semObj.semester;
              const key = `${year}-${semester}`;
              
              if (!transformedSubjects[key]) {
                transformedSubjects[key] = [];
              }
              
              const semesterSubjects = (semObj.subjects || []).map(subject => {
                // Construct a standardized title that matches what progress API returns
                const code = subject.code || '';
                const name = subject.name || '';
                const title = code ? `${code}: ${name}` : name;
                
                return {
                  title: title,
                  units: (subject.units || []).length || 5,
                  unitsData: subject.units || [],
                  code: code,
                  name: name,
                  progress: 0
                };
              });
              
              transformedSubjects[key].push(...semesterSubjects);
            });
          });
          
          console.log('🔄 Transformed subjects for UI:', transformedSubjects);
          setAllPreRenderedSubjects(transformedSubjects);
        }
      } catch (error) {
        console.error('❌ Error fetching curriculum:', error);
      } finally {
        setCurriculumLoading(false);
      }
    };

    fetchCurriculum();
  }, []);

  // Essential data fetching and component functionality
  useEffect(() => {
    // Always ensure subjects-page class is present when Course component is mounted
    const body = document.body;
    const html = document.documentElement;
    
    // Add subjects-page class to enable scrolling
    body.classList.add('subjects-page');
    html.classList.add('subjects-page');
    
    if (selectedSubject) {
      body.classList.add('course-content-active');
      html.classList.add('course-content-active');
      // Dispatch custom event to notify RootLayoutClient
      window.dispatchEvent(new CustomEvent('course-content-toggle'));
    } else {
      // Ensure proper cleanup when selectedSubject is null
      body.classList.remove('course-content-active');
      html.classList.remove('course-content-active');
      body.classList.remove('ios');
      // Restore scrolling - ensure subjects-page class is still there
      body.style.overflow = '';
      body.style.height = '';
      html.style.overflow = '';
      html.style.height = '';
      // Dispatch custom event to notify RootLayoutClient
      window.dispatchEvent(new CustomEvent('course-content-toggle'));
    }
    return () => {
      // Cleanup on unmount
      body.classList.remove('course-content-active');
      html.classList.remove('course-content-active');
      body.classList.remove('ios');
      body.style.overflow = '';
      body.style.height = '';
      html.style.overflow = '';
      html.style.height = '';
      // Note: Don't remove subjects-page class here as it's managed by subjects/page.js
      // Dispatch custom event to notify RootLayoutClient on cleanup
      window.dispatchEvent(new CustomEvent('course-content-toggle'));
    };
  }, [selectedSubject]);

  // CACHE-LESS: Skip activeTab localStorage storage
  // useEffect removed for cache-less experience

  // CACHE-LESS: Skip userClosedSemester localStorage reading
  // useEffect removed for fresh state always

  // CACHE-LESS: Skip userClosedSemester localStorage storage
  // useEffect removed for cache-less experience

  // Removed automatic preloading on semester change to reduce initial load time

  // Reset manual selection flag when component is reinitialized
  useEffect(() => {
    setUserHasManuallySelectedTab(false);
  }, []);

  const accessibleSubjectCodes = useMemo(() => {
    const subjects = subscriptionStatus?.accessible_subjects;
    if (!Array.isArray(subjects)) {
      return new Set();
    }
    return new Set(
      subjects
        .map((code) => (code || '').trim().toUpperCase())
        .filter(Boolean)
    );
  }, [subscriptionStatus?.accessible_subjects]);

  const backendAccessibleSemesters = useMemo(() => {
    const access = subscriptionStatus?.semester_access;
    const rawList = access?.accessible_semesters;
    if (!Array.isArray(rawList) || rawList.length === 0) {
      return null;
    }
    try {
      const set = new Set();
      for (const pair of rawList) {
        if (!pair || !Array.isArray(pair) || pair.length < 2) continue;
        const year = parseInt(pair[0], 10);
        const semester = parseInt(pair[1], 10);
        if (!year || !semester) continue;
        set.add(`${year}-${semester}`);
      }
      return set.size > 0 ? set : null;
    } catch (e) {
      return null;
    }
  }, [subscriptionStatus?.semester_access]);

  const accessInfo = useMemo(() => {
    const planId = (subscriptionStatus?.subscription_status || '').toLowerCase();
    const tier = (subscriptionStatus?.tier || '').toLowerCase();
    const isPlus = !!subscriptionStatus?.is_plus || planId.includes('plus') || tier === 'plus';
    const isPro = !!subscriptionStatus?.is_pro || planId.includes('pro') || tier === 'pro';
    const isYearly = !!subscriptionStatus?.is_yearly || planId.includes('year');
    const isSemester = !!subscriptionStatus?.is_semester || (!isYearly && planId.includes('sem'));
    const isActive = subscriptionStatus?.has_subscription === true && subscriptionStatus?.is_active === true;
    
    // Check for subject-based subscription
    const isSubjectBased = subscriptionStatus?.status === 'subject_based' || 
                          subscriptionStatus?.subscription_status === 'subject_based' ||
                          planId.includes('subject');

    return {
      planId,
      tier,
      isPlus,
      isPro,
      isYearly,
      isSemester,
      isActive,
      isSubjectBased
    };
  }, [subscriptionStatus]);

  const hasPremiumAccess = accessInfo.isPro || accessInfo.isPlus || accessInfo.isSubjectBased;
  const hasCourseAccess = hasPremiumAccess;
  const isExamPrepLocked = !accessInfo.isPro;

  const canAccessYear = useCallback((year) => {
    const plan = accessInfo;
    const userYear = userYearSem?.year ?? null;
    const userSemester = userYearSem?.semester ?? null;

    if (!plan.isSubjectBased && backendAccessibleSemesters && backendAccessibleSemesters.size > 0) {
      for (const key of backendAccessibleSemesters) {
        const parts = String(key).split('-');
        const y = parseInt(parts[0], 10);
        if (y === year) {
          return true;
        }
      }
      return false;
    }

    // Handle subject-based subscriptions
    if (plan.isSubjectBased) {
      // For subject-based users, check if they have purchased any subjects in this year
      const subjectsInYear = [];
      for (const key of Object.keys(allPreRenderedSubjects)) {
        if (key.startsWith(`${year}-`)) {
          const semesterSubjects = allPreRenderedSubjects[key] || [];
        semesterSubjects.forEach(subject => {
          if (subject.code && !subjectsInYear.includes(subject.code)) {
            subjectsInYear.push(subject.code);
          }
        });
        }
      }
      
      const hasSubjectsInYear = subjectsInYear.some((subjectCode) => accessibleSubjectCodes.has(subjectCode));
      
      // Also allow access to current year for 25% free trial
      if (year === userYear) {
        return true;
      }
      
      return hasSubjectsInYear;
    }
    
    if (plan.isPro || (plan.isPlus && plan.isYearly)) {
      if (userYear === null) {
        return year === 1;
      }

      if (year === userYear) {
        return true;
      }

      // Check if user is in the last semester of their year
      const availableSemestersForUserYear = Object.keys(allPreRenderedSubjects)
        .filter(key => key.startsWith(`${userYear}-`))
        .map(key => parseInt(key.split('-')[1], 10))
        .sort((a, b) => a - b);
      
      const isLastSemOfYear = availableSemestersForUserYear.length > 0 && 
                             userSemester === availableSemestersForUserYear[availableSemestersForUserYear.length - 1];

      if (isLastSemOfYear && year === userYear + 1) {
        return true;
      }
      return false;
    }

    if (userYear === null) {
      return year === 1;
    }

    return year === userYear;
  }, [accessInfo, userYearSem?.year, userYearSem?.semester, accessibleSubjectCodes, backendAccessibleSemesters, allPreRenderedSubjects]);

  // Function to check if a subject is locked - OPTIMIZED with subscription-based access
  const isSubjectLocked = useCallback((year, semester) => {
    const plan = accessInfo;
    const userYear = userYearSem?.year ?? null;
    const userSemester = userYearSem?.semester ?? null;

    if (!plan.isSubjectBased && backendAccessibleSemesters && backendAccessibleSemesters.size > 0) {
      const key = `${year}-${semester}`;
      return !backendAccessibleSemesters.has(key);
    }

    // Handle subject-based subscriptions
    if (plan.isSubjectBased) {
      // Get subjects from database (allPreRenderedSubjects) instead of hardcoded list
      const semesterKey = `${year}-${semester}`;
      const subjectsInSemester = allPreRenderedSubjects[semesterKey] || [];
      const subjectCodesInSemester = subjectsInSemester.map(subject => subject.code).filter(Boolean);
      const hasSubjectsInSemester = subjectCodesInSemester.some((subjectCode) => accessibleSubjectCodes.has(subjectCode));
      
      // Allow access if user has purchased subjects in this semester
      if (hasSubjectsInSemester) {
        return false;
      }
      
      // Allow access to current semester for 25% free trial
      if (year === userYear && semester === userSemester) {
        return false;
      }
      
      // Block access to other semesters where user has no purchased subjects
      return true;
    }

    // Fallback: if userYearSem is missing, allow current year/semester derived from plan (PRO unlocks all, others lock all)
    if (userYear === null || userSemester === null) {
      if (plan.isPro) {
        // Default for Pro when year/semester is unknown: only unlock first year
        return year !== 1;
      }
      if (plan.isPlus && plan.isYearly) {
        return year !== 1;
      }
      if (plan.isPlus) {
        return !(year === 1);
      }
      return true;
    }

    if (!plan.isPlus && !plan.isPro) {
      return !(year === userYear && semester === userSemester);
    }

    if (plan.isPro || (plan.isPlus && plan.isYearly)) {
      // PRO/Yearly plans: unlock current semester and next semester
      const accessible = new Set([`${userYear}-${userSemester}`]);
      
      // Get all available semesters across all years to find "next"
      const allSemesters = Object.keys(allPreRenderedSubjects)
        .map(key => {
          const [y, s] = key.split('-').map(Number);
          return { year: y, semester: s, absolute: y * 10 + s }; // Use a sortable value
        })
        .sort((a, b) => a.absolute - b.absolute);
      
      const currentIndex = allSemesters.findIndex(s => s.year === userYear && s.semester === userSemester);
      if (currentIndex !== -1 && currentIndex < allSemesters.length - 1) {
        const next = allSemesters[currentIndex + 1];
        accessible.add(`${next.year}-${next.semester}`);
      }
      
      return !accessible.has(`${year}-${semester}`);
    }

    if (plan.isPlus) {
      return !(year === userYear && semester === userSemester);
    }

    return true;
  }, [accessInfo, userYearSem?.year, userYearSem?.semester, subscriptionStatus, backendAccessibleSemesters, allPreRenderedSubjects, accessibleSubjectCodes]);

  // Helper function to get subscription display status
  const getSubscriptionDisplayStatus = useCallback(() => {
    if (!subscriptionStatus) return 'free';
    
    console.log('🔍 Course getSubscriptionDisplayStatus:', subscriptionStatus);
    
    // Handle trial expiration
    if (subscriptionStatus.trial_expired || subscriptionStatus.status === 'trial_expired') {
      console.log('❌ Trial expired status');
      return 'trial_expired';
    }
    
    // PRIORITY 1: Handle subject-based subscriptions
    if (subscriptionStatus.status === 'subject_based' || subscriptionStatus.subscription_status === 'subject_based') {
      console.log('📚 Subject-based subscription detected');
      return 'subject_based';
    }
    
    // PRIORITY 2: Handle active subscription (most reliable)
    if (hasPremiumAccess) {
      console.log('✅ Premium access detected');
      return 'premium';
    }
    
    // PRIORITY 3: Handle plan name (indicates subscription)
    if (subscriptionStatus.plan_name && subscriptionStatus.plan_name !== null) {
      console.log('✅ Plan name detected:', subscriptionStatus.plan_name);
      return 'premium';
    }
    
    // PRIORITY 4: Handle free trial
    if (subscriptionStatus.status === 'free_trial') {
      console.log('⏰ Free trial status');
      return 'free_trial';
    }
    
    // PRIORITY 5: Final fallback - if we have subscription data, assume premium
    if (subscriptionStatus && Object.keys(subscriptionStatus).length > 0 && 
        !subscriptionStatus.trial_expired && subscriptionStatus.status !== 'free') {
      console.log('✅ Has subscription data - assuming premium');
      return 'premium';
    }
    
    // Default to free
    console.log('❌ Defaulting to free status');
    return 'free';
  }, [subscriptionStatus]);

  // Function to check if content should be locked due to free trial - OPTIMIZED
  const isLockedByFreeTrial = useCallback((subject, unitIndex, topicIndex) => {
    const displayStatus = getSubscriptionDisplayStatus();
    
    console.log('🔍 Course content lock check:', {
      subscriptionStatus,
      displayStatus,
      unitIndex,
      topicIndex
    });
    
    // Check if trial has expired
    if (displayStatus === 'trial_expired') {
      console.log('🔒 Content locked - trial expired');
      return true; // All content locked if trial expired
    }
    
    // If user has premium status, allow full access
    if (displayStatus === 'premium') {
      console.log('✅ Content unlocked - premium status');
      return false;
    }
    
    // For subject-based users, allow access - backend will handle 25% vs full access
    if (displayStatus === 'subject_based') {
      console.log('📚 Subject-based user - allowing access, backend handles restrictions');
      return false;
    }
    
    // For free trial users, only first topic of unit 1 is accessible
    if (displayStatus === 'free_trial') {
      const isLocked = unitIndex > 0 || topicIndex > 0;
      console.log('🔍 Free trial check:', { isLocked, unitIndex, topicIndex });
      return isLocked;
    }
    
    // For free users, only first topic of unit 1 is accessible
    if (displayStatus === 'free') {
      const isLocked = unitIndex > 0 || topicIndex > 0;
      console.log('🔍 Free user check:', { isLocked, unitIndex, topicIndex });
      return isLocked;
    }
    
    return false;
  }, [subscriptionStatus, getSubscriptionDisplayStatus]);

  // Instant subject rendering without any delays
  const renderSubjects = (isXpLoading = false) => {
    // Double-check that we have valid semester and year data
    if (!activeSemester || activeSemester === null || !activeYear || activeYear === null) {
      return null;
    }
    
    const isLocked = isSubjectLocked(activeYear, activeSemester);
    const isFreeTrialMessage = subscriptionStatus === 'free' && !isLocked;
    
    // Use pre-rendered subjects for instant display
    const subjectsToRender = allPreRenderedSubjects[`${activeYear}-${activeSemester}`] || [];
    
    // Subjects are loaded from curriculum API on mount
    
    if (curriculumLoading || (subjectsToRender.length === 0 && isPreloading)) {
      return (
        <div ref={subjectsRef} className={currentStyles['subjects-container']}>
            <div className={currentStyles['subjects-loading-skeleton']}>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className={currentStyles['subject-item-skeleton']}>
                  <div className={currentStyles['subject-icon-skeleton']}></div>
                  <div className={currentStyles['subject-details-skeleton']}>
                    <div className={currentStyles['subject-name-skeleton']}></div>
                    <div className={currentStyles['subject-info-skeleton']}></div>
                    <div className={currentStyles['subject-progress-bar-skeleton']}></div>
                  </div>
                  <div className={currentStyles['subject-chevron-skeleton']}></div>
                </div>
              ))}
            </div>
        </div>
      );
    }

    if (subjectsToRender.length === 0) {
      return (
        <div ref={subjectsRef} className={currentStyles['subjects-container']}>
            <div className={currentStyles['no-subjects-message']}>
              <span>No subjects available for this semester yet.</span>
            </div>
        </div>
      );
    }

    return (
      <div ref={subjectsRef} className={currentStyles['subjects-list']}>
        {subjectsToRender.map((subject, index) => {
          // Extract subject code and name
          const [code, ...nameParts] = subject.title.split(': ');
          const name = nameParts.join(': ');
          const subjectCode = code;
          
          // Subject data comes from curriculum API
          // Calculate percentage = completed_topics / total_topics (from backend data)
          let progress = 0;
          const progressEntry = Array.isArray(subjectsWithProgress)
            ? subjectsWithProgress.find((s) => {
                if (!s || !s.title) return false;
                // Try exact match first
                if (s.title === subject.title) return true;
                // Try case-insensitive and normalized match
                const sNormalized = s.title.toLowerCase().replace(/\s+/g, ' ').trim();
                const subNormalized = subject.title.toLowerCase().replace(/\s+/g, ' ').trim();
                return sNormalized === subNormalized;
              })
            : null;
          if (
            progressEntry &&
            typeof progressEntry.completed_topics === 'number' &&
            typeof progressEntry.total_topics === 'number' &&
            progressEntry.total_topics > 0
          ) {
            progress = Math.min(
              100,
              Math.round((progressEntry.completed_topics / progressEntry.total_topics) * 100)
            );
          } else if (typeof progressEntry?.progress === 'number') {
            // Fallback to server-provided progress percentage if counts unavailable
            progress = progressEntry.progress;
          } else {
            // Final fallback to any subject-level default
            progress = subject.progress || 0;
          }
          const units = subject.units || 5;
          
          // Prefetch content on hover removed
          const handleMouseEnter = () => {};
          
          return (
            <div 
              className={`${currentStyles['subject-item']} ${isLocked ? currentStyles['subject-item-locked'] : ''}`} 
              key={subject.title}
              onMouseEnter={handleMouseEnter}
            >
              <div className={currentStyles['subject-icon']}>
                {subjectCode}
              </div>
              <div className={currentStyles['subject-details']}>
                <div className={currentStyles['subject-name']}>
                  {name}
                </div>
                <div className={currentStyles['subject-info']}>
                  {units} units, {progress === 100 ? '100% complete' : progress > 0 ? `${progress}% complete` : '0% complete'}
                  {progress === 100 && <span className={currentStyles['completion-check']}> ✓</span>}
                </div>
                <div className={currentStyles['subject-progress-bar']}>
                  <div 
                    className={currentStyles['subject-progress-fill']} 
                    style={{ 
                      width: `${progress}%`,
                      backgroundColor: progress === 100 ? '#19c37d' : progress > 0 ? '#00b6ed' : '#e0e0e0'
                    }}
                  ></div>
                </div>
              </div>
              {isLocked ? (
                <button
                  className={currentStyles['subject-upgrade-btn']}
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push('/upgrade');
                  }}
                >
                  Upgrade
                </button>
              ) : (
                <button
                  className={
                    `${currentStyles['subject-start-btn']} ` +
                    `${(isXpLoading || loadingSubject === subject.title) ? (currentStyles['loading'] || '') : ''}`
                  }
                  disabled={isXpLoading || loadingSubject === subject.title}
                  style={{
                    opacity: (isXpLoading || loadingSubject === subject.title) ? 0.9 : 1,
                    cursor: (isXpLoading || loadingSubject === subject.title) ? 'not-allowed' : 'pointer',
                    pointerEvents: (isXpLoading || loadingSubject === subject.title) ? 'none' : 'auto'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isXpLoading) return; // Prevent action if XP is still loading
                    
                    const subjectCodeEncoded = encodeURIComponent(subjectCode);
                    
                    // Start the subject - redirect immediately, fetch in background
                    setLoadingSubject(subject.title);
                    handleStartSubject(subject)
                      .catch(error => {
                        console.error('Error starting subject:', error);
                        setLoadingSubject(null);
                      })
                      .finally(() => {
                        // Clear loading after transition completes
                        setTimeout(() => {
                          setLoadingSubject(null);
                        }, 200);
                      });
                    
                    // Update URL immediately
                    try {
                      const url = new URL(window.location.href);
                      url.searchParams.set('subject', subjectCodeEncoded);
                      window.history.replaceState({}, '', url.toString());
                    } catch (_) {}
                  }}
                >
                  {(isXpLoading || loadingSubject === subject.title) ? (
                    <span className={currentStyles['btn-spinner'] || styles['btn-spinner']} aria-label="Loading" />
                  ) : (
                    'Start'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Optimized render content function
  const renderContent = (currentStyles) => {
    if (activeTab === 'all') {
      // Dynamically get semesters for the active year from the pre-rendered subjects keys
      const availableSemesters = Object.keys(allPreRenderedSubjects)
        .filter(key => key.startsWith(`${activeYear}-`))
        .map(key => parseInt(key.split('-')[1], 10))
        .sort((a, b) => a - b);

      // If no semesters found for this year yet, default to [1, 2] but they will show as empty
      const semestersToRender = availableSemesters.length > 0 ? availableSemesters : [1, 2];

      return (
        <>
          <div className={currentStyles['semesters-grid']}>
            {semestersToRender.map(semester => {
              const isLocked = activeYear && activeYear !== null ? isSubjectLocked(activeYear, semester) : true;
              const isCurrentSemester = activeYear === userYearSem?.year && semester === userYearSem?.semester;
              const xpData = semesterXPData[semester] || { earned_xp: 0, estimated_total_xp: 0, progress_percentage: 0 };
              
              // Use XP-based progress percentage from API
              const progressPercentage = xpData.progress_percentage || 0;
              
              const isExpanded = activeSemester === semester;
              
              return (
                <div 
                  key={semester} 
                  className={`${currentStyles['semester-card']} ${isExpanded ? currentStyles['semester-card-expanded'] : ''} ${isLocked ? currentStyles['semester-card-locked'] : ''}`}
                >
                  <div className={currentStyles['semester-header-row']}>
                    <div className={currentStyles['semester-title']}>
                      Semester {semester}
                      <div className={currentStyles['semester-subtitle']}>
                        {allPreRenderedSubjects[`${activeYear}-${semester}`]?.length || 0} Subjects
                      </div>
                    </div>
                    <div className={currentStyles['semester-right-section']}>
                      <div className={currentStyles['semester-xp-progress-row']} style={isMobile ? { position: 'relative' } : {}}>
                        <div className={currentStyles['semester-xp-header']}>
                          <div className={currentStyles['semester-xp']}>
                            <span aria-hidden="true" style={{color: 'inherit', marginRight: '6px'}}>⚡</span>
                            {xpLoading ? (
                              <div className={currentStyles['xp-loading-skeleton']}></div>
                            ) : (
                              `${xpData.estimated_total_xp} XP`
                            )}
                          </div>
                        </div>
                        <div className={currentStyles['semester-progress-section']}>
                          <div className={currentStyles['semester-progress-bar']}>
                            <div 
                              className={currentStyles['semester-progress-fill']} 
                              style={{ 
                                width: xpLoading ? '0%' : `${Math.min(Math.max(progressPercentage, 0), 100)}%` 
                              }}
                            ></div>
                          </div>
                          <div className={currentStyles['semester-percentage']}>
                            {xpLoading ? (
                              <div className={currentStyles['percentage-loading-skeleton']}></div>
                            ) : (
                              `${Math.min(Math.max(progressPercentage, 0), 100)}%`
                            )}
                          </div>
                        </div>
                        <button 
                          className={`${currentStyles['semester-toggle']} ${isMobile ? currentStyles['semester-toggle-mobile-right'] : ''}`}
                          style={isMobile ? {
                            position: 'absolute',
                            right: window.innerWidth <= 360 ? '10px' : window.innerWidth <= 480 ? '12px' : '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            marginTop: '0',
                            marginLeft: '0',
                            alignSelf: 'unset',
                            zIndex: '10'
                          } : {}}
                        onClick={() => {
                          try {
                            if (isExpanded) {
                              // Collapse the semester - use callback pattern for state updates
                              setActiveSemester(prev => null);
                              setUserClosedSemester(prev => true);
                            } else {
                              // Expand the semester - use callback pattern for state updates
                              setActiveSemester(prev => semester);
                              setUserClosedSemester(prev => false);
                              setSelectedSubject(null);
                              // Subjects are already loaded from curriculum API
                            }
                          } catch (error) {
                            console.error('Error in semester toggle:', error);
                            // Fallback: ensure semester is properly set
                            setActiveSemester(isExpanded ? null : semester);
                          }
                        }}
                      >
                        {isExpanded ? (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="18,15 12,9 6,15"></polyline>
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6,9 12,15 18,9"></polyline>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  </div>
                  
                  {/* Subjects dropdown - only render when expanded */}
                  {isExpanded && (
                    <div className={`${currentStyles['semester-subjects']} ${currentStyles['subjects-visible']}`}>
                      {renderSubjects(xpLoading)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      );
    } else if (activeTab === 'in-progress' || activeTab === 'completed') {
      // Check if user is viewing their current year and semester
      if (!activeYear || !activeSemester || activeYear === null || activeSemester === null || activeYear !== userYearSem?.year || activeSemester !== userYearSem?.semester) {
        return (
          <div style={{textAlign: 'center', color: '#aaa', marginTop: '2rem'}}>
                    <div>You can only view {activeTab === 'in-progress' ? 'in-progress' : 'completed'} subjects for your year and semester.</div>
        <div>Year {userYearSem?.year}, Semester {userYearSem?.semester}</div>
            <div>Viewing: Year {activeYear}, Semester {activeSemester}</div>
          </div>
        );
      }
      // Only show subjects if user has clicked Start Learning
      return hasClickedStartLearning ? renderSubjects() : (
        <div style={{textAlign: 'center', color: '#aaa', marginTop: '2rem'}}>
          <div>Click "Start Learning" on a semester to view subjects.</div>
        </div>
      );
    }
    return (
      <div style={{textAlign: 'center', color: '#aaa', marginTop: '2rem'}}>No subjects to show for this tab yet.</div>
    );
  };

  // Removed: localStorage-based auto-open for selected subject

  // Removed: localStorage-based auto-open for last accessed subject

  // Handle semester start learning
  const handleStartLearning = (semester) => {
    setActiveSemester(semester);
    setUserClosedSemester(false); // Reset the flag when user clicks start learning
    setSelectedSubject(null);
    setHasClickedStartLearning(true); // Mark that user has clicked start learning
  };


  
  // Handle starting a subject - Redirect immediately, load content in background
  const handleStartSubject = async (subject) => {
    if (!activeYear || !activeSemester || activeYear === null || activeSemester === null) {
      console.warn('⚠️ Cannot start subject: missing year/semester data');
      return;
    }
    
    // The subject click already validates locks; avoid double-blocking here
    if (subject.action === 'Coming Soon') {
      console.warn('⚠️ Subject is coming soon, cannot start');
      return;
    }

    // Validate subject structure
    if (!subject || !subject.title) {
      console.error('❌ Invalid subject data:', subject);
      return;
    }

    console.log('🎯 Starting subject:', subject.title);
    const yearSemester = `${activeYear}-${activeSemester}`;
    
    // Extract subject info immediately with error handling
    let code, name;
    try {
      const titleParts = subject.title.split(': ');
      code = titleParts[0];
      name = titleParts.slice(1).join(': ');
    } catch (error) {
      console.error('❌ Error parsing subject title:', error);
      code = 'SUB';
      name = subject.title;
    }
    const courseName = 'bpharmacy';

    // Cache-less: do not read any persisted section state
    let hasLastTopic = false;
    let lastUnitIndex = 0;
    let lastTopicIndex = 0;

    // INSTANT DISPLAY: Use preloaded unitsData from curriculum API if available
    // Check both unitsData (camelCase) and units_data (snake_case) for compatibility
    let content = [];
    const unitsData = subject.unitsData || subject.units_data || [];
    
    if (Array.isArray(unitsData) && unitsData.length > 0) {
      // Transform unitsData to CourseContent format instantly
      content = unitsData.map(unit => ({
        name: unit.title || unit.name || 'Unit',
        title: unit.title || unit.name || 'Unit',
        topics: (unit.topics || []).map(topic => ({
          topicName: typeof topic === 'string' ? topic : (topic.name || topic.title || topic.topicName || String(topic)),
          title: typeof topic === 'string' ? topic : (topic.name || topic.title || topic.topicName || String(topic)),
          duration: typeof topic === 'object' ? (topic.duration || '15 min') : '15 min',
          files: typeof topic === 'object' ? (topic.files || []) : [],
          hasVideo: typeof topic === 'object' ? (topic.hasVideo || false) : false,
          hasDocument: typeof topic === 'object' ? (topic.hasDocument || false) : false,
          videoUrl: typeof topic === 'object' ? (topic.videoUrl || null) : null,
          isAccessible: typeof topic === 'object' ? (topic.isAccessible !== false) : true,
          isLocked: typeof topic === 'object' ? Boolean(topic.isLocked) : false,
          isCompleted: typeof topic === 'object' ? Boolean(topic.isCompleted) : false
        }))
      }));
      console.log('⚡ Using preloaded unitsData for instant display:', content.length, 'units');
    }
    
    // Create subject object for CourseContent - redirect immediately
    const subjectForCourse = {
      ...subject,
      code: code || 'SUB',
      name: name || subject.title,
      fullTitle: subject.title,
      yearSemester,
      preloadedUnits: content || [],
      isFreeTrial: getSubscriptionDisplayStatus() === 'free',
      hasLastTopic,
      lastUnitIndex,
      lastTopicIndex,
      fullPath: `${courseName}/${yearSemester}/${subject.title}`
    };

    console.log('🎯 Redirecting to CourseContent');
    console.log('📚 Subject data:', {
      title: subjectForCourse.title,
      code: subjectForCourse.code,
      name: subjectForCourse.name,
      hasPreloadedUnits: subjectForCourse.preloadedUnits.length > 0,
      unitsCount: subjectForCourse.preloadedUnits.length,
      topicsCount: subjectForCourse.preloadedUnits.reduce((sum, unit) => sum + (unit.topics?.length || 0), 0),
      isFreeTrial: subjectForCourse.isFreeTrial
    });

    // Redirect immediately - CourseContent will show skeleton while loading if needed
    try {
      startTransition(() => {
        setSelectedSubject(subjectForCourse);
      });
    } catch (_) {
      setSelectedSubject(subjectForCourse);
    }
    
    // If no preloaded content, logic removed
    if (!content || content.length === 0) {
      console.log('🔄 No preloaded data for:', subject.title);
    }
  };

  // Optimized tab and year change handlers
  const handleTabChange = useCallback((newTab) => {
    setActiveTab(newTab);
    const targetYear = userYearSem?.year || 1;
    setActiveYear(targetYear);
    
      if (!userClosedSemesterRef.current) {
      // Find available semesters for this year
      const availableSemesters = Object.keys(allPreRenderedSubjects)
        .filter(key => key.startsWith(`${targetYear}-`))
        .map(key => parseInt(key.split('-')[1], 10))
        .sort((a, b) => a - b);
      
      if (availableSemesters.length > 0) {
        // Use standard semester lookup now that backend is normalized
        const userSem = userYearSem?.semester || 1;
        if (availableSemesters.includes(userSem)) {
          setActiveSemester(userSem);
        } else {
          setActiveSemester(availableSemesters[0]);
      }
    } else {
        setActiveSemester(1);
      }
    }
    
    setSelectedSubject(null);
    setHasClickedStartLearning(false); // Reset flag when changing tabs
    setUserHasManuallySelectedTab(true);
    // Always show all years for all tabs
    setShowAllYears(true);
    // Cache-less: do not persist active tab
  }, [userYearSem?.year, userYearSem?.semester, canAccessYear, allPreRenderedSubjects]);

  const handleYearChange = useCallback((year) => {
    setActiveYear(year);
    if (!userHasManuallySelectedTab) {
      setUserHasManuallySelectedTab(true);
    }

    // Dynamically set active semester to the first available semester for this year
    const availableSemesters = Object.keys(allPreRenderedSubjects)
      .filter(key => key.startsWith(`${year}-`))
      .map(key => parseInt(key.split('-')[1], 10))
      .sort((a, b) => a - b);

    if (availableSemesters.length > 0) {
      setActiveSemester(availableSemesters[0]);
    } else {
      // Fallback for universities that use 1-2 for every year
      setActiveSemester(1);
    }
  }, [userHasManuallySelectedTab, allPreRenderedSubjects]);

  const handleSemesterChange = useCallback((semester) => {
    // Allow users to view all semesters in any year
    setActiveSemester(semester);
    setUserClosedSemester(false); // Reset the flag when user manually opens a semester
    setSelectedSubject(null);
    setHasClickedStartLearning(false); // Reset flag when changing semesters
  }, [activeYear, userYearSem?.year, userYearSem?.semester]);

  const renderSemesterCards = () => (
    <div className={currentStyles['semesters-grid']}>
      {SEMESTERS.map((semester) => {
        const xpData = semesterXPData[semester] || { earned_xp: 0, estimated_total_xp: 2000, progress_percentage: 0 };
        const isLoading = xpLoading;
        
        return (
          <div
            key={semester}
            className={
              currentStyles['semester-card'] +
              (activeSemester === semester ? ' ' + currentStyles['semester-card-active'] : '')
            }
          >
            <div className={currentStyles['semester-header-row']}>
              <span className={currentStyles['semester-title']}>Semester {semester}</span>
              <span className={currentStyles['semester-progress']}>
                <span role="img" aria-label="star" style={{color: '#ffc107', fontSize: '1.2em', verticalAlign: 'middle'}}>⭐</span>
                &nbsp;Progress: {isLoading ? 'Loading...' : `${xpData.estimated_total_xp} XP`}
              </span>
            </div>
            <div className={currentStyles['semester-xp-info']}>
              <span role="img" aria-label="target">🎯</span> Complete this semester to earn up to {xpData.estimated_total_xp} XP
            </div>
            <button className={currentStyles['semester-start-btn']} style={{backgroundColor: '#ff4747', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer'}} onClick={() => handleStartLearning(semester)}>
              Start Learning
            </button>
          </div>
        );
      })}
    </div>
  );

  // Function to refresh course data removed
  const refreshCourseData = useCallback(async () => {
    if (!selectedSubject) return;
    console.log('🔄 Refresh logic removed');
  }, [selectedSubject, activeYear, activeSemester]);

  // Layered rendering: keep subjects view mounted and overlay CourseContent

  // Safety check to ensure userYearSem and activeYear are properly initialized
  if (!userYearSem || typeof userYearSem !== 'object' || activeYear === null) {
    return <LoadingSkeleton currentStyles={currentStyles} />;
  }



  return (
    <div 
      className={`${currentStyles['course-container']} ${isDarkMode ? 'dark-theme' : 'light-theme'}`}
      data-theme={isDarkMode ? 'dark' : 'light'}
    >
      
      <div className={currentStyles['course-header']}>
        <div className={currentStyles['header-top']}>
          <h1>My Subjects</h1>
          
          {(() => {
            const displayStatus = getSubscriptionDisplayStatus();
            
            if (displayStatus === 'premium') {
              const planName = (subscriptionStatus?.plan_name || '').trim() || 'Premium Plan';
              return (
                <span 
                  className={currentStyles['premium-pill']} 
                  data-mobile={isMobile}
                >
                  <svg
                    className={currentStyles['premium-icon']}
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                  {planName}
                </span>
              );
            } else if (displayStatus === 'subject_based') {
              const subjectPlanName = (subscriptionStatus?.plan_name || '').trim() || 'Subject-Based Plan';
              return (
                <span 
                  className={currentStyles['premium-pill']}
                  data-mobile={isMobile}
                >
                  <svg
                    className={currentStyles['premium-icon']}
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                  {subjectPlanName}
                </span>
              );
            } else if (displayStatus === 'free_trial') {
              const daysRemaining = subscriptionStatus?.trial_days_remaining;
              let trialLabel = (subscriptionStatus?.plan_name || '').trim();

              if (typeof daysRemaining === 'number') {
                if (daysRemaining > 1) {
                  trialLabel = `Free Trial · ${daysRemaining} days left`;
                } else if (daysRemaining === 1) {
                  trialLabel = 'Free Trial · 1 day left';
                } else if (daysRemaining === 0) {
                  trialLabel = 'Free Trial · ends today';
                }
              }

              if (!trialLabel) {
                const validUntil = subscriptionStatus?.valid_until;
                if (validUntil) {
                  try {
                    const formattedDate = new Date(validUntil).toLocaleDateString();
                    trialLabel = `Free Trial · until ${formattedDate}`;
                  } catch {
                    trialLabel = 'Free Trial';
                  }
                } else {
                  trialLabel = 'Free Trial';
                }
              }
              return (
                <span className={currentStyles['trial-pill']}>
                  <svg
                    className={currentStyles['trial-icon']}
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 7l5 5 4-8 4 8 5-5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
                  </svg>
                  {trialLabel}
                </span>
              );
            } else if (displayStatus === 'trial_expired') {
              return (
                <span className={currentStyles['expired-pill']}>
                  <svg
                    className={currentStyles['expired-icon']}
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path>
                  </svg>
                  Trial Expired
                </span>
              );
            } else {
              return (
                <span className={currentStyles['free-pill']}>
                  <svg
                    className={currentStyles['free-icon']}
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 7l5 5 4-8 4 8 5-5v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"></path>
                  </svg>
                  Free Plan
                </span>
              );
            }
          })()}
        </div>
      </div>
      




      <div 
        className={currentStyles['year-switcher-group']} 
        role="tablist" 
        aria-label="Select academic year"
      >
        {[1, 2, 3, 4].map((year, index) => {
          const accessible = canAccessYear(year);
          const isLocked = !accessible;
          const isCurrentYear = year === userYearSem?.year;
          
          return (
            <button
              key={year}
              className={`${currentStyles.yearTab} ${activeYear === year ? currentStyles.yearTabActive : ''} ${isLocked ? currentStyles.yearTabLocked : ''}`}
              onClick={() => handleYearChange(year)}
              role="tab"
              aria-selected={accessible && activeYear === year}
              aria-disabled={isLocked}
              tabIndex={accessible && activeYear === year ? 0 : -1}
              onKeyDown={(e) => {
                if (isLocked) {
                  return;
                }
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  e.preventDefault();
                  const years = [1, 2, 3, 4];
                  const currentIdx = years.indexOf(activeYear ?? 1);
                  let nextIdx = currentIdx;
                  if (e.key === 'ArrowRight') {
                    for (let i = currentIdx + 1; i < years.length; i++) {
                      if (canAccessYear(years[i])) {
                        nextIdx = i;
                        break;
                      }
                    }
                  } else {
                    for (let i = currentIdx - 1; i >= 0; i--) {
                      if (canAccessYear(years[i])) {
                        nextIdx = i;
                        break;
                      }
                    }
                  }
                  const nextYear = years[nextIdx];
                  if (nextYear !== undefined) {
                    handleYearChange(nextYear);
                  }
                }
              }}
              title={isLocked ? `Year ${year} is locked - Upgrade to access` : `View Year ${year} subjects`}
            >
              {year === 1 ? 'I Year' : year === 2 ? 'II Year' : year === 3 ? 'III Year' : 'IV Year'}

              {isLocked && <FaLock className={currentStyles['lock-icon']} />}
            </button>
          );
        })}
      </div>





      {renderContent(currentStyles)}

      {selectedSubject && (
        <div
          className={currentStyles['course-content-overlay']}
          ref={(el) => {
            overlayRef.current = el;
            try {
              if (el) {
                requestAnimationFrame(() => {
                  try { el.classList.add('entered'); } catch (_) {}
                });
              }
            } catch (_) {}
          }}
        >
          <div className={currentStyles['overlay-card']}>
            <CourseContent 
              subject={selectedSubject} 
              isLoading={isSubjectLoading}
              subscriptionStatus={getSubscriptionDisplayStatus()}
              subscriptionData={subscriptionStatus}
              onRefreshCourseData={refreshCourseData}
              onBack={() => {
                // Always return to Subjects section (/subjects)
                try { overlayRef.current?.classList.add('closing'); } catch (_) {}
                suppressAutoOpenRef.current = true;
                
                // Immediately remove course-content-active class to restore scrolling
                if (typeof document !== 'undefined') {
                  const body = document.body;
                  const html = document.documentElement;
                  body.classList.remove('course-content-active');
                  html.classList.remove('course-content-active');
                  body.classList.remove('ios');
                  // Ensure subjects-page class is present for scrolling
                  body.classList.add('subjects-page');
                  html.classList.add('subjects-page');
                  // Ensure scrolling is restored
                  body.style.overflow = '';
                  body.style.height = '';
                  html.style.overflow = '';
                  html.style.height = '';
                }
                
                try {
                  const url2 = new URL(window.location.href);
                  url2.searchParams.delete('subject');
                  const newSearch2 = url2.searchParams.toString();
                  const newHref2 = '/subjects' + (newSearch2 ? `?${newSearch2}` : '');
                  window.history.replaceState({}, '', newHref2);
                } catch (_) {}
                setTimeout(() => {
                  setSelectedSubject(null);
                  overlayEnteredRef.current = false;
                  try { overlayRef.current?.classList.remove('closing'); } catch (_) {}
                  
                  // Double-check cleanup after state update
                  if (typeof document !== 'undefined') {
                    const body = document.body;
                    const html = document.documentElement;
                    body.classList.remove('course-content-active');
                    html.classList.remove('course-content-active');
                    body.classList.remove('ios');
                    // Ensure subjects-page class is present for scrolling
                    body.classList.add('subjects-page');
                    html.classList.add('subjects-page');
                    body.style.overflow = '';
                    body.style.height = '';
                    html.style.overflow = '';
                    html.style.height = '';
                  }
                  
                  setTimeout(() => { suppressAutoOpenRef.current = false; }, 200);
                  router.push('/subjects');
                }, 150);
              }} 
            />
          </div>
        </div>
      )}

    </div>
  );
}

