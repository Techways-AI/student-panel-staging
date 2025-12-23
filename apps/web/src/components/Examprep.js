"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import Link from 'next/link';
import styles from './Examprep.module.css';
import mobileStyles from './ExamprepMobile.module.css';
import { quizAPI, modelPaperAPI } from '../lib/api';
import { FaLock } from 'react-icons/fa';  // Import lock icon
import { IoChevronDown, IoChevronForward } from 'react-icons/io5';  // Import chevron icons  // Import chevron down icon
import { useImportantQuestionsSectionManager } from '../hooks/useExamPrepSectionManager';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';

import { API_CONFIG } from '../config/api.js';

const API_BASE_URL = API_CONFIG.BASE_URL;

// Skeleton Loading Components
const ExamPrepSkeleton = ({ isDarkMode, isMobile }) => {
  const currentStyles = isMobile ? mobileStyles : styles;
  return (
  <div className={`${currentStyles.revisionRoot} ${isDarkMode ? currentStyles.darkTheme : currentStyles.lightTheme}`}>
    <div className={currentStyles.epHeader}>
      <div className={currentStyles.epTitleSkeleton}></div>
      <div className={currentStyles.epSubTitleSkeleton}></div>
    </div>

    <div className={currentStyles.epLayout}>
      <aside className={currentStyles.epSidebar}>
        <div className={currentStyles.sidebarTitleSkeleton}></div>
        <div className={currentStyles.searchBoxSkeleton}></div>
        <div className={currentStyles.filterGroupSkeleton}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className={currentStyles.filterItemSkeleton}></div>
          ))}
        </div>
      </aside>

      <main className={currentStyles.epCards}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className={currentStyles.subjectGroupSkeleton}>
            <div className={currentStyles.subjectCardSkeleton}>
              <div className={currentStyles.subjectIconSkeleton}></div>
              <div className={currentStyles.cardContentSkeleton}>
                <div className={currentStyles.cardTitleSkeleton}></div>
                <div className={currentStyles.cardMetaSkeleton}>
                  <div className={currentStyles.priorityBadgeSkeleton}></div>
                  <div className={currentStyles.metaTextSkeleton}></div>
                </div>
              </div>
              <div className={currentStyles.cardCaretSkeleton}></div>
            </div>
          </div>
        ))}
      </main>
    </div>
  </div>
);
};

const SubjectDetailsSkeleton = ({ isMobile }) => {
  const currentStyles = isMobile ? mobileStyles : styles;
  return (
    <>
      <div className={currentStyles.predictedQuestionsTitle} style={{ opacity: 0.7 }}>
        <span className={currentStyles.predictedTrophy}>🏆</span>
        Predicted Questions
      </div>
      <div className={currentStyles.predictedQuestionsList}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={currentStyles.questionRowSkeleton}>
            <div className={currentStyles.questionIndexSkeleton}></div>
            <div className={currentStyles.questionTextSkeleton}></div>
          </div>
        ))}
      </div>
    </>
  );
};

const SUBJECTS = ["Pharmacology", "Pharmaceutics", "Biochemistry"];
const SEMESTERS = ["Semester 1", "Semester 2", "Semester 3", "Semester 4"];
const YEARS = ["Year 1", "Year 2", "Year 3", "Year 4"];
const SEMESTERS_BY_YEAR = {
  "Year 1": ["Semester 1", "Semester 2"],
  "Year 2": ["Semester 1", "Semester 2"],
  "Year 3": ["Semester 1", "Semester 2"],
  "Year 4": ["Semester 1", "Semester 2"]
};

const SUBJECTS_BY_YEAR_SEMESTER = {
  "Year 1": {
    "Semester 1": [
      "Human Anatomy and Physiology I (PS101)",
      "Pharmaceutical Analysis I (PS102)",
      "Pharmaceutics (PS103)",
      "Pharmaceutical Inorganic Chemistry (PS104)",
      "Communication Skills (HS105)",
      "Remedial Biology / Remedial Mathematics (BS106 / BS107)"
    ],
    "Semester 2": [
      "Human Anatomy and Physiology II (PS201)",
      "Pharmaceutical Organic Chemistry-I (PS202)",
      "Biochemistry (BS203)",
      "Pathophysiology (BS204)",
      "Computer Applications in Pharmacy (CS205)",
      "NSS (MC200 – Mandatory Course)"
    ]
  },
  "Year 2": {
    "Semester 1": [
      "Pharmaceutical Organic Chemistry-II (PS301)",
      "Physical Pharmaceutics-I (PS302)",
      "Pharmaceutical Microbiology (BS303)",
      "Pharmaceutical Engineering (PC304)",
      "NSO (MC300 – Mandatory Course)"
    ],
    "Semester 2": [
      "Pharmaceutical Organic Chemistry-III (PS401)",
      "Physical Pharmaceutics-II (PC402)",
      "Pharmacology-I (PS403)",
      "Pharmacognosy and Phytochemistry-I (PC404)",
      "Pharmaceutical Jurisprudence (PS405)"
    ]
  },
  "Year 3": {
    "Semester 1": [
      "Medicinal Chemistry I (PS501)",
      "Industrial Pharmacy - I (PS502)",
      "Pharmacology II (PS503)",
      "Pharmacognosy and Phytochemistry - II (PS504)",
      "Generic Product Development (PS505)",
      "Green Chemistry (PS506)",
      "Cell and Molecular Biology (PS507)",
      "Cosmetic Science (PS508)",
      "Environmental Sciences (MC500 – Mandatory Course)"
    ],
    "Semester 2": [
      "Medicinal Chemistry - II (PS601)",
      "Pharmacology - III (PS602)",
      "Herbal Drug Technology (PS603)",
      "Biopharmaceutics and Pharmacokinetics (PS604)",
      "Pharmaceutical Quality Assurance (PS605)",
      "Pharmaceutical Biotechnology (PS606)",
      "Bioinformatics (PS607)",
      "Screening Methods in Pharmacology (PS608)",
      "Human Values and Professional Ethics (MC600 – Mandatory Course)"
    ]
  },
  "Year 4": {
    "Semester 1": [
      "Instrumental Methods of Analysis (PS701)",
      "Industrial Pharmacy-II (PS702)",
      "Pharmacy Practice (PS703)",
      "Medicinal Chemistry - III (PS704)",
      "Pharmaceutical Marketing (PS705)",
      "Pharmaceutical Regulatory Science (PS706)",
      "Pharmacovigilance (PS707)",
      "Quality Control and Standardization of Herbals (PS708)",
      "Practice School (PS710)",
      "Industrial Training (PS711)"
    ],
    "Semester 2": [
      "Biostatistics and Research Methodology (PS801)",
      "Social and Preventive Pharmacy (PS802)",
      "Novel Drug Delivery System (PS803)",
      "Computer Aided Drug Design (PS804)",
      "Nano Technology (PS805)",
      "Experimental Pharmacology (PS806)",
      "Advanced Instrumentation Techniques (PS807)",
      "Project Work (PS809)"
    ]
  }
};

