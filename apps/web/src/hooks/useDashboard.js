import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import dashboardService from '../services/dashboardService';
import api from '../lib/api';
import { studyPlanAPI } from '../lib/api';

// Global request tracking to prevent duplicate calls across hook instances
let globalTasksFetchInProgress = false;
let globalDashboardFetchInProgress = false;
let lastTasksFetchTime = 0;
let lastDashboardFetchTime = 0;
const MIN_FETCH_INTERVAL = 2000; // Minimum 2 seconds between fetches

export const useDashboard = (userId, options = {}) => {
  const { mode = 'full' } = options;
  const isLightMode = mode === 'light';

  // State for dashboard data - start with loading state
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // Show loading initially
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  // State for individual components - start with empty array to prevent null errors
  const [todayGoals, setTodayGoals] = useState([]);
  const [currentCourse, setCurrentCourse] = useState(null);
  const [leaderboard, setLeaderboard] = useState(null);
  const [userInfo, setUserInfo] = useState(null);
  const [dailyStreak, setDailyStreak] = useState(null);
  const [goalsLoaded, setGoalsLoaded] = useState(false);
  
  // Refs for request deduplication
  const isMountedRef = useRef(true);

  // Fetch today's tasks from study plan - ULTRA-OPTIMIZED for speed with deduplication
  const fetchTodaysTasks = useCallback(async (force = false) => {
    // Prevent duplicate simultaneous requests
    const now = Date.now();
    if (!force && globalTasksFetchInProgress) {
      console.log('⏸️ Tasks fetch already in progress, skipping...');
      return;
    }
    if (!force && (now - lastTasksFetchTime) < MIN_FETCH_INTERVAL) {
      console.log('⏸️ Tasks fetch too soon, skipping...');
      return;
    }
    
    try {
      globalTasksFetchInProgress = true;
      lastTasksFetchTime = now;
      
      // OPTIMIZED: Use dedicated today's tasks endpoint for maximum speed
      const tasksData = await studyPlanAPI.getTodaysTasks();
      
      if (tasksData && tasksData.tasks && tasksData.tasks.length > 0) {
        // OPTIMIZED: Pre-allocate array and use single loop for maximum efficiency
        const goals = new Array(tasksData.tasks.length);
        
        for (let i = 0; i < tasksData.tasks.length; i++) {
          const task = tasksData.tasks[i];
          
          // OPTIMIZED: Extract topic name efficiently
          let topicName = '';
          
          // Try to extract from title first (format: "Review: PS101: Human Anatomy and Physiology I - test")
          if (task.title) {
            const dashIndex = task.title.indexOf(' - ');
            if (dashIndex !== -1) {
              topicName = task.title.substring(dashIndex + 3); // Skip ' - '
            }
          }
          
          // Fallback: try to extract from notes (format: "Unit: Unit 1 | Topic: test")
          if (!topicName && task.notes) {
            const topicMatch = task.notes.match(/Topic:\s*(.+)/);
            if (topicMatch) {
              topicName = topicMatch[1].trim();
            }
          }
          
          goals[i] = {
            id: task.task_id || `task-${i}`,
            text: task.title || `${task.task_type}: ${task.subject} - ${topicName}`,
            completed: task.completed || false,
            subject: task.subject,
            topicName: topicName || 'Topic',
            topic: topicName || 'Topic', // Add both for compatibility
            taskType: task.task_type,
            priority: task.priority,
            duration: task.duration,
            scheduledTime: task.scheduled_time
          };
        }
        
        setTodayGoals(goals);
        setGoalsLoaded(true);
        console.log('✅ Today\'s goals updated from study plan:', goals);
      } else {
        console.log('📋 No tasks found for today, setting empty goals');
        // Set empty goals when no study plan tasks are found
        setTodayGoals([]);
        setGoalsLoaded(true);
      }
    } catch (err) {
      console.error('❌ Failed to fetch today\'s tasks:', err);
      // Set empty goals on error to show "No Study Plan Generated" message
      setTodayGoals([]);
      setGoalsLoaded(true);
    } finally {
      globalTasksFetchInProgress = false;
    }
  }, []);

  // Data fetch with proper loading states and deduplication
  const fetchDashboardData = useCallback(async (force = false) => {
    if (isLightMode) {
      // Light mode avoids the heavy dashboard payload
      return;
    }

    // Prevent duplicate simultaneous requests
    const now = Date.now();
    if (!force && globalDashboardFetchInProgress) {
      console.log('⏸️ Dashboard fetch already in progress, skipping...');
      return;
    }
    if (!force && (now - lastDashboardFetchTime) < MIN_FETCH_INTERVAL) {
      console.log('⏸️ Dashboard fetch too soon, skipping...');
      return;
    }

    try {
      globalDashboardFetchInProgress = true;
      lastDashboardFetchTime = now;
      console.log('🔄 Fetching dashboard data...');

      const data = await dashboardService.getCompleteDashboard(userId);
      setDashboardData(data);

      console.log('✅ Dashboard data received');

      // Extract and set individual component data
      if (data.user_info) {
        setUserInfo(data.user_info);
      }

      if (data.daily_streak) {
        setDailyStreak(data.daily_streak);
      }

      if (data.leaderboard && data.leaderboard.length > 0) {
        const formattedLeaderboard = data.leaderboard.map((user, index) => ({
          rank: index + 1,
          name: user.name || "Anonymous",
          xp: user.xp?.toLocaleString() || "0",
          isTop: index < 3,
          isCurrentUser: user.name === data.user_info?.name
        }));
        setLeaderboard(formattedLeaderboard);
      }

      if (data.current_course) {
        setCurrentCourse(data.current_course);
      }

      // Fetch today's tasks from study plan
      await fetchTodaysTasks();

      setLastUpdated(new Date());
      setIsLoading(false);
      setGoalsLoaded(true);
      console.log('✅ Dashboard data updated successfully');

    } catch (err) {
      console.error('❌ Failed to fetch dashboard data:', err);
      setError(err.message);
      setIsLoading(false);

      // Set fallback data on error
      setUserInfo({
        name: "Student",
        email: "student@example.com",
        course: "Doctor of Pharmacy",
        year: 1,
        semester: 1
      });

      setDailyStreak({
        streak: 0,
        last_active_date: new Date().toISOString(),
        goal_done: false,
        videos_watched: 0,
        quizzes_completed: 0,
        daily_tasks_completed: false
      });

      // Don't set currentCourse in error case to prevent wrong fallback data
      // Let the Overview component handle the case when currentCourse is null

      setLeaderboard([
        { rank: 1, name: "Sarah Chen", xp: "2,450", isTop: true },
        { rank: 2, name: "Alex Kumar", xp: "2,180", isTop: true },
        { rank: 3, name: "Emma Wilson", xp: "1,920", isTop: true },
        { rank: 4, name: "Michael Brown", xp: "1,680", isTop: false },
        { rank: 5, name: "Lisa Garcia", xp: "1,520", isTop: false },
        { rank: 7, name: "You", xp: "1,340", isCurrentUser: true }
      ]);

      setTodayGoals([
        { id: 1, text: "Complete Daily Quiz", completed: false },
        { id: 2, text: "Watch Study Video", completed: false },
        { id: 3, text: "Review Course Notes", completed: false },
        { id: 4, text: "Practice Calculations", completed: false },
        { id: 5, text: "Study Clinical Cases", completed: false },
        { id: 6, text: "Complete Lab Report", completed: false }
      ]);
      setGoalsLoaded(true);
    } finally {
      globalDashboardFetchInProgress = false;
    }
  }, [userId, isLightMode, fetchTodaysTasks]);

  // Generate today's goals (fallback)
  const generateTodayGoals = useCallback(() => {
    const baseGoals = [
      { id: 1, text: "Complete Daily Quiz", completed: false },
      { id: 2, text: "Watch Study Video", completed: false },
      { id: 3, text: "Review Course Notes", completed: false },
      { id: 4, text: "Practice Calculations", completed: false },
      { id: 5, text: "Study Clinical Cases", completed: false },
      { id: 6, text: "Complete Lab Report", completed: false },
      { id: 7, text: "Review Patient Counseling", completed: false },
      { id: 8, text: "Study Drug Metabolism", completed: false },
      { id: 9, text: "Practice Dosage Calculations", completed: false },
      { id: 10, text: "Review Clinical Trials", completed: false }
    ];

    return baseGoals;
  }, []);

  // Refresh specific data
  const refreshTodayGoals = useCallback(async () => {
    try {
      // Always prioritise study plan tasks
      await fetchTodaysTasks();

      if (isLightMode) {
        return;
      }

      // Also fetch from dashboard service as fallback
      const goalsData = await dashboardService.getTodaysGoalsProgress();
      if (goalsData && todayGoals.length === 0) {
        const goals = generateTodayGoals();
        setTodayGoals(goals);
        setDailyStreak(goalsData);
      }
    } catch (err) {
      console.error('Failed to refresh today\'s goals:', err);
    }
  }, [fetchTodaysTasks, generateTodayGoals, todayGoals, isLightMode]);

  const refreshCurrentCourse = useCallback(async () => {
    try {
      const courseData = await dashboardService.getCurrentCourse();
      if (courseData) {
        setCurrentCourse(courseData);
      }
    } catch (err) {
      console.error('Failed to refresh current course:', err);
    }
  }, []);

  const refreshLeaderboard = useCallback(async () => {
    try {
      const leaderboardData = await dashboardService.getLeaderboard();
      if (leaderboardData) {
        setLeaderboard(leaderboardData);
      }
    } catch (err) {
      console.error('Failed to refresh leaderboard:', err);
    }
  }, []);

  // Refresh streak data specifically
  const refreshStreakData = useCallback(async () => {
    try {
      console.log('🔄 Refreshing streak data...');
      // Try the new refresh endpoint first
      if (userId) {
        try {
          const refreshResult = await dashboardService.refreshStreakData(userId);
          if (refreshResult && refreshResult.success) {
            console.log('✅ Streak data refreshed via API:', refreshResult);
            // Map backend fields to local state
            setDailyStreak({
              streak: refreshResult.current_streak ?? 0,
              last_active_date: refreshResult.last_activity_date ?? null,
              goal_done: (refreshResult.videos_watched_today ?? 0) > 0,
              videos_watched: refreshResult.videos_watched_today ?? 0,
              quizzes_completed: 0,
              daily_tasks_completed: (refreshResult.videos_watched_today ?? 0) > 0
            });
            return;
          }
        } catch (refreshError) {
          console.warn('⚠️ Refresh endpoint failed, falling back to dashboard data:', refreshError);
        }
      }
      
      if (isLightMode) {
        // In light mode, avoid the heavy fallback call and keep existing streak data
        console.warn('⚠️ Skipping heavy dashboard fallback in light mode.');
        return;
      }

      // Fallback to dashboard data
      const dashboardData = await dashboardService.getCompleteDashboard(userId);
      if (dashboardData && dashboardData.daily_streak) {
        setDailyStreak(dashboardData.daily_streak);
        console.log('✅ Streak data refreshed from dashboard');
      }
    } catch (err) {
      console.error('❌ Failed to refresh streak data:', err);
    }
  }, [userId, isLightMode]);

  // Quiz completion tracking - checks if quiz exists and updates study plan task
  const checkAndUpdateQuizCompletion = useCallback(async (subject, unit, topic, userId) => {
    try {
      console.log('🎯 Checking quiz completion for:', { subject, unit, topic, userId });
      
      // Check if quiz exists for this topic
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/quiz/check-topic-quiz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          subject: subject,
          unit: unit,
          topic: topic,
          user_id: userId
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Quiz completion check result:', result);
        
        // Refresh today's goals to reflect updated completion status
        await fetchTodaysTasks();
        
        return result;
      } else {
        console.error('❌ Failed to check quiz completion:', response.statusText);
        return { quiz_completed: false };
      }
    } catch (error) {
      console.error('❌ Error checking quiz completion:', error);
      return { quiz_completed: false };
    }
  }, [fetchTodaysTasks]);
  
  // Mark quiz as completed for a specific topic
  const markQuizCompleted = useCallback(async (subject, unit, topic, userId, score = 0) => {
    try {
      console.log('🎯 Marking quiz as completed for:', { subject, unit, topic, userId, score });
      
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/quiz/mark-completed`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          subject: subject,
          unit: unit,
          topic: topic,
          user_id: userId,
          score: score
        })
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('✅ Quiz marked as completed:', result);
        
        // Refresh today's goals to reflect updated completion status
        await fetchTodaysTasks();
        
        // Dispatch event to notify other components
        window.dispatchEvent(new CustomEvent('quiz-completed', {
          detail: {
            subject,
            unit,
            topic,
            score,
            userId
          }
        }));
        
        return result;
      } else {
        console.error('❌ Failed to mark quiz as completed:', response.statusText);
        return { success: false };
      }
    } catch (error) {
      console.error('❌ Error marking quiz as completed:', error);
      return { success: false };
    }
  }, [fetchTodaysTasks]);

  // Calculate progress percentage
  const progressPercentage = useMemo(() => {
    if (!todayGoals || todayGoals.length === 0) return 0;
    const completedCount = todayGoals.filter(goal => goal.completed).length;
    return Math.round((completedCount / todayGoals.length) * 100);
  }, [todayGoals]);

  // Calculate weekly streak
  const weeklyStreak = useMemo(() => {
    // Generate weekly streak based on daily streak data
    const streak = dailyStreak?.streak || 0;
    const today = new Date().getDay(); // 0 = Sunday, 1 = Monday, etc.
    
    // Create a week array matching the display order: M, T, W, Th, F, S, Su
    // JavaScript getDay(): 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday
    // Display order: M(1), T(2), W(3), Th(4), F(5), S(6), Su(0)
    const displayOrder = [1, 2, 3, 4, 5, 6, 0]; // M, T, W, Th, F, S, Su
    const weekStreak = new Array(7).fill(false);
    
    // Mark days as active based on streak, counting backwards from today
    for (let i = 0; i < Math.min(streak, 7); i++) {
      // Calculate which day this streak day represents (going backwards from today)
      const streakDay = (today - i + 7) % 7;
      
      // Find the position in our display order
      const displayIndex = displayOrder.indexOf(streakDay);
      if (displayIndex >= 0) {
        weekStreak[displayIndex] = true;
      }
    }
    
    return weekStreak;
  }, [dailyStreak]);

  // Initial data fetch - start immediately without waiting
  useEffect(() => {
    if (isLightMode) {
      let isMounted = true;
      const loadLightweightData = async () => {
        try {
          console.log('⚡ Loading lightweight dashboard data...');
          setIsLoading(true);

          await fetchTodaysTasks();

          if (userId) {
            await refreshStreakData();
          }

          if (isMounted) {
            setError(null);
            setLastUpdated(new Date());
          }
        } catch (err) {
          console.error('❌ Failed to load lightweight dashboard data:', err);
          if (isMounted) {
            setError(err.message);
          }
        } finally {
          if (isMounted) {
            setIsLoading(false);
          }
        }
      };

      loadLightweightData();
      return () => {
        isMounted = false;
      };
    }

    // Start fetching data immediately when hook mounts or userId changes
    fetchDashboardData();
    
    // Prefetch navigation data for instant section switching
    const timer = setTimeout(() => {
      try {
        if (api && typeof api.prefetchNavigationData === 'function') {
          api.prefetchNavigationData();
        } else {
          console.warn('🎯 Navigation prefetch function not available');
        }
      } catch (error) {
        console.warn('🎯 Navigation prefetch failed:', error);
      }
    }, 100); // Small delay to prioritize dashboard data

    return () => clearTimeout(timer);
  }, [isLightMode, userId, fetchDashboardData, fetchTodaysTasks, refreshStreakData]);

  // Auto-refresh data every 5 minutes - DISABLED to prevent excessive API calls
  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     console.log('🔄 Auto-refreshing dashboard data...');
  //     fetchDashboardData();
  //   }, 5 * 60 * 1000); // 5 minutes

  //   return () => clearInterval(interval);
  // }, [fetchDashboardData]);

  // Listen for streak-updated events from video completion
  useEffect(() => {
    const handleStreakUpdated = (event) => {
      console.log('🎬 Received streak-updated event:', event.detail);
      // Refresh streak data when video completion updates streak
      refreshStreakData();
    };

    const handleRefreshDashboard = () => {
      console.log('🔄 Received refresh-dashboard event');
      if (isLightMode) {
        if (userId) {
          refreshStreakData();
        }
      } else {
        // Force refresh all dashboard data
        fetchDashboardData();
      }
    };

    const handleStudyPlanUpdated = (event) => {
      console.log('📢 Received study-plan-updated event:', event.detail);
      
      // OPTIMIZED: Only refresh if it's a task-related update
      if (event.detail?.action && ['task-completed', 'task-edited', 'task-deleted'].includes(event.detail.action)) {
        console.log('🔄 Refreshing today\'s goals due to task update');
        fetchTodaysTasks();
      }
    };

    window.addEventListener('streak-updated', handleStreakUpdated);
    window.addEventListener('refresh-dashboard', handleRefreshDashboard);
    window.addEventListener('study-plan-updated', handleStudyPlanUpdated);
    
    return () => {
      window.removeEventListener('streak-updated', handleStreakUpdated);
      window.removeEventListener('refresh-dashboard', handleRefreshDashboard);
      window.removeEventListener('study-plan-updated', handleStudyPlanUpdated);
    };
  }, [isLightMode, refreshStreakData, fetchDashboardData, fetchTodaysTasks, userId]);

  // Return dashboard state and functions
  return {
    // Data - may be null initially
    dashboardData,
    todayGoals,
    currentCourse,
    leaderboard,
    userInfo,
    dailyStreak,
    weeklyStreak,
    
    // State - proper loading states
    isLoading,
    error,
    lastUpdated,
    progressPercentage,
    goalsLoaded,
    
    // Functions
    fetchDashboardData,
    refreshTodayGoals,
    refreshCurrentCourse,
    refreshLeaderboard,
    refreshStreakData,
    checkAndUpdateQuizCompletion,
    markQuizCompleted,
    
    // Utility functions
    generateTodayGoals,

    // Local state setters (for optimistic UI updates)
    setTodayGoals
  };
};

