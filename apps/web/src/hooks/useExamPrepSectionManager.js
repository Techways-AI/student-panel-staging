import { useEffect, useState, useCallback } from 'react';

/**
 * Custom hook for managing Important Questions section persistence
 * @param {string} sectionId - Current section ID
 * @param {object} examState - Current exam state (selectedYear, selectedSemester, selectedSubject, selectedTopicIdx)
 * @param {function} setExamState - Function to set exam state
 * @param {array} performanceData - Current performance data
 * @param {function} setPerformanceData - Function to set performance data
 * @param {array} quizSearchData - Current quiz search data
 * @param {function} setQuizSearchData - Function to set quiz search data
 * @param {array} predictedQuestions - Current predicted questions
 * @param {function} setPredictedQuestions - Function to set predicted questions
 * @param {boolean} enabled - Whether to enable section management
 */
export function useImportantQuestionsSectionManager(
  sectionId,
  examState,
  setExamState,
  performanceData,
  setPerformanceData,
  quizSearchData,
  setQuizSearchData,
  predictedQuestions,
  setPredictedQuestions,
  enabled = true
) {
  const [isRestored, setIsRestored] = useState(false);

  // Debug: Log hook initialization
  useEffect(() => {
    console.log('🔧 useImportantQuestionsSectionManager initialized:');
    console.log('- sectionId:', sectionId);
    console.log('- enabled:', enabled);
    console.log('- examState:', examState);
    console.log('- performanceData:', performanceData ? 'Present' : 'Not present');
    console.log('- quizSearchData:', quizSearchData ? 'Present' : 'Not present');
    console.log('- predictedQuestions:', predictedQuestions ? 'Present' : 'Not present');
  }, []);

  // Debug: Log when dependencies change
  useEffect(() => {
    console.log('🔄 useImportantQuestionsSectionManager dependencies changed:');
    console.log('- sectionId:', sectionId);
    console.log('- examState changed:', examState);
    console.log('- performanceData changed:', performanceData ? 'Present' : 'Not present');
    console.log('- quizSearchData changed:', quizSearchData ? 'Present' : 'Not present');
    console.log('- predictedQuestions changed:', predictedQuestions ? 'Present' : 'Not present');
  }, [sectionId, examState, performanceData, quizSearchData, predictedQuestions]);

  // Save current section and exam state
  useEffect(() => {
    if (!enabled || !sectionId) {
      console.log('⚠️ Section management disabled or no sectionId');
      return;
    }

    // Check if localStorage is available
    if (typeof window === 'undefined') {
      console.log('⚠️ localStorage not available (server-side rendering)');
      return;
    }

    try {
      // Test localStorage availability
      const testKey = 'test_storage';
      localStorage.setItem(testKey, 'test');
      localStorage.removeItem(testKey);
    } catch (error) {
      console.error('❌ localStorage is not available or disabled:', error);
      return;
    }

    console.log('💾 Attempting to save section data...');
    console.log('- sectionId:', sectionId);
    console.log('- examState:', examState);
    console.log('- performanceData:', performanceData ? 'Present' : 'Not present');
    console.log('- quizSearchData:', quizSearchData ? 'Present' : 'Not present');
    console.log('- predictedQuestions:', predictedQuestions ? 'Present' : 'Not present');

    // Save current section
    try {
      localStorage.setItem("current_section_id", sectionId);
    } catch (error) {
      console.error('❌ Error saving current section ID:', error);
    }
    
    // Save exam state with debouncing to avoid too frequent saves
    if (examState && Object.keys(examState).length > 0) {
      try {
        const examStateString = JSON.stringify(examState);
        localStorage.setItem(`${sectionId}_exam_state`, examStateString);
        console.log('✅ Saved exam state:', examState);
      } catch (error) {
        console.error('❌ Error saving exam state:', error);
        // Try to clear some space
        try {
          const keys = Object.keys(localStorage);
          const oldKeys = keys.filter(key => key.includes('important-questions-main') && key !== `${sectionId}_exam_state`);
          if (oldKeys.length > 0) {
            localStorage.removeItem(oldKeys[0]);
            console.log('🗑️ Cleared old key to make space:', oldKeys[0]);
            // Retry saving
            localStorage.setItem(`${sectionId}_exam_state`, JSON.stringify(examState));
            console.log('✅ Retry successful');
          }
        } catch (retryError) {
          console.error('❌ Retry failed:', retryError);
        }
      }
    } else {
      console.log('💾 No exam state to save (empty or null)');
    }
    
    // Save performance data if available
    if (performanceData) {
      try {
        const performanceString = JSON.stringify(performanceData);
        localStorage.setItem(`${sectionId}_performance_data`, performanceString);
        console.log('✅ Saved performance data');
      } catch (error) {
        console.error('❌ Error saving performance data:', error);
      }
    }
    
    // Save quiz search data if available
    if (quizSearchData) {
      try {
        const quizSearchString = JSON.stringify(quizSearchData);
        localStorage.setItem(`${sectionId}_quiz_search_data`, quizSearchString);
        console.log('✅ Saved quiz search data');
      } catch (error) {
        console.error('❌ Error saving quiz search data:', error);
      }
    }
    
    // Save predicted questions if available
    if (predictedQuestions) {
      try {
        const predictedQuestionsString = JSON.stringify(predictedQuestions);
        localStorage.setItem(`${sectionId}_predicted_questions`, predictedQuestionsString);
        console.log('✅ Saved predicted questions');
      } catch (error) {
        console.error('❌ Error saving predicted questions:', error);
      }
    }
  }, [sectionId, examState, performanceData, quizSearchData, predictedQuestions, enabled]);

  // Restore exam state on mount
  useEffect(() => {
    if (!enabled || !sectionId) return;

    // Check if localStorage is available
    if (typeof window === 'undefined') {
      console.log('⚠️ localStorage not available (server-side rendering)');
      return;
    }

    // Add a small delay to ensure component is fully mounted
    const restoreTimeout = setTimeout(() => {
      console.log('🔍 Starting restoration process...');
      
      const savedExamState = localStorage.getItem(`${sectionId}_exam_state`);
      const savedPerformanceData = localStorage.getItem(`${sectionId}_performance_data`);
      const savedQuizSearchData = localStorage.getItem(`${sectionId}_quiz_search_data`);
      const savedPredictedQuestions = localStorage.getItem(`${sectionId}_predicted_questions`);
      
      console.log('🔍 Checking for saved Important Questions data...');
      console.log('- Saved exam state:', savedExamState ? 'Found' : 'Not found');
      console.log('- Saved performance data:', savedPerformanceData ? 'Found' : 'Not found');
      console.log('- Saved quiz search data:', savedQuizSearchData ? 'Found' : 'Not found');
      console.log('- Saved predicted questions:', savedPredictedQuestions ? 'Found' : 'Not found');
      
      let hasRestoredData = false;
      
      if (savedExamState) {
        try {
          const parsedExamState = JSON.parse(savedExamState);
          
          // Validate the parsed data structure
          if (parsedExamState && typeof parsedExamState === 'object') {
            const requiredFields = ['selectedYear', 'selectedSemester', 'selectedSubject', 'selectedTopicIdx'];
            const hasAllFields = requiredFields.every(field => field in parsedExamState);
            
            if (hasAllFields) {
              console.log('✅ Valid exam state found, restoring:', parsedExamState);
              setExamState(parsedExamState);
              hasRestoredData = true;
            } else {
              console.warn('⚠️ Invalid exam state structure, missing fields:', requiredFields.filter(field => !(field in parsedExamState)));
              // Clear invalid data
              localStorage.removeItem(`${sectionId}_exam_state`);
            }
          } else {
            console.warn('⚠️ Invalid exam state format, not an object');
            localStorage.removeItem(`${sectionId}_exam_state`);
          }
        } catch (error) {
          console.error('❌ Error parsing saved exam state:', error);
          console.log('🗑️ Clearing corrupted exam state data');
          localStorage.removeItem(`${sectionId}_exam_state`);
        }
      } else {
        console.log('📝 No saved exam state found, will initialize fresh');
      }
      
      if (savedPerformanceData) {
        try {
          const parsedPerformanceData = JSON.parse(savedPerformanceData);
          if (parsedPerformanceData && typeof parsedPerformanceData === 'object') {
            console.log('✅ Valid performance data found, restoring');
            setPerformanceData(parsedPerformanceData);
            hasRestoredData = true;
          } else {
            console.warn('⚠️ Invalid performance data format');
            localStorage.removeItem(`${sectionId}_performance_data`);
          }
        } catch (error) {
          console.error('❌ Error parsing saved performance data:', error);
          localStorage.removeItem(`${sectionId}_performance_data`);
        }
      }
      
      if (savedQuizSearchData) {
        try {
          const parsedQuizSearchData = JSON.parse(savedQuizSearchData);
          if (parsedQuizSearchData && typeof parsedQuizSearchData === 'object') {
            console.log('✅ Valid quiz search data found, restoring');
            setQuizSearchData(parsedQuizSearchData);
            hasRestoredData = true;
          } else {
            console.warn('⚠️ Invalid quiz search data format');
            localStorage.removeItem(`${sectionId}_quiz_search_data`);
          }
        } catch (error) {
          console.error('❌ Error parsing saved quiz search data:', error);
          localStorage.removeItem(`${sectionId}_quiz_search_data`);
        }
      }
      
      if (savedPredictedQuestions) {
        try {
          const parsedPredictedQuestions = JSON.parse(savedPredictedQuestions);
          if (parsedPredictedQuestions && typeof parsedPredictedQuestions === 'object') {
            console.log('✅ Valid predicted questions found, restoring');
            setPredictedQuestions(parsedPredictedQuestions);
            hasRestoredData = true;
          } else {
            console.warn('⚠️ Invalid predicted questions format');
            localStorage.removeItem(`${sectionId}_predicted_questions`);
          }
        } catch (error) {
          console.error('❌ Error parsing saved predicted questions:', error);
          localStorage.removeItem(`${sectionId}_predicted_questions`);
        }
      }
      
      // Set isRestored to true if we found any saved data
      if (hasRestoredData) {
        console.log('✅ Setting isRestored to true');
        setIsRestored(true);
      } else {
        console.log('❌ No data restored, keeping isRestored false');
      }
    }, 100); // Small delay to ensure component is ready

    return () => clearTimeout(restoreTimeout);
  }, [sectionId, enabled, setExamState, setPerformanceData, setQuizSearchData, setPredictedQuestions]);

  // Get saved section info
  const getSavedSection = useCallback(() => {
    if (typeof window === 'undefined') return null;
    
    try {
      const savedExamState = localStorage.getItem(`${sectionId}_exam_state`);
      const savedPerformanceData = localStorage.getItem(`${sectionId}_performance_data`);
      const savedQuizSearchData = localStorage.getItem(`${sectionId}_quiz_search_data`);
      const savedPredictedQuestions = localStorage.getItem(`${sectionId}_predicted_questions`);
      
      return {
        sectionId: localStorage.getItem("current_section_id"),
        examState: savedExamState ? JSON.parse(savedExamState) : null,
        performanceData: savedPerformanceData ? JSON.parse(savedPerformanceData) : null,
        quizSearchData: savedQuizSearchData ? JSON.parse(savedQuizSearchData) : null,
        predictedQuestions: savedPredictedQuestions ? JSON.parse(savedPredictedQuestions) : null
      };
    } catch (error) {
      console.error('❌ Error getting saved section:', error);
      return null;
    }
  }, [sectionId]);

  // Clear saved progress
  const clearSavedProgress = useCallback(() => {
    if (typeof window === 'undefined') return;
    
    try {
      localStorage.removeItem("current_section_id");
      localStorage.removeItem(`${sectionId}_exam_state`);
      localStorage.removeItem(`${sectionId}_performance_data`);
      localStorage.removeItem(`${sectionId}_quiz_search_data`);
      localStorage.removeItem(`${sectionId}_predicted_questions`);
      console.log('🗑️ Cleared all saved progress for section:', sectionId);
    } catch (error) {
      console.error('❌ Error clearing saved progress:', error);
    }
  }, [sectionId]);

  return {
    isRestored,
    getSavedSection,
    clearSavedProgress
  };
} 

