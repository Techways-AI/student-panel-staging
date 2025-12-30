import { useCallback, useMemo, useState } from 'react';
import { quizAPI } from '../lib/api.js';

/**
 * Single-source-of-truth topic completion hook.
 * - Reads completion from backend
 * - Allows local optimistic mark
 * - Exposes Set for O(1) lookups
 */
export const useQuizCompletion = ({ subject, year, semester }) => {
  const [completedTopics, setCompletedTopics] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const fetchCompletion = useCallback(async () => {
    if (!subject) return;
    setLoading(true);
    try {
      // Primary: new endpoint with internal fallback (handled in api.js)
      const res = await quizAPI.getCompletedTopics({
        subject,
        year,
        semester,
      });
      const topics = res?.completedTopics || res?.completed_topics || [];
      setCompletedTopics(new Set(topics));
    } catch (error) {
      console.error('❌ useQuizCompletion: failed to fetch completion', error);
      try {
        // Fallback 1: subject-specific completion if available
        const resSubject = await quizAPI.getSubjectCompletion(subject);
        const topics = resSubject?.completedTopics || resSubject?.completed_topics || [];
        setCompletedTopics(new Set(topics));
      } catch (fallbackErr) {
        console.warn('⚠️ useQuizCompletion fallback to subject completion failed, trying global:', fallbackErr);
        try {
          // Fallback 2: legacy all-completed endpoint
          const resAll = await quizAPI.getAllCompletedTopics();
          const topics = resAll?.completedTopics || resAll?.completed_topics || [];
          setCompletedTopics(new Set(topics));
        } catch (fallbackErr2) {
          console.error('❌ useQuizCompletion: all fallbacks failed', fallbackErr2);
        }
      }
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [subject, year, semester]);

  const markCompletedLocal = useCallback((topic) => {
    if (!topic) return;
    setCompletedTopics((prev) => new Set([...prev, topic]));
  }, []);

  const setCompletedTopicsFromAPI = useCallback((topics = []) => {
    setCompletedTopics(new Set(topics));
    setLoaded(true);
  }, []);

  const completedCount = useMemo(() => completedTopics.size, [completedTopics]);

  return {
    completedTopics,
    completedCount,
    loading,
    loaded,
    fetchCompletion,
    markCompletedLocal,
    setCompletedTopicsFromAPI,
  };
};
