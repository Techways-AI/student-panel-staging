import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { quizAPI, studentContentAPI } from '../lib/api';
import { useQuizCompletion } from './useQuizCompletion';

/**
 * Custom hook to handle all quiz-related functionality in CourseContent
 * Extracted to reduce CourseContent.js file size
 * Includes quiz generation logic from content_library documents (merged from useQuizGeneration)
 */
export const useQuizHandlers = ({
  // Dependencies from CourseContent
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
  getNextTopicForward,
  getNextUncompletedTopic,
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
}) => {
  // Quiz generation state (merged from useQuizGeneration)
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [quizError, setQuizError] = useState(null);
  const [quizQuestions, setQuizQuestions] = useState([]);
  const [quizMetadata, setQuizMetadata] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [quizScore, setQuizScore] = useState(null);

  // Derive subject/year/semester for completion API
  const yearSemesterStr = subject?.yearSemester || courseData?.yearSemester || '';
  const [derivedYear, derivedSemester] = useMemo(() => {
    const parts = String(yearSemesterStr || '').replace('_', '-').split('-');
    const year = parseInt(parts[0], 10) || null;
    const semester = parseInt(parts[1], 10) || null;
    return [year, semester];
  }, [yearSemesterStr]);

  const subjectNameForCompletion = useMemo(() => {
    const candidates = [
      subject?.fullTitle,
      subject?.title,
      subject?.name,
      courseData?.title,
    ].filter(Boolean);
    const first = candidates.find((c) => typeof c === 'string' && c.trim().length > 0);
    return cleanSubjectName(first || 'Unknown Subject');
  }, [subject, courseData, cleanSubjectName]);

  // Completion state (single source of truth from backend)
  const {
    completedTopics,
    loading: completionLoading,
    loaded: completionLoaded,
    fetchCompletion,
    markCompletedLocal,
    setCompletedTopicsFromAPI,
  } = useQuizCompletion({
    subject: subjectNameForCompletion,
    year: derivedYear,
    semester: derivedSemester,
  });

  // Derived map keyed by unit-topic for UI compatibility
  const topicCompletionStatus = useMemo(() => {
    const status = {};
    if (courseData?.units) {
      courseData.units.forEach((unit, unitIdx) => {
        unit.topics?.forEach((topic, topicIdx) => {
          const key = `${unitIdx}-${topicIdx}`;
          status[key] = completedTopics.has(topic.title) ? true : false;
        });
      });
    }
    return status;
  }, [courseData, completedTopics]);

  const completionCheckComplete = completionLoaded && !completionLoading;

  // Quiz UI state
  const [quizIndex, setQuizIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showQuizResults, setShowQuizResults] = useState(false);
  const [showCompletedQuizModal, setShowCompletedQuizModal] = useState(false);

  /**
   * Generate quiz for a topic by:
   * 1. Getting document from content_library (file_type='document')
   * 2. Extracting s3_key from the document
   * 3. Generating quiz from that document using generateFromFile
   */
  const generateQuizForTopic = useCallback(async (topicName, subject, unit) => {
    if (!topicName) {
      setQuizError('Topic name is required');
      return;
    }

    setIsQuizLoading(true);
    setQuizError(null);
    setQuizQuestions([]);
    setQuizMetadata(null);
    setQuizCompleted(false);
    setQuizScore(null);

    try {
      console.log(`📚 Generating quiz for topic: ${topicName}`);

      // Step 1: Check if quiz is already completed
      const completionParams = {
        subject: subject?.fullTitle || subject?.title || subject?.name || '',
        unit: unit?.title || '',
        topic: topicName
      };

      try {
        const completionCheck = await quizAPI.checkCompleted(completionParams);
        if (completionCheck?.completed) {
          console.log('✅ Quiz already completed, showing previous results');
          setQuizCompleted(true);
          setQuizScore(completionCheck.score ?? null);
          setQuizMetadata({
            subject: completionParams.subject,
            unit: completionParams.unit,
            topic: topicName,
            existingQuiz: true,
            previousScore: completionCheck.score ?? null,
            totalQuestions: completionCheck.total_questions ?? completionCheck.questions_count ?? completionCheck.total ?? null,
            completedAt: completionCheck.completed_at ?? completionCheck.timestamp ?? null
          });
          setIsQuizLoading(false);
          return;
        }
      } catch (checkErr) {
        console.warn('⚠️ Quiz completion check failed, proceeding to generate quiz:', checkErr);
      }

      // Step 2: Get document from content_library
      // Try 'document' first, then fallback to 'notes' (which also includes documents)
      console.log(`🔍 Fetching document from content_library for topic: ${topicName}`);
      let documentContent = await studentContentAPI.getTopicContent(topicName, 'document');

      // If no document found with file_type='document', try 'notes' (which includes documents)
      if (!documentContent || !documentContent.items || documentContent.items.length === 0) {
        console.log(`⚠️ No document found with file_type='document', trying 'notes'...`);
        documentContent = await studentContentAPI.getTopicContent(topicName, 'notes');
      }

      if (!documentContent || !documentContent.items || documentContent.items.length === 0) {
        throw new Error('No document found in content_library for this topic. Please ensure a document exists for this topic.');
      }

      // Find the first item that has an s3_key (prefer PDFs/DOCX over markdown files for quiz generation)
      let documentItem = null;
      for (const item of documentContent.items) {
        if (item.s3_key) {
          // Prefer PDF or DOCX files over markdown files for quiz generation
          const s3Key = item.s3_key.toLowerCase();
          if (s3Key.endsWith('.pdf') || s3Key.endsWith('.docx') || s3Key.endsWith('.doc')) {
            documentItem = item;
            break;
          }
          // If no PDF/DOCX found, use the first item with s3_key
          if (!documentItem) {
            documentItem = item;
          }
        }
      }

      if (!documentItem || !documentItem.s3_key) {
        throw new Error('Document found but s3_key is missing. Cannot generate quiz.');
      }

      const s3Key = documentItem.s3_key;

      if (!s3Key) {
        throw new Error('Document found but s3_key is missing. Cannot generate quiz.');
      }

      console.log(`📄 Found document with s3_key: ${s3Key}`);

      // Step 3: Generate quiz from the document using generateFromFile
      console.log(`🎯 Generating quiz from document...`);
      const quizResponse = await quizAPI.generateFromFile(s3Key);

      if (!quizResponse) {
        throw new Error('Failed to generate quiz - no response from server');
      }

      // Handle existing quiz response
      if (quizResponse.existing_quiz) {
        console.log('✅ Quiz already exists, showing previous results');
        setQuizCompleted(true);
        setQuizScore(quizResponse.previous_score ?? null);
        
        // IMPORTANT: Do NOT use quizResponse.subject/unit/topic - they are extracted incorrectly from s3_key path
        // Always use the correct values from the function parameters (completionParams)
        setQuizMetadata({
          subject: completionParams.subject,  // Use correct subject from context
          unit: completionParams.unit,         // Use correct unit from context
          topic: topicName,                   // Use correct topic from parameter
          existingQuiz: true,
          previousScore: quizResponse.previous_score ?? null,
          quizId: quizResponse.quiz_id
        });
        setQuizQuestions(quizResponse.questions || []);
        setIsQuizLoading(false);
        return;
      }

      // Handle new quiz response
      if (quizResponse.questions && Array.isArray(quizResponse.questions) && quizResponse.questions.length > 0) {
        console.log(`✅ Quiz generated successfully with ${quizResponse.questions.length} questions`);
        setQuizQuestions(quizResponse.questions);
        
        // IMPORTANT: Do NOT use quizResponse.subject/unit/topic - they are extracted incorrectly from s3_key path
        // Always use the correct values from the function parameters (completionParams)
        // Only store quizId from response, ignore subject/unit/topic from backend
        setQuizMetadata({
          subject: completionParams.subject,  // Use correct subject from context
          unit: completionParams.unit,         // Use correct unit from context
          topic: topicName,                    // Use correct topic from parameter
          quizId: quizResponse.quiz_id,
          existingQuiz: false
        });
        console.log('📝 Quiz metadata set with correct values:', {
          subject: completionParams.subject,
          unit: completionParams.unit,
          topic: topicName,
          'Backend returned (IGNORED)': {
            subject: quizResponse.subject,
            unit: quizResponse.unit,
            topic: quizResponse.topic
          }
        });
        setQuizCompleted(false);
      } else {
        throw new Error('Quiz generated but no questions received');
      }

    } catch (err) {
      console.error('❌ Error generating quiz:', err);
      setQuizError(err.message || 'Failed to generate quiz. Please try again.');
      setQuizQuestions([]);
      setQuizMetadata(null);
    } finally {
      setIsQuizLoading(false);
    }
  }, []);

  /**
   * Reset quiz state
   * @param {Object} options - Reset options
   * @param {boolean} options.preserveCompletion - If true, preserve quizCompleted and quizScore
   */
  const resetQuiz = useCallback((options = {}) => {
    setQuizQuestions([]);
    setQuizMetadata(null);
    setQuizError(null);
    setIsQuizLoading(false);
    
    // Only reset completion status if not preserving it
    if (!options.preserveCompletion) {
      setQuizCompleted(false);
      setQuizScore(null);
    }
  }, []);

  // ---- Topic completion logic (moved from CourseContent) ----

  // Sync helper to check if topic is completed
  const isTopicCompleted = useCallback((unitIndex, topicIndex) => {
    const topicKey = `${unitIndex}-${topicIndex}`;
    const status = topicCompletionStatus[topicKey];
    if (status === true) return true;
    if (status === false) return false;

    // Immediate UI feedback: if local progress says quizCompleted for this topic, treat as completed
    const local = getCurrentTopicProgress()?.[topicKey];
    if (local?.quizCompleted === true) {
      return true;
    }

    // If we don't know yet, treat as incomplete until the next fetch resolves
    return false;
  }, [topicCompletionStatus, getCurrentTopicProgress]);

  // Force refresh completion status for current topic
  const forceRefreshCompletion = useCallback(async () => {
    try {
      await fetchCompletion();
    } catch {
      // ignore; UI will retry on next interaction
    }
    return false;
  }, [fetchCompletion]);

  // Fetch completion status once per subject load
  useEffect(() => {
    fetchCompletion();
  }, [fetchCompletion]);

  // Compute last index of contiguous completed topics per unit (mobile)
  const getSequentialCompletionEnd = useCallback((unitIdx) => {
    try {
      if (!courseData?.units?.[unitIdx]?.topics?.length) return -1;
      const topics = courseData.units[unitIdx].topics;
      let last = -1;
      for (let i = 0; i < topics.length; i++) {
        const key = `${unitIdx}-${i}`;
        const cached = topicCompletionStatus[key];
        const meta = topics[i];
        const metaDone = !!(meta?.isCompleted || meta?.completed || meta?.is_completed);
        const isDone = cached === true || metaDone;
        if (isDone) {
          last = i;
        } else {
          break;
        }
      }
      return last;
    } catch {
      return -1;
    }
  }, [courseData, topicCompletionStatus]);

  // Get next uncompleted topic
  const getNextUncompletedTopicHook = useCallback(() => {
    if (!courseData) return null;
    const getStatus = (u, t) => topicCompletionStatus[`${u}-${t}`];
    
    if (selectedUnit !== null && selectedTopic !== null) {
      for (let u = selectedUnit; u < courseData.units.length; u++) {
        const unit = courseData.units[u];
        const startT = (u === selectedUnit) ? selectedTopic : 0;
        for (let t = startT; t < unit.topics.length; t++) {
          const st = getStatus(u, t);
          if (st === false) {
            return { unitIndex: u, topicIndex: t };
          }
        }
      }
    }
    
    for (let u = 0; u < courseData.units.length; u++) {
      const unit = courseData.units[u];
      for (let t = 0; t < unit.topics.length; t++) {
        const st = getStatus(u, t);
        if (st === false) {
          return { unitIndex: u, topicIndex: t };
        }
      }
    }
    return null;
  }, [courseData, topicCompletionStatus, selectedUnit, selectedTopic]);

  // Helper: next topic forward (prefers topics not yet completed; treats undefined as candidate)
  const getNextTopicForwardHook = useCallback(() => {
    if (!courseData || selectedUnit === null || selectedTopic === null) return null;
    for (let u = selectedUnit; u < courseData.units.length; u++) {
      const unit = courseData.units[u];
      const startT = (u === selectedUnit) ? selectedTopic + 1 : 0;
      for (let t = startT; t < unit.topics.length; t++) {
        const st = topicCompletionStatus[`${u}-${t}`];
        if (st !== true) {
          return { unitIndex: u, topicIndex: t };
        }
      }
    }
    return null;
  }, [courseData, selectedUnit, selectedTopic, topicCompletionStatus]);

  // Helper: latest completed topic
  const getLatestCompletedTopic = useCallback(() => {
    if (!courseData) return null;
    
    let latestCompleted = null;
    for (let u = 0; u < courseData.units.length; u++) {
      const unit = courseData.units[u];
      if (unit && unit.topics) {
        for (let t = 0; t < unit.topics.length; t++) {
          const key = `${u}-${t}`;
          const meta = unit.topics[t];
          const metaDone = !!(meta?.isCompleted || meta?.completed || meta?.is_completed);
          if (topicCompletionStatus[key] === true || metaDone) {
            latestCompleted = { unitIndex: u, topicIndex: t };
          }
        }
      }
    }
    return latestCompleted;
  }, [courseData, topicCompletionStatus]);

  // Reset quiz state when topic changes
  // Use topic title as dependency to avoid TDZ issues with currentTopic object
  const currentTopicTitle = currentTopic?.title || null;
  useEffect(() => {
    resetQuiz({ preserveCompletion: true });
    setQuizIndex(0);
    setSelectedOption(null);
  }, [currentTopicTitle, resetQuiz]);

  /**
   * Fetch quiz for a specific topic
   */
  const fetchQuizForTopic = useCallback(async (unitIdx, topicIdx) => {
    if (!courseData || !subject) return;
    
    const unit = courseData.units[unitIdx];
    const topic = unit?.topics[topicIdx];
    
    if (!topic) {
      console.error('Topic not found');
      return;
    }
    
    // Generate quiz from content_library document
    await generateQuizForTopic(topic.title, subject, unit);
  }, [courseData, subject, generateQuizForTopic]);

  /**
   * Handle quiz submission
   */
  const handleQuizSubmit = useCallback(async (userAnswers, score) => {
    if (!currentTopic || !subject) return;

    try {
      // Extract subject: ALWAYS use courseData.title as primary source (most reliable)
      // IMPORTANT: Exclude yearSemester (like "2_1") from being used as subject name
      const yearSemesterStr = subject?.yearSemester || '';
      
      // PRIMARY: Use courseData.title - this is the most reliable source from backend curriculum
      let rawSubject = '';
      if (courseData?.title && 
          courseData.title !== yearSemesterStr && 
          !/^\d+[_-]\d+$/.test(courseData.title) &&
          /[a-zA-Z]/.test(courseData.title)) {
        rawSubject = courseData.title;
        console.log('✅ Using courseData.title as subject:', rawSubject);
      } else {
        // FALLBACK: Try subject object properties
        const subjectCandidates = [
          subject?.fullTitle,
          subject?.title,
          subject?.name,
          subject?.code && subject?.name ? `${subject.code}: ${subject.name}` : null
        ].filter(Boolean);
        
        for (const candidate of subjectCandidates) {
          const normalizedCandidate = String(candidate).trim();
          
          // Skip if it matches yearSemester pattern
          if (normalizedCandidate === yearSemesterStr || 
              normalizedCandidate === yearSemesterStr.replace('_', '-') ||
              /^\d+[_-]\d+$/.test(normalizedCandidate)) {
            continue;
          }
          
          // If it's a valid subject name (has letters)
          if (normalizedCandidate.length > 0 && /[a-zA-Z]/.test(normalizedCandidate)) {
            rawSubject = normalizedCandidate;
            console.log('✅ Using fallback subject from subject object:', rawSubject);
            break;
          }
        }
      }
      
      // FINAL SAFETY: If still empty or matches yearSemester, throw error
      if (!rawSubject || rawSubject === yearSemesterStr || /^\d+[_-]\d+$/.test(rawSubject)) {
        console.error('❌ CRITICAL: Could not extract valid subject name!', {
          courseDataTitle: courseData?.title,
          subjectFullTitle: subject?.fullTitle,
          subjectTitle: subject?.title,
          subjectName: subject?.name,
          subjectCode: subject?.code,
          yearSemester: yearSemesterStr,
          fullSubject: subject,
          fullCourseData: courseData
        });
        throw new Error(`Cannot extract valid subject name. CourseData title: ${courseData?.title}, Subject title: ${subject?.title}, YearSemester: ${yearSemesterStr}`);
      }
      
      const correctSubject = cleanSubjectName(rawSubject);
      console.log('📝 Final extracted subject:', {
        raw: rawSubject,
        cleaned: correctSubject,
        yearSemester: yearSemesterStr
      });
      
      // Extract unit: From currentUnit.title
      const correctUnit = currentUnit?.title || currentUnit?.name || '';
      
      // Extract topic: From currentTopic.title (or topicName as fallback)
      const correctTopic = currentTopic?.title || currentTopic?.topicName || '';
      
      // Extract year and semester from yearSemester format (e.g., "2-1" or "2_1")
      const yearSemesterParts = yearSemesterStr.replace('_', '-').split('-');
      const year = parseInt(yearSemesterParts[0]) || 1;
      const semester = parseInt(yearSemesterParts[1]) || 1;
      
      // Final validation: Ensure we never send yearSemester as subject
      let finalSubject = correctSubject;
      if (!finalSubject || finalSubject === yearSemesterStr || /^\d+[_-]\d+$/.test(finalSubject)) {
        // Use courseData.title as fallback and clean it
        const fallbackSubject = courseData?.title || 'Unknown Subject';
        finalSubject = cleanSubjectName(fallbackSubject);
      }
      
      const finalUnit = correctUnit || 'Unknown Unit';
      const finalTopic = correctTopic || 'Unknown Topic';
      
      // Validate that we have valid values before sending
      if (finalSubject === yearSemesterStr || /^\d+[_-]\d+$/.test(finalSubject)) {
        console.error('❌ CRITICAL: Subject is still yearSemester! Aborting quiz submission.', {
          finalSubject,
          yearSemesterStr,
          subjectObject: subject,
          courseDataTitle: courseData?.title
        });
        throw new Error('Invalid subject name extracted. Please refresh the page and try again.');
      }
      
      const scoreRequest = {
        questions: quizQuestions,
        user_answers: userAnswers,
        year: year,
        semester: semester,
        subject: finalSubject,
        unit: finalUnit,
        topic: finalTopic
      };
      
      console.log('📝 Quiz Submission - Extracted Values:', {
        'Raw Subject': rawSubject,
        'Cleaned Subject': correctSubject,
        'Final Subject': finalSubject,
        'Unit': finalUnit,
        'Topic': finalTopic,
        'Year': year,
        'Semester': semester,
        'YearSemester String': yearSemesterStr,
        'Subject Object': {
          fullTitle: subject?.fullTitle,
          title: subject?.title,
          name: subject?.name,
          code: subject?.code,
          yearSemester: subject?.yearSemester
        },
        'Course Data Title': courseData?.title,
        'Current Unit': {
          title: currentUnit?.title,
          name: currentUnit?.name
        },
        'Current Topic': {
          title: currentTopic?.title,
          topicName: currentTopic?.topicName
        }
      });
      
      // Log exactly what will be sent to backend
      console.log('🚀 Sending to backend:', {
        subject: scoreRequest.subject,
        unit: scoreRequest.unit,
        topic: scoreRequest.topic,
        year: scoreRequest.year,
        semester: scoreRequest.semester
      });
      
      let response;
      try {
        response = await quizAPI.submitQuiz(scoreRequest);
      } catch (submitErr) {
        console.warn('⚠️ submitQuiz unavailable, falling back to score:', submitErr);
        response = await quizAPI.score(scoreRequest);
      }
      
      if (response) {
        setQuizScore(response.score);
        setQuizCompleted(true);
        // Local step progress for UI
        updateTopicProgress('quizCompleted', true);
        
        // Instant UI checkmark + DB truth
        markCompletedLocal(correctTopic);

        if (response?.completedTopics) {
          setCompletedTopicsFromAPI(response.completedTopics);
        } else if (response?.completed_topics) {
          setCompletedTopicsFromAPI(response.completed_topics);
        } else {
          // Re-sync from backend to keep single source of truth
          await fetchCompletion();
        }

        // Refresh course data to update completion status and checkmarks
        if (onRefreshCourseData) {
          try {
            await onRefreshCourseData();
          } catch (refreshError) {
            console.warn('Could not refresh course data:', refreshError);
          }
        }
        
        // Trigger quiz results animation with a slight delay
        setTimeout(() => {
          setShowQuizResults(true);
        }, 100);
      }
    } catch (error) {
      console.error('Error submitting quiz score:', error);
      // Still mark as completed even if score submission fails
      setQuizScore(score);
      setQuizCompleted(true);
      // Local step progress for UI
      updateTopicProgress('quizCompleted', true);
      
      // Ensure completion status is updated even in error case
      markCompletedLocal(currentTopic?.title);
      console.log('✅ Updated topicCompletionStatus (error case):', { topic: currentTopic?.title });
      
      // Trigger quiz results animation with a slight delay
      setTimeout(() => {
        setShowQuizResults(true);
      }, 100);
      
      // Try to refresh completion status after a delay
      setTimeout(async () => {
        try {
          await fetchCompletion();
        } catch (refreshError) {
          console.warn('Could not force refresh completion:', refreshError);
        }
      }, 500);
    }
  }, [
    currentTopic,
    subject,
    courseData,
    currentUnit,
    cleanSubjectName,
    quizQuestions,
    selectedUnit,
    selectedTopic,
    setQuizScore,
    setQuizCompleted,
    updateTopicProgress,
    markCompletedLocal,
    fetchCompletion,
    setCompletedTopicsFromAPI,
    onRefreshCourseData
  ]);

  /**
   * Handle navigation after quiz completion
   */
  const handleQuizCompletionNavigation = useCallback(() => {
    if (!courseData || !courseData.units || selectedUnit < 0) {
      console.warn('Cannot proceed with quiz completion navigation: missing course data or invalid selectedUnit');
      return;
    }
    // Set flag to prevent auto-selection effect from interfering
    setIsNavigatingAfterQuiz(true);
    
    // Mark current topic as completed in completion status
    const currentTopicKey = `${selectedUnit}-${selectedTopic}`;
    const currentTitle = courseData?.units?.[selectedUnit]?.topics?.[selectedTopic]?.title;
    if (currentTitle) {
      markCompletedLocal(currentTitle);
    }
    
    // Prefer the next forward topic that is not explicitly completed (unknown or false)
    let nextTopic = getNextTopicForward?.();
    // Fallback to previous logic if nothing forward is available
    if (!nextTopic) {
      nextTopic = getNextUncompletedTopic?.();
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
      }
    }
    
    // Clear the navigation flag after a short delay
    setTimeout(() => {
      setIsNavigatingAfterQuiz(false);
    }, 1000);
  }, [
    courseData,
    selectedUnit,
    selectedTopic,
    getNextUncompletedTopic,
    getNextTopicForward,
    markCompletedLocal,
    isMobile,
    preventAutoOpenOnMobile,
    preventAutoExpand,
    setIsNavigatingAfterQuiz,
    setSelectedUnit,
    setSelectedTopic,
    setActiveTab,
    setMobileExpandedUnit,
    setDesktopExpandedUnit,
    fetchDocumentForTopic
  ]);

  // Aliases for compatibility with CourseContent.js
  const generateQuizFromHook = generateQuizForTopic;
  const resetQuizFromHook = resetQuiz;

  return {
    // Quiz generation state
    isQuizLoading,
    quizError,
    quizQuestions,
    quizMetadata,
    quizCompleted,
    quizScore,
    generateQuizForTopic,
    generateQuizFromHook, // Alias for compatibility
    resetQuiz,
    resetQuizFromHook, // Alias for compatibility
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
    // Completion state/helpers exposed to CourseContent
    topicCompletionStatus,
    completionCheckComplete,
    isTopicCompleted,
    forceRefreshCompletion,
    markCompletedLocal,
    fetchCompletion,
    getSequentialCompletionEnd,
    getNextUncompletedTopic: getNextUncompletedTopicHook,
    getNextTopicForward: getNextTopicForwardHook,
    getLatestCompletedTopic
  };
};