// Removed hardcoded EXAM_PREP_TOPICS - now using dynamic data from database only

// Mobile detection hook
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  return isMobile;
};

export default function Revision() {
  const isMobile = useIsMobile();
  const { isDarkMode } = useTheme();
  const { subscriptionStatus } = useSubscription();
  const [userYear, setUserYear] = useState(1);
  const [userSemester, setUserSemester] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [expandedSubject, setExpandedSubject] = useState(null);
  const [isContentExpanded, setIsContentExpanded] = useState(true);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const subjectHeaderRef = useRef(null);

  // Model paper and predicted questions states (used for skeletons)
  const [predictedQuestions, setPredictedQuestions] = useState(null);
  const [loadingPredictedQuestions, setLoadingPredictedQuestions] = useState(false);
  const [predictedQuestionsError, setPredictedQuestionsError] = useState(null);

  // Global skeleton activity flag for this page: true when any major skeleton is visible
  // - isLoading: full-page ExamPrepSkeleton
  // - loadingPredictedQuestions: SubjectDetailsSkeleton for question list
  const isSkeletonActive = isLoading || loadingPredictedQuestions;

  useEffect(() => {
    console.log('📊 ExamPrep skeleton state:', { isLoading, loadingPredictedQuestions, isSkeletonActive });
    try {
      if (typeof window !== 'undefined') {
        const eventName = isSkeletonActive ? 'page-skeleton-start' : 'page-skeleton-end';
        console.log('📊 ExamPrep dispatching:', eventName);
        window.dispatchEvent(new Event(eventName));
      }
    } catch (e) {
      console.error('📊 ExamPrep event dispatch error:', e);
    }
    // Cleanup: ensure loader is hidden when component unmounts
    return () => {
      try {
        if (typeof window !== 'undefined') {
          console.log('📊 ExamPrep cleanup: dispatching page-skeleton-end');
          window.dispatchEvent(new Event('page-skeleton-end'));
        }
      } catch {}
    };
  }, [isSkeletonActive, isLoading, loadingPredictedQuestions]);

  // Debug theme state
  useEffect(() => {
    console.log('🎨 Theme changed:', isDarkMode ? 'Dark' : 'Light');
    console.log('📱 Document theme attribute:', document.documentElement.getAttribute('data-theme'));
  }, [isDarkMode]);

  // Debug subscription status
  useEffect(() => {
    console.log('🔍 Important Questions Subscription Status:', subscriptionStatus);
    console.log('🔍 Trial Expired:', subscriptionStatus?.trial_expired);
    console.log('🔍 Status:', subscriptionStatus?.status);
    console.log('🔍 Has Subscription:', subscriptionStatus?.has_subscription);
  }, [subscriptionStatus]);
  
  // Performance analysis states
  const [loadingPerformance, setLoadingPerformance] = useState(false);
  const [performanceError, setPerformanceError] = useState(null);
  
  // Quiz search states
  const [loadingQuizSearch, setLoadingQuizSearch] = useState(false);
  const [quizSearchError, setQuizSearchError] = useState(null);
  const [showQuizSearch, setShowQuizSearch] = useState(false);
  
  // Track subjects that have been checked and have no content to prevent infinite loops
  const [subjectsWithNoContent, setSubjectsWithNoContent] = useState(new Set());
  
  // Model paper availability states
  const [modelPaperAvailability, setModelPaperAvailability] = useState({});
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const isSubscriptionLoading =
    subscriptionStatus?.status === null || subscriptionStatus?.has_subscription === null;

  const accessibleSubjectCodeSet = useMemo(() => {
    if (!Array.isArray(subscriptionStatus?.accessible_subjects)) {
      return new Set();
    }

    return new Set(
      subscriptionStatus.accessible_subjects
        .map(code => (code ?? '').toString().trim().toLowerCase())
        .filter(Boolean)
    );
  }, [subscriptionStatus]);

  const getSubjectCodeFromName = useCallback((subjectName) => {
    if (!subjectName || typeof subjectName !== 'string') {
      return '';
    }

    const match = subjectName.match(/\(([^)]+)\)/);
    if (match && match[1]) {
      return match[1].trim().toLowerCase();
    }

    return subjectName
      .split(' ')
      .map(token => token.replace(/[^a-zA-Z0-9]/g, ''))
      .filter(Boolean)
      .slice(-1)[0]?.toLowerCase() || '';
  }, []);

  // Exam state management
  const initialSubjects = (SUBJECTS_BY_YEAR_SEMESTER[YEARS[0]] && SUBJECTS_BY_YEAR_SEMESTER[YEARS[0]][SEMESTERS_BY_YEAR[YEARS[0]][0]]) || [];
  const [examState, setExamState] = useState({
    selectedYear: 'Year 1',
    selectedSemester: 'Semester 1',
    selectedSubject: initialSubjects[0] || "",
    selectedTopicIdx: 0
  });
  
  // Performance and data states
  const [performanceData, setPerformanceData] = useState(null);
  const [quizSearchData, setQuizSearchData] = useState(null);



  // Section management
  const sectionId = 'important-questions-main';
  const { isRestored, getSavedSection, clearSavedProgress } = useImportantQuestionsSectionManager(
    sectionId,
    examState,
    setExamState,
    performanceData,
    setPerformanceData,
    quizSearchData,
    setQuizSearchData,
    predictedQuestions,
    setPredictedQuestions,
    true // enabled
  );
  
  // Debug hook parameters
  useEffect(() => {
    
  }, [sectionId, examState, performanceData, quizSearchData, predictedQuestions, isRestored]);

  // Initialize exam state and fetch user data on mount
  useEffect(() => {
    
    
    // Only set initial exam state if not restored from section management
    if (!isRestored) {
      
      // The initial state is already set in the useState above
    } else {
      
    }
  }, [isRestored, examState]);

  // Helper function to set default subject for fallback cases
  const setDefaultSubjectForFallback = (year, semester) => {
    console.log('🎯 Setting fallback subject for Year', year, 'Semester', semester);
    setExamState(prev => ({
      ...prev,
      selectedYear: `Year ${year}`,
      selectedSemester: `Semester ${semester}`
    }));
    
    const defaultSubjects = SUBJECTS_BY_YEAR_SEMESTER[`Year ${year}`]?.[`Semester ${semester}`] || [];
    if (defaultSubjects.length > 0) {
      console.log('📚 Setting fallback subject:', defaultSubjects[0]);
      setExamState(prev => ({
        ...prev,
        selectedSubject: defaultSubjects[0]
      }));
      
      // Force fetch content for fallback subject
      setTimeout(() => {
        console.log('🔄 Force fetching content for fallback subject:', defaultSubjects[0]);
        fetchPredictedQuestions(defaultSubjects[0]);
      }, 100);
    }
  };

  // Fetch user's year and semester
  useEffect(() => {
    const fetchUserData = async () => {
      try {
    
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.warn('⚠️ No authentication token found, using default values');
          setUserYear(1);
          setUserSemester(1);
          setIsLoading(false);
          return;
        }


        const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        
        
        if (response.ok) {
          const data = await response.json();
          
          setUserYear(data.year || 1);
          setUserSemester(data.semester || 1);
          
          // Always update year/semester based on user data (regardless of restored state)
          // This ensures the correct year/semester is used for API calls
          console.log('📊 Updating exam state with user data:', { 
            userYear: data.year, 
            userSemester: data.semester,
            newYear: `Year ${data.year || 1}`,
            newSemester: `Semester ${data.semester || 1}`,
            isRestored: isRestored
          });
          
          setExamState(prev => ({
            ...prev,
            selectedYear: `Year ${data.year || 1}`,
            selectedSemester: `Semester ${data.semester || 1}`
          }));
          
          // Only set default subject if no saved state exists
          if (!isRestored) {
            // Also set default subject if no saved state
            const defaultSubjects = SUBJECTS_BY_YEAR_SEMESTER[`Year ${data.year || 1}`]?.[`Semester ${data.semester || 1}`] || [];
            if (defaultSubjects.length > 0) {
              console.log('📚 Setting default subject after user data load:', defaultSubjects[0]);
              setExamState(prev => ({
                ...prev,
                selectedSubject: defaultSubjects[0]
              }));
              
              // Immediately fetch content for the initial subject after a short delay
              // This ensures the state has been updated before the API call
              setTimeout(() => {
                console.log('🔄 Force fetching content for initial subject:', defaultSubjects[0]);
                // Use the fresh user data values instead of examState
                const year = data.year || 1;
                const semester = data.semester || 1;
                console.log('🔄 Using fresh user data - Year:', year, 'Semester:', semester);
                fetchPredictedQuestionsWithYearSemester(defaultSubjects[0], year, semester);
              }, 100);
            }
          } else {
            console.log('📚 State was restored, keeping existing subject:', examState.selectedSubject);
            // For restored state, also ensure content is fetched if not already loaded
            if (!predictedQuestions) {
              setTimeout(() => {
                console.log('🔄 Force fetching content for restored subject:', examState.selectedSubject);
                fetchPredictedQuestions(examState.selectedSubject);
              }, 100);
            }
          }
        } else if (response.status === 401) {
          console.warn('⚠️ Authentication failed (401), using default values');
          setUserYear(1);
          setUserSemester(1);
          setDefaultSubjectForFallback(1, 1);
        } else if (response.status === 403) {
          console.warn('⚠️ Access forbidden (403), using default values');
          setUserYear(1);
          setUserSemester(1);
          setDefaultSubjectForFallback(1, 1);
        } else {
          console.warn(`⚠️ API error (${response.status}), using default values`);
          setUserYear(1);
          setUserSemester(1);
          setDefaultSubjectForFallback(1, 1);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        console.warn('⚠️ Using default values due to error');
        setUserYear(1);
        setUserSemester(1);
        setDefaultSubjectForFallback(1, 1);
      } finally {

        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [isRestored]);

  // Filter available years and semesters based on user's progress
  const availableYears = YEARS.filter(year => {
    const yearNum = parseInt(year.replace('Year ', ''));
    return yearNum <= userYear;
  });

  const availableSemesters = SEMESTERS_BY_YEAR[examState.selectedYear]?.filter(semester => {
    const semesterNum = parseInt(semester.replace('Semester ', ''));
    const yearNum = parseInt(examState.selectedYear.replace('Year ', ''));
    
    if (yearNum < userYear) {
      // Show all semesters for previous years
      return true;
    } else if (yearNum === userYear) {
      // Show only up to current semester for current year
      return semesterNum <= userSemester;
    }
    return false;
  }) || [];

  // Check if year/semester is locked
  const isYearLocked = (year) => {
    const yearNum = parseInt(year.replace('Year ', ''));
    return yearNum > userYear;
  };

  const isSemesterLocked = (semester) => {
    const semesterNum = parseInt(semester.replace('Semester ', ''));
    const yearNum = parseInt(examState.selectedYear.replace('Year ', ''));
    
    if (yearNum < userYear) {
      return false;
    } else if (yearNum === userYear) {
      return semesterNum > userSemester;
    }
    return true;
  };

  const handleYearChange = (e) => {
    const year = e.target.value;
    if (isYearLocked(year)) {
      return; // Don't allow selection of locked years
    }
    const firstAvailableSemester = SEMESTERS_BY_YEAR[year]?.[0] || 'Semester 1';
    const subjects = (SUBJECTS_BY_YEAR_SEMESTER[year] && SUBJECTS_BY_YEAR_SEMESTER[year][firstAvailableSemester]) || [];
    
    // Try to preserve the current subject if it exists in the new year/semester
    const currentSubject = examState.selectedSubject;
    const subjectExists = subjects.includes(currentSubject);
    const newSubject = subjectExists ? currentSubject : (subjects[0] || "");
    
    setExamState(prev => ({
      ...prev,
      selectedYear: year,
      selectedSemester: firstAvailableSemester,
      selectedSubject: newSubject,
      selectedTopicIdx: 0
    }));
    
    if (newSubject) {
      fetchPerformanceAnalysis(newSubject);
    }
  };

  const handleSemesterChange = (e) => {
    const semester = e.target.value;
    if (isSemesterLocked(semester)) {
      return; // Don't allow selection of locked semesters
    }
    const subjects = (SUBJECTS_BY_YEAR_SEMESTER[examState.selectedYear] && SUBJECTS_BY_YEAR_SEMESTER[examState.selectedYear][semester]) || [];
    
    // Try to preserve the current subject if it exists in the new semester
    const currentSubject = examState.selectedSubject;
    const subjectExists = subjects.includes(currentSubject);
    const newSubject = subjectExists ? currentSubject : (subjects[0] || "");
    
    setExamState(prev => ({
      ...prev,
      selectedSemester: semester,
      selectedSubject: newSubject,
      selectedTopicIdx: 0
    }));
    
    if (newSubject) {
      fetchPerformanceAnalysis(newSubject);
    }
  };

  const semesters = SEMESTERS_BY_YEAR[examState.selectedYear];
  const allSubjects =
    SUBJECTS_BY_YEAR_SEMESTER[examState.selectedYear] &&
    SUBJECTS_BY_YEAR_SEMESTER[examState.selectedYear][examState.selectedSemester]
      ? SUBJECTS_BY_YEAR_SEMESTER[examState.selectedYear][examState.selectedSemester]
      : [];

  // Subscription-based access info - memoized to prevent excessive calls
  const accessInfo = useMemo(() => {
    const planId = (subscriptionStatus?.subscription_status || '').toLowerCase();
    const tier = (subscriptionStatus?.tier || '').toLowerCase();
    const isPro = !!subscriptionStatus?.is_pro || planId.includes('pro') || tier === 'pro';
    const isPlus = !!subscriptionStatus?.is_plus || planId.includes('plus') || tier === 'plus';
    const isActive = subscriptionStatus?.has_subscription === true && subscriptionStatus?.is_active === true;

    return {
      planId,
      tier,
      isPro,
      isPlus,
      isActive
    };
  }, [subscriptionStatus]);

  const hasProAccess = accessInfo.isPro && accessInfo.isActive;
  const hasFullPlanAccess = hasProAccess;

  const hasSubjectAccess = useCallback((subjectName) => {
    if (!subjectName) {
      return false;
    }

    if (isSubscriptionLoading) {
      return true;
    }

    if (hasProAccess || hasFullPlanAccess) {
      return true;
    }

    const subjectCode = getSubjectCodeFromName(subjectName);
    if (!subjectCode) {
      return false;
    }

    return accessibleSubjectCodeSet.has(subjectCode);
  }, [accessibleSubjectCodeSet, getSubjectCodeFromName, hasFullPlanAccess, hasProAccess, isSubscriptionLoading]);

  const isSubjectLocked = useCallback((subjectName) => {
    if (isSubscriptionLoading) {
      return false;
    }

    return !hasSubjectAccess(subjectName);
  }, [hasSubjectAccess, isSubscriptionLoading]);

  // Filter subjects: always show all subjects. Locking handled by isSubjectLocked
  const subjects = allSubjects.filter((_, index) => true);

  const canAccessImportantQuestions = useMemo(() => {
    if (isSubscriptionLoading) {
      return true;
    }

    if (hasProAccess || hasFullPlanAccess) {
      return true;
    }

    return subjects.some(sub => hasSubjectAccess(sub));
  }, [hasFullPlanAccess, hasProAccess, hasSubjectAccess, isSubscriptionLoading, subjects]);

  // UI-only metadata for subject cards (does not affect backend)
  const getSubjectMeta = (subjectName) => {
    const normalized = subjectName.toLowerCase();
    if (normalized.includes("human anatomy")) {
      return { code: "HA", color: "#3b82f6", priority: "High Priority", hours: 3, marks: 75 };
    }
    if (normalized.includes("inorganic chemistry")) {
      return { code: "PI", color: "#8b5cf6", priority: "High Priority", hours: 3, marks: 75 };
    }
    if (normalized.includes("pharmaceutics")) {
      return { code: "PI", color: "#22c55e", priority: "Medium Priority", hours: 3, marks: 75 };
    }
    if (normalized.includes("organic chemistry")) {
      return { code: "PO", color: "#ef4444", priority: "High Priority", hours: 3, marks: 75 };
    }
    // Fallback generic style
    const words = subjectName.replace(/\(.*\)/, '').trim().split(/\s+/);
    const initials = (words[0]?.[0] || 'S') + (words[1]?.[0] || 'U');
    return { code: initials.toUpperCase(), color: "#64748b", priority: "Medium Priority", hours: 3, marks: 75 };
  };

  // Defensive: If selectedSubject is not in subjects, reset it
  React.useEffect(() => {
    if (subjects.length === 0) {
      return;
    }

    const selectedSubject = examState.selectedSubject;

    if (!selectedSubject || !subjects.includes(selectedSubject)) {
      const fallbackSubject = subjects.find(sub => hasSubjectAccess(sub));
      if (fallbackSubject) {
        setExamState(prev => ({
          ...prev,
          selectedSubject: fallbackSubject,
          selectedTopicIdx: 0
        }));
        if (fallbackSubject) {
          fetchPerformanceAnalysis(fallbackSubject);
        }
      }
      return;
    }

    if (!hasSubjectAccess(selectedSubject)) {
      const accessibleSubject = subjects.find(sub => hasSubjectAccess(sub));
      if (accessibleSubject && accessibleSubject !== selectedSubject) {
        setExamState(prev => ({
          ...prev,
          selectedSubject: accessibleSubject,
          selectedTopicIdx: 0
        }));
        fetchPerformanceAnalysis(accessibleSubject);
      }
    }
  }, [subjects, examState.selectedSubject, hasSubjectAccess]);

  // Fetch performance analysis when component mounts or subject changes
  // Check model paper availability when year/semester changes
  useEffect(() => {
    if (examState.selectedYear && examState.selectedSemester && !isRestored) {
      const year = parseInt(examState.selectedYear.replace('Year ', ''));
      const semester = parseInt(examState.selectedSemester.replace('Semester ', ''));
      checkModelPaperAvailability(year, semester);
    }
  }, [examState.selectedYear, examState.selectedSemester, isRestored]);

  // But only if we're not in the middle of restoring state
  React.useEffect(() => {
    const selectedSubject = examState.selectedSubject;
    const canAccessSelectedSubject = hasSubjectAccess(selectedSubject);

    if (!canAccessSelectedSubject) {
      setPredictedQuestions(null);
      return;
    }

    if (selectedSubject && !isRestored && !isLoading) {
      // Only fetch content after user data is loaded to ensure correct year/semester
      console.log('🚀 Fetching content for subject:', selectedSubject, 'Year:', examState.selectedYear, 'Semester:', examState.selectedSemester);
      
      // Expand content when a subject is selected
      setIsContentExpanded(true);
      
      fetchPerformanceAnalysis(selectedSubject);
      fetchPredictedQuestions(selectedSubject);
    } else if (isRestored) {

    }
  }, [examState.selectedSubject, examState.selectedYear, examState.selectedSemester, hasSubjectAccess, isRestored, isLoading]);

  // Filter topics by search - now using dynamic data from database
  const allTopics = predictedQuestions?.predicted_questions || [];
  const topics = search
    ? allTopics.filter(t => (t.question || '').toLowerCase().includes((search || '').toLowerCase()))
    : allTopics;
  const selectedTopic = topics[examState.selectedTopicIdx] || topics[0];

  // Next Topic Handler
  const handleNextTopic = () => {
    if (examState.selectedTopicIdx < topics.length - 1) {
      setExamState(prev => ({
        ...prev,
        selectedTopicIdx: prev.selectedTopicIdx + 1
      }));
    }
  };

  // Handle back navigation for mobile
  const handleBack = () => {
    if (typeof window !== 'undefined') {
      window.history.back();
    }
  };

  // Get topic type icon - updated for database structure
  const getTopicTypeIcon = (type) => {
    switch (type) {
      case 'long_answer': return '📝';
      case 'short_answer': return '📋';
      case 'very_short_answer': return '⚡';
      default: return '📖';
    }
  };

  // Get topic type label - updated for database structure
  const getTopicTypeLabel = (type) => {
    switch (type) {
      case 'long_answer': return 'Long Answer';
      case 'short_answer': return 'Short Answer';
      case 'very_short_answer': return 'Very Short Answer';
      default: return 'Question';
    }
  };

  // Remove hardcoded getPaperFormat function - now using database data only

  // Search quiz details by subject name
  const searchQuizDetails = async (subjectName) => {
    if (!subjectName) return;
    
    try {
      setLoadingQuizSearch(true);
      setQuizSearchError(null);
      
      // Extract subject name without course code (e.g., "Human Anatomy and Physiology I (PS101)" -> "Human Anatomy and Physiology I")
      const cleanSubjectName = subjectName.split('(')[0].trim();
      
      const searchResult = await quizAPI.searchBySubject(cleanSubjectName);
      
      setQuizSearchData(searchResult);
      setShowQuizSearch(true);
    } catch (error) {
      console.error('Error searching quiz details:', error);
      setQuizSearchError('Failed to search quiz details. Please try again.');
    } finally {
      setLoadingQuizSearch(false);
    }
  };

  // Fetch performance analysis for the selected subject
  const fetchPerformanceAnalysis = async (subjectName) => {
    if (!subjectName) return;
    
    try {
      setLoadingPerformance(true);
      setPerformanceError(null);
      
      // Extract subject name without course code (e.g., "Human Anatomy and Physiology I (PS101)" -> "Human Anatomy and Physiology I")
      const cleanSubjectName = subjectName.split('(')[0].trim();
      
  
      
      
      const analysis = await quizAPI.getPerformanceAnalysis();
      
      if (analysis) {
        // Filter performance data for the selected subject
        const subjectPerformance = analysis.subject_performance || {};
        const topicPerformance = analysis.topic_performance || {};
        
        // Filter subject-topic combinations that belong to the selected subject
        const subjectTopics = Object.entries(subjectPerformance)
          .filter(([subjectTopicKey, data]) => data.subject === cleanSubjectName)
          .reduce((acc, [subjectTopicKey, data]) => {
            acc[subjectTopicKey] = data;
            return acc;
          }, {});
        
        const filteredAnalysis = {
          ...analysis,
          subject_performance: subjectTopics,
          topic_performance: subjectTopics,
          strengths: analysis.strengths?.filter(strength => 
            strength.type === 'subject_topic' ? strength.subject === cleanSubjectName : 
            strength.type === 'subject' ? strength.name === cleanSubjectName :
            strength.subject === cleanSubjectName
          ) || [],
          weaknesses: analysis.weaknesses?.filter(weakness => 
            weakness.type === 'subject_topic' ? weakness.subject === cleanSubjectName :
            weakness.type === 'subject' ? weakness.name === cleanSubjectName :
            weakness.subject === cleanSubjectName
          ) || []
        };
        

        setPerformanceData(filteredAnalysis);
      }
    } catch (error) {
      console.error('Error fetching performance analysis:', error);
      setPerformanceError('Failed to load performance data. Please try again.');
    } finally {
      setLoadingPerformance(false);
    }
  };

  // Generate model paper from S3 document


  // Check model paper availability for all subjects in current year/semester
  const checkModelPaperAvailability = async (year, semester) => {
    try {
      setLoadingAvailability(true);
      console.log('🔍 Checking model paper availability for all subjects:', { year, semester });
      
      const availabilityData = await modelPaperAPI.checkAvailabilityBatch(year, semester);
      
      // Create a map of subject names to availability status
      const availabilityMap = {};
      availabilityData.subjects.forEach(subject => {
        availabilityMap[subject.subject] = subject.available;
      });
      
      console.log('📊 Model paper availability results:', availabilityMap);
      setModelPaperAvailability(availabilityMap);
    } catch (error) {
      console.error('Error checking model paper availability:', error);
      setModelPaperAvailability({});
    } finally {
      setLoadingAvailability(false);
    }
  };

  // Check if model paper exists in database first, then fetch if available
  const fetchPredictedQuestions = async (subject) => {
    if (!subject) return;
    
    // Extract year and semester numbers from examState
    const year = parseInt(examState.selectedYear.replace('Year ', ''));
    const semester = parseInt(examState.selectedSemester.replace('Semester ', ''));
    
    return fetchPredictedQuestionsWithYearSemester(subject, year, semester);
  };

  // Internal function that accepts explicit year and semester
  const fetchPredictedQuestionsWithYearSemester = async (subject, year, semester) => {
    if (!subject) return;
    
    try {
      setLoadingPredictedQuestions(true);
      setPredictedQuestionsError(null);
      
      console.log('🔍 Checking model paper availability for:', { 
        subject, 
        year, 
        semester,
        fullExamState: examState,
        selectedYear: examState.selectedYear,
        selectedSemester: examState.selectedSemester
      });
      
      // First check if model paper exists in database
      const availabilityCheck = await modelPaperAPI.checkAvailability(year, semester, subject);
      
      console.log('📡 API Response:', availabilityCheck);
      
      if (!availabilityCheck.available) {
        console.log('Model paper not available:', availabilityCheck.message);
        console.log('Setting error message:', availabilityCheck.message);
        setPredictedQuestionsError(availabilityCheck.message);
        setPredictedQuestions(null);
        // Mark this subject as having no content to prevent infinite loops
        setSubjectsWithNoContent(prev => new Set([...prev, subject]));
        // Auto-expand content even for error states so user can see the message
        setIsContentExpanded(true);
        return;
      }
      
      console.log('✅ Model paper is available, fetching full data...');
      
      // If available, fetch the full predicted questions data
      const response = await modelPaperAPI.getPredictedQuestionsByPath(year, semester, subject);
      
      if (!response || !response.predicted_questions) {
        throw new Error('Invalid response format');
      }
      
      console.log('✅ Successfully fetched predicted questions:', response.predicted_questions.length, 'questions');
      setPredictedQuestions(response);
      
      // Auto-expand content when successfully loaded
      setIsContentExpanded(true);
    } catch (error) {
      console.error('Error fetching predicted questions:', error);
      
      // Handle specific error messages
      if (error.message && error.message.includes('404')) {
        setPredictedQuestionsError('🔮 No predicted questions available for this subject yet. They need to be generated first.');
      } else if (error.message && error.message.includes('Invalid response format')) {
        setPredictedQuestionsError('Received invalid data from server. Please try again.');
      } else {
        setPredictedQuestionsError('Failed to fetch predicted questions. Please try again.');
      }
      setPredictedQuestions(null);
      
      // Auto-expand content even for error states so user can see the message
      setIsContentExpanded(true);
    } finally {
      setLoadingPredictedQuestions(false);
    }
  };

  // Use mobile styles when on mobile devices
  const currentStyles = isMobile ? mobileStyles : styles;
  const isExamPrepLocked = !canAccessImportantQuestions;

  // Auto-select first subject on mobile if none selected
  useEffect(() => {
    if (
      isMobile &&
      !examState.selectedSubject &&
      subjects.length > 0 &&
      !isLoading &&
      canAccessImportantQuestions
    ) {
      const initialAccessibleSubject = subjects.find(sub => hasSubjectAccess(sub)) || subjects[0];
      setExamState(prev => ({
        ...prev,
        selectedSubject: initialAccessibleSubject
      }));
      if (hasSubjectAccess(initialAccessibleSubject)) {
        setIsContentExpanded(true);
        fetchPredictedQuestions(initialAccessibleSubject);
      }
    }
  }, [canAccessImportantQuestions, examState.selectedSubject, hasSubjectAccess, isLoading, isMobile, subjects]);

  // Fallback: If we have a selected subject but no content after loading is done, force fetch
  useEffect(() => {
    if (
      !isLoading &&
      examState.selectedSubject &&
      !predictedQuestions &&
      !loadingPredictedQuestions &&
      hasSubjectAccess(examState.selectedSubject)
    ) {
      // Check if this subject is already known to have no content
      if (subjectsWithNoContent.has(examState.selectedSubject)) {
        console.log('🚫 Subject already known to have no content, skipping fallback fetch:', examState.selectedSubject);
        return;
      }
      
      console.log('🚨 Fallback: No content loaded for selected subject, force fetching:', examState.selectedSubject);
      setTimeout(() => {
        fetchPredictedQuestions(examState.selectedSubject);
      }, 500); // Slightly longer delay to ensure all state updates are complete
    }
  }, [isLoading, examState.selectedSubject, predictedQuestions, loadingPredictedQuestions, subjectsWithNoContent, subscriptionStatus]);

  // Show skeleton loading while data is loading
  if (isLoading) {
    return <ExamPrepSkeleton isDarkMode={isDarkMode} isMobile={isMobile} />;
  }

  return (
    <div className={`${currentStyles.revisionRoot} ${isDarkMode ? currentStyles.darkTheme : currentStyles.lightTheme}`}>
      {/* Desktop Header - Outside epLayout */}
      {!isMobile && (
        <div className={currentStyles.epHeader}>
          <div className={currentStyles.headerContent}>
            <div className={currentStyles.titleSection}>
              <h1 className={currentStyles.epTitle}>Important Questions</h1>
              <p className={currentStyles.epSubTitle}>Year 1 • Semester 2 • 1 subjects</p>
            </div>
          </div>
        </div>
      )}

      {!canAccessImportantQuestions && (
        <div
          style={{
            margin: '12px 16px',
            padding: '12px 14px',
            borderRadius: 8,
            border: '1px solid rgba(148,163,184,0.35)',
            background: isDarkMode ? 'rgba(2,6,23,0.6)' : 'rgba(241,245,249,0.6)',
            color: isDarkMode ? '#e2e8f0' : '#0f172a',
            fontSize: 14,
          }}
        >
          <span style={{fontWeight: 600}}>Important Questions is locked.</span> Purchase the relevant subject or upgrade to Pharma Pro to access predicted questions and model papers.
        </div>
      )}

      <div className={currentStyles.epLayout}>
        {/* Mobile Header - Inside epLayout */}
        {isMobile && (
          <>
            <div className={currentStyles.epHeader}>
              <div className={currentStyles.headerContent}>
                <div className={currentStyles.titleSection}>
                  <h1 className={currentStyles.epTitle}>Important Questions</h1>
                  <p className={currentStyles.epSubTitle}>Year 1 • Semester 2 • 1 subjects</p>
                </div>
              </div>
            </div>
            

          </>
        )}
        <aside className={currentStyles.epSidebar}>
          {isMobile ? (
            <>
              {/* Mobile Filter Button */}
              <button 
                className={`${currentStyles.filterToggleButton} ${isSidebarExpanded ? currentStyles.filterToggleActive : ''}`}
                onClick={() => setIsSidebarExpanded(!isSidebarExpanded)}
              >
                <span className={currentStyles.filterToggleText}>
                  {examState.selectedSubject ? examState.selectedSubject.split('(')[0].trim() : 'Select Subject'}
                </span>
                <IoChevronDown className={`${currentStyles.filterToggleIcon} ${isSidebarExpanded ? currentStyles.filterToggleIconRotated : ''}`} />
              </button>
              
              {/* Collapsible Subject List */}
              {isSidebarExpanded && (
                <div className={currentStyles.filterDropdown}>
                  <div className={currentStyles.searchBox}>
                    <input
                      className={currentStyles.sidebarSearch}
                      placeholder="Search subjects..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <div className={currentStyles.filterGroup}>
                    {allSubjects.map((s, index) => {
                      // Check if this subject has model paper available
                      const hasModelPaper = modelPaperAvailability[s] === true;
                      const isLoadingAvailability = loadingAvailability;
                      const isLocked = isSubjectLocked(s);
                      const isSelected = examState.selectedSubject === s;
                      
                      return (
                        <button
                          key={s}
                          className={`${currentStyles.filterItem} ${isSelected ? currentStyles.filterItemActive : ''} ${isLocked ? currentStyles.filterItemLocked : ''}`}
                          onClick={() => {
                            if (isLocked) {
                              return; // Don't allow selection of locked subjects
                            }
                            
                            // Set as selected subject and fetch content
                            setExamState(prev => ({ ...prev, selectedSubject: s }));
                            setExpandedSubject(s);
                            
                            // Immediately expand content when subject is clicked for better UX
                            setIsContentExpanded(true);
                            
                            // Reset and fetch questions for the new subject
                            setPredictedQuestions(null);
                            setPredictedQuestionsError(null);
                            fetchPredictedQuestions(s); // This will maintain expansion when content loads
                            
                            // Close the dropdown after selection on mobile
                            setIsSidebarExpanded(false);
                          }}
                          disabled={isLocked}
                        >
                          <div className={currentStyles.subjectButtonContent}>
                            <span className={currentStyles.subjectName}>{s.split('(')[0].trim()}</span>
                            <div className={currentStyles.subjectIndicators}>
                              {isLoadingAvailability ? (
                                <span className={currentStyles.availabilityIndicator}>⏳</span>
                              ) : hasModelPaper ? (
                                <span className={currentStyles.availabilityIndicator} title="Model paper available">📄</span>
                              ) : null}
                              {isLocked && (
                                <FaLock className={currentStyles.lockIcon} title="Subject locked - Upgrade to access" />
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* Desktop Sidebar */}
              <div className={currentStyles.sidebarTitle}>Select Subject</div>
              <div className={currentStyles.searchBox}>
                <input
                  className={currentStyles.sidebarSearch}
                  placeholder="Search subjects..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className={currentStyles.filterGroup}>
                {allSubjects.map((s) => {
                  // Check if this subject has model paper available
                  const hasModelPaper = modelPaperAvailability[s] === true;
                  const isLoadingAvailability = loadingAvailability;
                  const isLocked = isSubjectLocked(s);
                  const isSelected = examState.selectedSubject === s;
                  
                  return (
                    <button
                      key={s}
                      className={`${currentStyles.filterItem} ${isSelected ? currentStyles.filterItemActive : ''} ${isLocked ? currentStyles.filterItemLocked : ''}`}
                      onClick={() => {
                        if (isLocked) {
                          return; // Don't allow selection of locked subjects
                        }
                        
                        // Set as selected subject and fetch content
                        setExamState(prev => ({ ...prev, selectedSubject: s }));
                        setExpandedSubject(s);
                        
                        // Immediately expand content when subject is clicked for better UX
                        setIsContentExpanded(true);
                        
                        // Reset and fetch questions for the new subject
                        setPredictedQuestions(null);
                        setPredictedQuestionsError(null);
                        fetchPredictedQuestions(s); // This will maintain expansion when content loads
                      }}
                      disabled={isLocked}
                    >
                      <div className={currentStyles.subjectButtonContent}>
                        <span className={currentStyles.subjectName}>{s.split('(')[0].trim()}</span>
                        <div className={currentStyles.subjectIndicators}>
                          {isLoadingAvailability ? (
                            <span className={currentStyles.availabilityIndicator}>⏳</span>
                          ) : hasModelPaper ? (
                            <span className={currentStyles.availabilityIndicator} title="Model paper available">📄</span>
                          ) : null}
                          {isLocked && (
                            <FaLock className={currentStyles.lockIcon} title="Subject locked - Upgrade to access" />
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </aside>

        <div className={`${currentStyles.lockWrapper} ${isExamPrepLocked ? currentStyles.locked : ''}`}>
          <main className={currentStyles.epCards}>
          {/* Show trial expired message */}
          {((subscriptionStatus?.trial_expired || subscriptionStatus?.status === 'trial_expired') || 
            (allSubjects.length > 0 && subjects.length === 0)) && (
            <div className={currentStyles.trialExpiredMessage}>
              <div className={currentStyles.trialIcon}>⏳</div>
              <div>
                <div className={currentStyles.trialTitle}>Access Restricted</div>
                <div className={currentStyles.trialText}>Upgrade your plan to continue your exam preparation journey.</div>
              </div>
            </div>
          )}

          {/* Show selected subject content */}
          {examState.selectedSubject && !subscriptionStatus?.trial_expired && subjects.length > 0 && (
            <>
            <div className={currentStyles.subjectContent}>
              <div 
                className={currentStyles.subjectHeader}
                ref={subjectHeaderRef}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const el = subjectHeaderRef.current;
                  const beforeTop = el ? el.getBoundingClientRect().top : null;
                  setIsContentExpanded(prev => !prev);
                  // Desktop-only scroll compensation. On mobile, avoid adjustments to prevent jumpiness
                  if (!isMobile) {
                    // After render, measure again and compensate scroll so header visually stays in place
                    requestAnimationFrame(() => {
                      requestAnimationFrame(() => {
                        if (!el || beforeTop === null) return;
                        const afterTop = el.getBoundingClientRect().top;
                        const delta = afterTop - beforeTop; // positive if moved down
                        if (Math.abs(delta) > 1) {
                          window.scrollBy({ top: delta, left: 0, behavior: 'auto' });
                        }
                      });
                    });
                  }
                }}
                style={{ cursor: 'pointer' }}
              >
                <div className={currentStyles.subjectInfo}>
                  <div className={currentStyles.subjectIcon} style={{ backgroundColor: getSubjectMeta(examState.selectedSubject).color }}>
                    <span className={currentStyles.subjectCode}>{getSubjectMeta(examState.selectedSubject).code}</span>
                  </div>
                  <div className={currentStyles.subjectDetails}>
                    <h2 className={currentStyles.subjectTitle}>
                      {examState.selectedSubject.replace(/^([^:\n]+:\s*)/i, '').replace(/\(.*\)/, '').trim()}
                    </h2>
                    <div className={currentStyles.subjectMeta}>
                      <span className={`${currentStyles.priorityBadge} ${currentStyles.highPriority}`}>High Priority</span>
                      <span className={currentStyles.metaText}>3 Hours • 75 marks</span>
                    </div>
                  </div>
                  <div className={`${currentStyles.cardCaret}`}>
                    {isContentExpanded ? (
                      <IoChevronDown className="w-4 h-4" />
                    ) : (
                      <IoChevronForward className="w-4 h-4" />
                    )}
                  </div>
                </div>
              </div>
              {isContentExpanded && (
                <>
                  {/* Show database content or "No model paper" message */}
                  {loadingPredictedQuestions ? (
                    <SubjectDetailsSkeleton isMobile={isMobile} />
                  ) : predictedQuestionsError ? (
                    <div className={currentStyles.errorState}>
                      <p>{predictedQuestionsError}</p>
                    </div>
                  ) : predictedQuestions?.predicted_questions?.length > 0 ? (
                    <div className={currentStyles.fadeIn}>
                      <h2 className={currentStyles.predictedQuestionsTitle}>
                        <span className={currentStyles.predictedTrophy}>🏆</span>
                        Important Questions ({predictedQuestions.total_questions})
                      </h2>
                      <div className={currentStyles.predictedQuestionsList}>
                        {predictedQuestions.predicted_questions.map((q, idx) => (
                          <div key={idx} className={currentStyles.predictedQuestionRow}>
                            <span className={currentStyles.predictedQuestionIndex}>{idx + 1}.</span>
                            <span className={currentStyles.predictedQuestionText}>{q.question}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className={currentStyles.noModelPaper}>
                      <div className={currentStyles.noModelPaperIcon}>📄</div>
                      <h3>No Model Paper Available</h3>
                      <p>No predicted questions found for <strong>{examState.selectedSubject.split('(')[0].trim()}</strong>.</p>
                      <p>Model papers are generated based on:</p>
                      <ul>
                        <li>Subject syllabus and curriculum</li>
                        <li>Previous year question patterns</li>
                        <li>AI analysis of course content</li>
                      </ul>
                      <p>Check back later or contact your instructor for more information.</p>
                      <div className={currentStyles.availabilityInfo}>
                        <p><strong>Database Status:</strong> No model paper record found in database for this subject, year, and semester combination.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
            </>
          )}

          {/* Show message when no subject is selected */}
          {!examState.selectedSubject && !subscriptionStatus?.trial_expired && subscriptionStatus?.status !== 'trial_expired' && (
            <div className={currentStyles.noSubjectSelected}>
              <div className={currentStyles.noSubjectIcon}>📚</div>
              <h3>Select a Subject</h3>
              <p>Choose a subject from the dropdown above to view Important Questions content.</p>
            </div>
          )}
          </main>
          {isExamPrepLocked && (
            <div className={currentStyles.lockOverlay}>
              <div className={currentStyles.lockOverlayCard}>
                <div className={currentStyles.lockOverlayTitle}>Unlock Important Questions</div>
                <div className={currentStyles.lockOverlayBody}>
                  Purchase this subject or upgrade your plan to view predicted questions and model papers.
                </div>
                <Link href="/upgrade" className={currentStyles.upgradeButton}>
                  Upgrade Now
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>



    </div>
  );
}

