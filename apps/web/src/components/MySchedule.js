"use client";
 
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI, studyPlanAPI } from '../lib/api';
import { useDashboard } from '../hooks/useDashboard';
import styles from './MySchedule.module.css';

// Skeleton Loading Components
const MyScheduleSkeleton = ({ isDarkMode }) => (
  <div className={`${styles.container} ${isDarkMode ? styles.dark : styles.light}`}>
    {/* Header Section Skeleton */}
    <div className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.titleSection}>
          <div className={styles.headerTitleSkeleton}></div>
          <div className={styles.headerSubtitleSkeleton}></div>
        </div>
      </div>
    </div>

    <div className={styles.layout}>
      {/* Left Column - Information Panels */}
      <div className={styles.leftColumn}>
        {/* Set Exam Date Panel Skeleton */}
        <div className={styles.panel}>
          <div className={styles.panelTitleSkeleton}></div>
          <div className={styles.dateInputSkeleton}></div>
          <div className={styles.createPlanButtonSkeleton}></div>
        </div>

        {/* This Week Panel Skeleton */}
        <div className={styles.panel}>
          <div className={styles.panelTitleSkeleton}></div>
          <div className={styles.weekCalendarSkeleton}>
            {[1, 2, 3, 4, 5, 6, 7].map(i => (
              <div key={i} className={styles.weekDaySkeleton}>
                <div className={styles.dayNameSkeleton}></div>
                <div className={styles.dayDateSkeleton}></div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Progress Panel Skeleton */}
        <div className={styles.panel}>
          <div className={styles.panelTitleSkeleton}></div>
          <div className={styles.progressInfoSkeleton}>
            <div className={styles.goalsCompletedSkeleton}></div>
            <div className={styles.progressBarSkeleton}></div>
            <div className={styles.progressTextSkeleton}>
              <div className={styles.percentageSkeleton}></div>
              <div className={styles.plannedHoursSkeleton}></div>
            </div>
          </div>
        </div>

        {/* Study Statistics Panel Skeleton */}
        <div className={styles.panel}>
          <div className={styles.panelTitleSkeleton}></div>
          <div className={styles.statisticsSkeleton}>
            {[1, 2, 3].map(i => (
              <div key={i} className={styles.statItemSkeleton}>
                <div className={styles.statLabelSkeleton}></div>
                <div className={styles.statValueSkeleton}></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column - Main Content */}
      <div className={styles.rightColumn}>
        <div className={styles.mainHeader}>
          <div className={styles.mainTitleSkeleton}></div>
          <div className={styles.mainSubtitleSkeleton}></div>
        </div>

        <div className={styles.goalsSection}>
          <div className={styles.sectionTitleSkeleton}></div>
          <div className={styles.goalsListSkeleton}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={styles.goalCardSkeleton}>
                <div className={styles.goalHeaderSkeleton}>
                  <div className={styles.goalCheckboxSkeleton}></div>
                  <div className={styles.goalInfoSkeleton}>
                    <div className={styles.goalTitleSkeleton}></div>
                    <div className={styles.goalMetaSkeleton}>
                      <div className={styles.goalSubjectSkeleton}></div>
                      <div className={styles.goalPrioritySkeleton}></div>
                      <div className={styles.goalTypeSkeleton}></div>
                      <div className={styles.goalDurationSkeleton}></div>
                      <div className={styles.goalTimeSkeleton}></div>
                    </div>
                  </div>
                  <div className={styles.goalActionsSkeleton}>
                    <div className={styles.actionButtonSkeleton}></div>
                    <div className={styles.actionButtonSkeleton}></div>
                    <div className={styles.goalCardArrowSkeleton}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
);
 
export default function MySchedule() {
  const { user } = useAuth();
  const { isDarkMode } = useTheme();
  const [examDate, setExamDate] = useState('');
  const [userYear, setUserYear] = useState(null);
  const [userSemester, setUserSemester] = useState(null);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userDataLoading, setUserDataLoading] = useState(true);
  const [planLoading, setPlanLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [currentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // YYYY-MM-DD format
  const [selectedDateGoals, setSelectedDateGoals] = useState([]);
  const [selectedDateLoading, setSelectedDateLoading] = useState(false);
  const [statistics, setStatistics] = useState({
    hoursThisWeek: '0h',
    subjectsCovered: '0/0'
  });
  const dateInputRef = useRef(null);

  // Get user ID for dashboard data
  const userId = user?.mobile || (typeof window !== 'undefined' ? localStorage.getItem('mobile') : null);
  
  // Fetch daily streak data using the dashboard hook (same as navigation bar)
  const { dailyStreak, todayGoals, goalsLoaded, setTodayGoals } = useDashboard(userId, { mode: 'light' });

  // Dispatch skeleton events based on loading state
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event(loading ? 'page-skeleton-start' : 'page-skeleton-end'));
      }
    } catch {}
  }, [loading]);

  // Listen for study plan updates from other components
  useEffect(() => {
    const handleStudyPlanUpdate = () => {
      console.log('📢 Study plan update received, refreshing current plan');
      studyPlanAPI.getCurrent()
        .then(currentPlan => {
          if (currentPlan) {
            setPlan(currentPlan);
          }
        })
        .catch((error) => {
          console.error('❌ Failed to refresh study plan:', error);
        });
    };

    window.addEventListener('study-plan-updated', handleStudyPlanUpdate);
    return () => {
      window.removeEventListener('study-plan-updated', handleStudyPlanUpdate);
    };
  }, []);
 
  // Load user settings without caching - optimized for speed
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setUserDataLoading(true);
      try {
        // Show immediate UI with defaults while loading
        setUserYear(prev => prev ?? 1);
        setUserSemester(prev => prev ?? 1);
        setLoading(false); // Allow UI to render immediately
        
        // Then fetch real data
        const me = await authAPI.me();
        if (isMounted && me) {
          const yr = me.year || 1;
          const sem = me.semester || 1;
          setUserYear(yr);
          setUserSemester(sem);
          console.log(`✅ Loaded user data: Year ${yr}, Semester ${sem}`);
        }
      } catch (e) {
        console.error('Failed to load user data:', e);
        // Keep defaults
        if (isMounted) {
          setUserYear(prev => prev ?? 1);
          setUserSemester(prev => prev ?? 1);
        }
      } finally {
        if (isMounted) {
          setUserDataLoading(false);
          setLoading(false);
        }
      }
    };
    init();
    return () => {
      isMounted = false;
    };
  }, []);

  // Keep user year/semester in sync with backend ONLY when tab regains focus (not on mount)
  useEffect(() => {
    const refreshUserData = async () => {
      try {
        const me = await authAPI.me();
        if (me) {
          const yr = me.year || 1;
          const sem = me.semester || 1;
          if (yr !== userYear || sem !== userSemester) {
            console.log(`Updating user data: Year ${userYear}→${yr}, Semester ${userSemester}→${sem}`);
            setUserYear(yr);
            setUserSemester(sem);
            // Clear current plan when user year/semester changes
            setPlan(null);
            setExamDate('');
            
            // Notify other components that study plan has been cleared
            window.dispatchEvent(new CustomEvent('study-plan-updated', {
              detail: { 
                action: 'plan-cleared', 
                reason: 'user-data-change',
                timestamp: new Date().toISOString()
              }
            }));
          }
        }
      } catch (error) {
        console.error('Failed to refresh user data:', error);
      }
    };

    // Only refresh on window focus - NOT on mount (first useEffect handles mount)
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', refreshUserData);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', refreshUserData);
      }
    };
  }, [userYear, userSemester]);

  // Check if user has a study plan and load it if exists - with fast loading
  useEffect(() => {
    const checkAndLoadPlan = async () => {
      if (!userYear || !userSemester) return;
      
      setPlanLoading(true);
      try {
        // Parallel requests for faster loading
        const [planStatus, statsData] = await Promise.allSettled([
          studyPlanAPI.hasPlan(),
          studyPlanAPI.getStats()
        ]);
        
        // Handle plan status
        if (planStatus.status === 'fulfilled') {
          console.log('User plan status:', planStatus.value);
          
          if (planStatus.value.has_active_plan) {
            // User has an active plan, load it
            try {
              const currentPlan = await studyPlanAPI.getCurrent();
              setPlan(currentPlan);
              setExamDate(currentPlan.exam_date);
              console.log('✅ Loaded existing study plan for user');
            } catch (error) {
              console.error('Failed to load study plan:', error);
              setPlan(null);
              setExamDate('');
            }
          } else {
            // User has no active plan
            console.log('User has no active study plan - needs to generate one');
            setPlan(null);
            setExamDate('');
            
            // If user had a plan before but it's not active, set the exam date
            if (planStatus.value.current_exam_date) {
              setExamDate(planStatus.value.current_exam_date);
            }
          }
        }
        
        // Handle statistics (parallel loading) - only hours and subjects, streak comes from dashboard hook
        if (statsData.status === 'fulfilled') {
          setStatistics({
            hoursThisWeek: statsData.value.hours_this_week || '0h',
            subjectsCovered: statsData.value.subjects_covered || '0/0'
          });
        }
        
      } catch (error) {
        console.error('Failed to check user plan status:', error);
        setPlan(null);
        setExamDate('');
      } finally {
        setPlanLoading(false);
      }
    };
    
    // Only load if user data is ready
    if (!userDataLoading) {
      checkAndLoadPlan();
    }
  }, [userYear, userSemester, userDataLoading]);

  const normalizeDate = (value) => {
    if (!value) return '';
    // Accept either YYYY-MM-DD or mm/dd/yyyy and normalize to YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const m = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const mm = m[1].padStart(2, '0');
      const dd = m[2].padStart(2, '0');
      const yyyy = m[3];
      return `${yyyy}-${mm}-${dd}`;
    }
    return value;
  };

  const generatePlan = async (dateStr) => {
    if (!userYear || !userSemester) return;
    setGenerating(true);
    try {
      const normalized = normalizeDate(dateStr);
      const response = await studyPlanAPI.generate({ 
        examDate: normalized, 
        year: userYear, 
        semester: userSemester 
      });
      setPlan(response);
      setExamDate(normalized); // Update the exam date in UI
      console.log(`Generated study plan with ${response.days_remaining} days until exam`);
      
      // Notify other components that study plan has been generated
      console.log('📢 Dispatching study-plan-updated event after plan generation');
      window.dispatchEvent(new CustomEvent('study-plan-updated', {
        detail: { 
          action: 'plan-generated', 
          examDate: normalized,
          timestamp: new Date().toISOString()
        }
      }));
      
      // Refresh statistics after generating plan
      try {
        const stats = await studyPlanAPI.getStats();
        setStatistics({
          weeklyStreak: stats.weekly_streak || 0,
          hoursThisWeek: stats.hours_this_week || '0h',
          subjectsCovered: stats.subjects_covered || '0/0'
        });
      } catch (statsError) {
        console.error('Failed to load statistics after plan generation:', statsError);
      }
    } catch (err) {
      console.error('Failed to generate study plan:', err);
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate study plan. ';
      
      if (err.message?.includes('network') || err.message?.includes('fetch')) {
        errorMessage += 'Please check your internet connection and try again.';
      } else if (err.message?.includes('401') || err.message?.includes('unauthorized')) {
        errorMessage += 'Please log in again and try.';
      } else if (err.message?.includes('400')) {
        errorMessage += 'Please check your exam date and course information.';
      } else {
        errorMessage += 'Please try again in a few moments.';
      }
      
      alert(errorMessage);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveExamDate = async () => {
    if (!examDate) {
      alert('Please enter your exam date');
      return;
    }
    
    if (!userYear || !userSemester) {
      alert('Please wait while we load your course information...');
      return;
    }
    
    // Check if exam date is in the past
    const today = new Date();
    const examDateTime = new Date(examDate);
    if (examDateTime < today) {
      const confirmPastDate = confirm('The exam date you selected is in the past. Do you want to continue?');
      if (!confirmPastDate) {
        return;
      }
    }
    
    await generatePlan(examDate);
  };

  const handleCalendarClick = () => {
    const el = dateInputRef.current;
    if (!el) return;
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch (_) {
        // fallthrough to focus/click
      }
    }
    // Fallbacks for browsers without showPicker
    el.focus();
    try { el.click(); } catch (_) { /* noop */ }
  };

  // Statistics are now loaded in parallel with plan data for better performance

  // OPTIMIZED: Use dashboard hook for today's goals to prevent duplicate API calls
  // Fetch goals for selected date
  const fetchSelectedDateGoals = useCallback(async (date, controller) => {
    if (!date) return;
    
    setSelectedDateLoading(true);
    try {
      console.log('📅 Fetching goals for date:', date);
      
      // Check if this is a revision day (no study plans)
      const selectedDateObj = new Date(date);
      const examDateObj = examDate ? new Date(examDate) : null;
      
      if (examDateObj) {
        const timeDiff = examDateObj.getTime() - new Date().getTime();
        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
        const revisionBufferDays = totalDays > 10 ? 3 : 0;
        const studyEndDate = new Date(examDateObj);
        studyEndDate.setDate(examDateObj.getDate() - revisionBufferDays);
        
        const isRevisionDay = revisionBufferDays > 0 && selectedDateObj >= studyEndDate && selectedDateObj < examDateObj;
        
        if (isRevisionDay) {
          setSelectedDateGoals([]);
          setSelectedDateLoading(false);
          console.log('📋 Revision day - no study plans');
          return;
        }
      }
      
      const tasksData = await studyPlanAPI.getTasksForDate(date, controller?.signal);
      
      if (tasksData && tasksData.tasks && tasksData.tasks.length > 0) {
        // Convert tasks to goals format
        const goals = tasksData.tasks.map((task, index) => {
          // Extract topic name from title or notes
          let topicName = '';
          
          if (task.title) {
            const dashIndex = task.title.indexOf(' - ');
            if (dashIndex !== -1) {
              topicName = task.title.substring(dashIndex + 3);
            }
          }
          
          if (!topicName && task.notes) {
            const topicMatch = task.notes.match(/Topic:\s*(.+)/);
            if (topicMatch) {
              topicName = topicMatch[1].trim();
            }
          }
          
          return {
            id: task.task_id || task.id || index,
            title: task.title,
            subject: task.subject,
            topic_name: topicName || 'Topic',
            priority: task.priority,
            type: task.task_type || task.type,
            duration: task.duration,
            scheduledTime: task.scheduled_time,
            completed: task.completed || false,
          };
        });
        
        setSelectedDateGoals(goals);
        console.log('✅ Goals for selected date:', goals);
      } else {
        setSelectedDateGoals([]);
        console.log('📋 No goals found for selected date');
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        console.log('⏸️ Fetch cancelled for date:', date);
      } else {
        console.error('❌ Failed to fetch goals for selected date:', error);
        setSelectedDateGoals([]);
      }
    } finally {
      setSelectedDateLoading(false);
    }
  }, [examDate]);

  // Handle date selection
  const fetchControllerRef = useRef(null);
  const handleDateClick = useCallback((date) => {
    const dateString = date.toISOString().split('T')[0];
    setSelectedDate(dateString);

    if (fetchControllerRef.current) {
      fetchControllerRef.current.abort();
    }

    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    fetchControllerRef.current = controller;
    fetchSelectedDateGoals(dateString, controller);
  }, [fetchSelectedDateGoals]);
 
  const completedGoals = todayGoals ? todayGoals.filter(goal => goal.completed).length : 0;
  const totalGoals = todayGoals ? todayGoals.length : 0;
  const progressPercentage = totalGoals > 0 ? Math.round((completedGoals / totalGoals) * 100) : 0;
 
  // Get exam period dates (from today to exam date)
  // FIXED: Use useMemo to make exam period dates reactive to examDate changes
  const examPeriodDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    const todayString = today.toISOString().split('T')[0];
    
    // If no exam date is set, show current week
    if (!examDate) {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start from Sunday
     
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        dates.push({
          day: date.toLocaleDateString('en-US', { weekday: 'short' }),
          date: date.getDate(),
          dateObj: date,
          isToday: date.toDateString() === today.toDateString()
        });
      }
      return dates;
    }
    
    // Calculate dates from today to exam date
    const examDateObj = new Date(examDate);
    const currentDate = new Date(today);
    
    // Calculate total days from today to exam date
    const timeDiff = examDateObj.getTime() - currentDate.getTime();
    const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
    
    // If exam is more than 10 days away, add 3-day revision buffer
    const revisionBufferDays = totalDays > 10 ? 3 : 0;
    const studyEndDate = new Date(examDateObj);
    studyEndDate.setDate(examDateObj.getDate() - revisionBufferDays);
    
    // Start from today
    const startDate = currentDate;
    const endDate = examDateObj;
    
    // Generate dates
    for (let i = 0; i < totalDays; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const isRevisionDay = revisionBufferDays > 0 && date >= studyEndDate && date < examDateObj;
      
      dates.push({
        day: date.toLocaleDateString('en-US', { weekday: 'short' }),
        date: date.getDate(),
        dateObj: date,
        isToday: date.toDateString() === today.toDateString(),
        isExamDate: date.toDateString() === examDateObj.toDateString(),
        isRevisionDay: isRevisionDay
      });
    }
    
    return dates;
  }, [examDate]); // Recalculate when examDate changes
 
    const handleGoalToggle = async (goalId) => {
    try {
      const goal = todayGoals.find(g => g.id === goalId);
      if (!goal) return;

      const newCompleted = !goal.completed;
      
      // Optimistically update UI
      const updatedGoals = todayGoals.map(g => 
        g.id === goalId ? { ...g, completed: newCompleted } : g
      );
      
      // Update plan state optimistically
      if (plan && plan.daily) {
        const updatedDaily = plan.daily.map(d => {
          if (d.date === todayIso) {
            return {
              ...d,
              tasks: d.tasks.map(t => 
                t.id === goalId ? { ...t, completed: newCompleted } : t
              )
            };
          }
          return d;
        });
        setPlan({ ...plan, daily: updatedDaily });
      }

      // Call backend API with the correct task_id
      const taskId = goal.id; // This should be the task_id from the backend
      const response = await studyPlanAPI.toggleTask(taskId, newCompleted);
      
      if (response.xp_awarded > 0) {
        // Show XP notification or update UI
        console.log(`Earned ${response.xp_awarded} XP!`);
      }

      // OPTIMIZED: Dispatch event to refresh dashboard data
      window.dispatchEvent(new CustomEvent('study-plan-updated', {
        detail: { 
          action: 'task-completed', 
          goalId: goalId,
          timestamp: new Date().toISOString()
        }
      }));

      // Check if all tasks for today are completed
      const allCompleted = updatedGoals.every(g => g.completed || g.id === goalId && newCompleted);
      if (allCompleted && newCompleted) {
        // Mark daily tasks as completed
        await studyPlanAPI.markDailyTasksCompleted();
        console.log('All daily tasks completed! Streak updated.');
        
        // Dispatch streak-updated event to trigger navbar refresh
        window.dispatchEvent(new CustomEvent('streak-updated', { 
          detail: { 
            type: 'daily-tasks-completed',
            goalId: goalId,
            allTasksCompleted: true
          } 
        }));
        
        // Refresh statistics after completing all tasks (streak is handled by dashboard hook)
        try {
          const stats = await studyPlanAPI.getStats();
          setStatistics({
            hoursThisWeek: stats.hours_this_week || '0h',
            subjectsCovered: stats.subjects_covered || '0/0'
          });
        } catch (error) {
          console.error('Failed to refresh statistics:', error);
        }
      } else {
        // Dispatch streak-updated event for individual goal completion
        window.dispatchEvent(new CustomEvent('streak-updated', { 
          detail: { 
            type: 'goal-completed',
            goalId: goalId,
            completed: newCompleted
          } 
        }));
      }

    } catch (error) {
      console.error('Failed to toggle goal:', error);
      
      // Revert the optimistic update - use the original goal's completed status
      const goal = todayGoals.find(g => g.id === goalId);
      if (goal) {
        const revertedGoals = todayGoals.map(g => 
          g.id === goalId ? { ...g, completed: goal.completed } : g
        );
        setTodayGoals(revertedGoals);
        
        // Revert plan state
        if (plan && plan.daily) {
          const revertedDaily = plan.daily.map(d => {
            if (d.date === todayIso) {
              return {
                ...d,
                tasks: d.tasks.map(t => 
                  t.id === goalId ? { ...t, completed: goal.completed } : t
                )
              };
            }
            return d;
          });
          setPlan({ ...plan, daily: revertedDaily });
        }
      }
      
      // Show user-friendly error message
      if (error.response && error.response.status === 400) {
        const errorMessage = error.response.data?.detail || 'Cannot complete this task yet';
        alert(`❌ ${errorMessage}\n\nPlease complete the video and notes for this topic first.`);
      } else {
        alert('❌ Failed to update task. Please try again.');
      }
    }
  };

  const handleEditGoal = async (goalId) => {
    try {
      const goal = todayGoals.find(g => g.id === goalId);
      if (!goal) return;

      // For now, show a simple prompt (in production, you'd use a modal)
      const newTitle = prompt('Edit task title:', goal.title);
      if (newTitle && newTitle !== goal.title) {
        await studyPlanAPI.updateTask(goal.id, { title: newTitle });
        
        // Refresh the plan
        const refreshedPlan = await studyPlanAPI.getCurrent();
        setPlan(refreshedPlan);
        
        // OPTIMIZED: Dispatch event to refresh dashboard data
        window.dispatchEvent(new CustomEvent('study-plan-updated', {
          detail: { 
            action: 'task-edited', 
            goalId: goalId,
            timestamp: new Date().toISOString()
          }
        }));
      }
    } catch (error) {
      console.error('Failed to edit goal:', error);
      alert('Failed to edit task. Please try again.');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    try {
      const goal = todayGoals.find(g => g.id === goalId);
      if (!goal) return;

      if (confirm(`Are you sure you want to delete "${goal.title}"?`)) {
        await studyPlanAPI.deleteTask(goal.id);
        
        // Refresh the plan
        const refreshedPlan = await studyPlanAPI.getCurrent();
        setPlan(refreshedPlan);
        
        // OPTIMIZED: Dispatch event to refresh dashboard data
        window.dispatchEvent(new CustomEvent('study-plan-updated', {
          detail: { 
            action: 'task-deleted', 
            goalId: goalId,
            timestamp: new Date().toISOString()
          }
        }));
      }
    } catch (error) {
      console.error('Failed to delete goal:', error);
      alert('Failed to delete task. Please try again.');
    }
  };

  // Handle goal card click to navigate to specific topic in subject
  const handleGoalCardClick = (goal) => {
    console.log('🎯 Goal clicked:', goal);
    
    // Extract subject code and topic name primarily from goal.text (dashboard goals use `text`),
    // with fallbacks to goal.subject and goal.topicName/goal.topic
    let subjectCode = '';
    let topicName = '';

    // Prefer goal.text for parsing (format similar to: "Study Session: BS203: Biochemistry - Glycolysis ...")
    if (goal.text) {
      const dashIndex = goal.text.indexOf(' - ');
      if (dashIndex > -1) {
        const subjectPart = goal.text.substring(0, dashIndex).replace(/^(Study Session|Review|Practice|Mock Test):\s*/, '');
        topicName = goal.text.substring(dashIndex + 3);

        // Extract subject code (e.g., "BS203" from "BS203: Biochemistry")
        const codeMatch = subjectPart.match(/^([A-Z]{2}\d{3})/);
        if (codeMatch) {
          subjectCode = codeMatch[1];
        }
      }
    }

    // Fallback: try to extract subject code from goal.subject if not found
    if (!subjectCode && goal.subject) {
      const codeMatch = goal.subject.match(/^([A-Z]{2}\d{3})/);
      if (codeMatch) {
        subjectCode = codeMatch[1];
      }
    }

    // Fallback for topic name if not parsed from text
    if (!topicName) {
      topicName = goal.topicName || goal.topic || '';
    }

    console.log('📚 Extracted subject code:', subjectCode);
    console.log('📖 Extracted topic:', topicName);

    if (subjectCode) {
      // Build URL with subject and optional topic for direct topic selection in CourseContent
      const from = encodeURIComponent(window.location.pathname || '/');
      const baseUrl = `/subjects?subject=${subjectCode}&from=${from}`;
      const fullUrl = topicName ? `${baseUrl}&topic=${encodeURIComponent(topicName)}` : baseUrl;

      console.log('🚀 Navigating to:', fullUrl);
      window.location.href = fullUrl;
    } else {
      console.log('❌ Subject code not found, redirecting to subjects page');
      window.location.href = '/subjects';
    }
  };
 
  // Show skeleton loading while data is loading
  if (loading) {
    return <MyScheduleSkeleton isDarkMode={isDarkMode} />;
  }

  return (
    <div className={`${styles.container} ${isDarkMode ? styles.dark : styles.light}`}>
      {/* Header Section */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.titleSection}>
            <h1 className={styles.headerTitle}>My Study Schedule</h1>
            <p className={styles.headerSubtitle}>Your personalized study plan and daily goals management.</p>
          </div>
        </div>
      </div>

      <div className={styles.layout}>
        {/* Left Column - Information Panels */}
        <div className={styles.leftColumn}>
          {/* Set Exam Date Panel */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Set Exam Date</h3>
            <div className={styles.dateInputContainer}>
              <input
                type="date"
                placeholder="yyyy-mm-dd"
                value={examDate}
                onChange={(e) => setExamDate(e.target.value)}
                className={styles.dateInput}
                ref={dateInputRef}
              />
              <span
                className={styles.calendarIcon}
                onClick={handleCalendarClick}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleCalendarClick(); }}
                aria-label="Open calendar"
              >
                📅
              </span>
            </div>
            <div style={{ marginTop: 8 }}>
              <button
                className={styles.createPlanButton}
                onClick={handleSaveExamDate}
                disabled={generating || !examDate || !userYear || !userSemester}
                title={!examDate ? "Please set an exam date first" : plan ? "Create a new study plan" : "Generate your personalized study plan"}
                aria-label={generating ? 'Generating study plan...' : (plan ? 'Create a new study plan' : 'Generate your personalized study plan')}
                aria-describedby="create-plan-status"
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (!generating && examDate && userYear && userSemester) {
                      handleSaveExamDate();
                    }
                  }
                }}
              >
                <span className={styles.buttonIcon}>
                  {generating ? '⏳' : (plan ? '🔄' : '✨')}
                </span>
                <span className={styles.buttonText}>
                  {generating ? 'Generating…' : (plan ? 'Create New Plan' : 'Generate Plan')}
                </span>
              </button>
              <div 
                id="create-plan-status" 
                className={styles.srOnly}
                aria-live="polite"
                aria-atomic="true"
              >
                {generating ? 'Study plan is being generated. Please wait...' : 
                 !examDate ? 'Please set an exam date to generate a plan' :
                 !userYear || !userSemester ? 'Loading course information...' :
                 plan ? 'Study plan is ready. Click to create a new plan.' :
                 'Ready to generate your personalized study plan'}
              </div>
            </div>
          </div>
 
          {/* Exam Period Panel */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>
              {examDate ? 'Exam Period' : 'This Week'}
            </h3>
            {userDataLoading || planLoading ? (
              <div className={styles.examPeriodSkeleton}>
                <div className={styles.weekCalendarSkeleton}>
                  {[1, 2, 3, 4, 5, 6, 7].map(i => (
                    <div key={i} className={styles.weekDaySkeleton}>
                      <div className={styles.dayNameSkeleton}></div>
                      <div className={styles.dayDateSkeleton}></div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className={`${styles.weekCalendar} ${examPeriodDates.length > 7 ? styles.scrollableCalendar : ''}`}>
                {examPeriodDates.map((day, index) => {
                  const dayDateString = day.dateObj.toISOString().split('T')[0];
                  const isSelected = dayDateString === selectedDate;
                  
                  return (
                    <div
                      key={index}
                      className={`${styles.weekDay} ${day.isToday ? styles.today : ''} ${day.isExamDate ? styles.examDate : ''} ${day.isRevisionDay ? styles.revisionDay : ''} ${isSelected ? styles.selected : ''}`}
                      onClick={() => handleDateClick(day.dateObj)}
                    >
                      <span className={styles.dayName}>{day.day}</span>
                      <span className={styles.dayDate}>{day.date}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
 
          {/* Today's Progress Panel */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Today's Progress</h3>
            {planLoading ? (
              <div className={styles.progressInfoSkeleton}>
                <div className={styles.goalsCompletedSkeleton}></div>
                <div className={styles.progressBarSkeleton}></div>
                <div className={styles.progressTextSkeleton}>
                  <div className={styles.percentageSkeleton}></div>
                  <div className={styles.plannedHoursSkeleton}></div>
                </div>
              </div>
            ) : (
              <div className={styles.progressInfo}>
                <div className={styles.goalsCompleted}>
                  Goals Completed: <span className={styles.goalsCount}>{completedGoals}/{totalGoals}</span>
                </div>
                <div className={styles.progressBar}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progressPercentage}%` }}
                  ></div>
                </div>
                <div className={styles.progressText}>
                  <span className={styles.percentage}>{progressPercentage}% Complete</span>
                  <span className={styles.plannedHours}>{totalGoals} tasks planned ⏰</span>
                </div>
              </div>
            )}
          </div>
 
          {/* Study Statistics Panel */}
          <div className={styles.panel}>
            <h3 className={styles.panelTitle}>Study Statistics</h3>
            {planLoading ? (
              <div className={styles.statisticsSkeleton}>
                {[1, 2, 3].map(i => (
                  <div key={i} className={styles.statItemSkeleton}>
                    <div className={styles.statLabelSkeleton}></div>
                    <div className={styles.statValueSkeleton}></div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.statistics}>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>streaks</span>
                  <span className={styles.statValue}>{dailyStreak?.streak || 0} 🔥</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Study Hours</span>
                  <span className={styles.statValue}>{statistics.hoursThisWeek}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statLabel}>Subjects Covered:</span>
                  <span className={styles.statValue}>{statistics.subjectsCovered}</span>
                </div>
              </div>
            )}
          </div>
        </div>
 
        {/* Right Column - Main Content */}
        <div className={styles.rightColumn}>
 
          <div className={styles.goalsSection}>
            <h2 className={styles.sectionTitle}>
              {selectedDate === new Date().toISOString().split('T')[0] ? "Today's Goals" : `Goals for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}`}
            </h2>
            <div className={styles.goalsList}>
              {planLoading || !goalsLoaded || selectedDateLoading ? (
                <div className={styles.goalsListSkeleton}>
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className={styles.goalCardSkeleton}>
                      <div className={styles.goalHeaderSkeleton}>
                        <div className={styles.goalCheckboxSkeleton}></div>
                        <div className={styles.goalInfoSkeleton}>
                          <div className={styles.goalTitleSkeleton}></div>
                          <div className={styles.goalMetaSkeleton}>
                            <div className={styles.goalSubjectSkeleton}></div>
                            <div className={styles.goalPrioritySkeleton}></div>
                            <div className={styles.goalTypeSkeleton}></div>
                            <div className={styles.goalDurationSkeleton}></div>
                            <div className={styles.goalTimeSkeleton}></div>
                          </div>
                        </div>
                        <div className={styles.goalActionsSkeleton}>
                          <div className={styles.actionButtonSkeleton}></div>
                          <div className={styles.actionButtonSkeleton}></div>
                          <div className={styles.goalCardArrowSkeleton}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : loading ? (
                <div className={styles.panel}>
                  <div style={{ textAlign: 'center', padding: '20px' }}>
                    <div style={{ fontSize: '16px', marginBottom: '8px' }}>🚀 Initializing...</div>
                    <div style={{ fontSize: '14px', color: '#6b7280' }}>Setting up your workspace</div>
                  </div>
                </div>
              ) : !plan ? (
                <div className={styles.panel}>
                  <div className={styles.emptyStateContent}>
                    <h3>No Study Plan Generated</h3>
                    <p>
                      {examDate 
                        ? 'You have set an exam date. Click "Generate Plan" to create your personalized study schedule.'
                        : 'Set your exam date above and click "Generate Plan" to create your personalized study schedule.'
                      }
                    </p>
                    {examDate && (
                      <div style={{ marginTop: '16px' }}>
                        <p style={{ fontSize: '14px', color: '#6b7280' }}>
                          📅 Exam Date: {examDate}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (selectedDate === new Date().toISOString().split('T')[0] ? totalGoals : selectedDateGoals.length) === 0 ? (
                <div className={styles.panel}>
                  <p>
                    {(() => {
                      const selectedDateObj = new Date(selectedDate);
                      const examDateObj = examDate ? new Date(examDate) : null;
                      
                      if (examDateObj) {
                        const timeDiff = examDateObj.getTime() - new Date().getTime();
                        const totalDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1;
                        const revisionBufferDays = totalDays > 10 ? 3 : 0;
                        const studyEndDate = new Date(examDateObj);
                        studyEndDate.setDate(examDateObj.getDate() - revisionBufferDays);
                        
                        const isRevisionDay = revisionBufferDays > 0 && selectedDateObj >= studyEndDate && selectedDateObj < examDateObj;
                        
                        if (isRevisionDay) {
                          return `Revision day - No new study plans for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.`;
                        }
                      }
                      
                      return selectedDate === new Date().toISOString().split('T')[0] 
                        ? "No goals for today. All tasks completed!" 
                        : `No goals for ${new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.`;
                    })()}
                  </p>
                </div>
              ) : (
                (selectedDate === new Date().toISOString().split('T')[0] ? todayGoals : selectedDateGoals).map((goal) => (
                <div key={goal.id} className={`${styles.goalCard} ${goal.completed ? styles.completed : ''} ${styles.clickableGoalCard}`}>
                  <div className={styles.goalHeader}>
                    <div className={styles.goalCheckbox}>
                      <button
                        className={`${styles.checkbox} ${goal.completed ? styles.checked : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoalToggle(goal.id);
                        }}
                      >
                        {goal.completed && <span className={styles.checkmark}>✓</span>}
                      </button>
                    </div>
                    <div 
                      className={styles.goalInfo}
                      onClick={() => handleGoalCardClick(goal)}
                    >
                       <h3 className={styles.goalTitle}>{goal.subject}</h3>
                       <div className={styles.goalMeta}>
                         <span className={styles.goalSubject}>{goal.topic_name || goal.topic || 'Topic'}</span>
                       </div>
                    </div>
                  </div>
                </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
 
 

