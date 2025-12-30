// Dashboard Service - Handles all dashboard-related API calls
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app';

class DashboardService {
  constructor() {
    this.baseURL = API_BASE_URL;
  }

  // Get authentication token from localStorage
  getAuthToken() {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  }

  // Generic API request method
  async makeRequest(endpoint, options = {}) {
    const token = this.getAuthToken();
    
    const headers = {
      'Content-Type': 'application/json',
      // Prevent caching for user-specific dashboard calls
      'Cache-Control': 'no-store',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        cache: 'no-store',
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Dashboard API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Get complete dashboard data
  async getCompleteDashboard(userId) {
    try {
      if (userId) {
        // Use the userId-based endpoint
        return await this.makeRequest(`/api/dashboard-complete?userId=${userId}`);
      } else {
        // Use the authenticated endpoint
        return await this.makeRequest('/api/dashboard-data');
      }
    } catch (error) {
      console.error('Failed to fetch complete dashboard:', error);
      // Return fallback data
      return this.getFallbackDashboardData();
    }
  }

  // Get today's goals progress
  async getTodaysGoalsProgress() {
    try {
      return await this.makeRequest('/api/daily-goal/todays-goals-progress');
    } catch (error) {
      console.error('Failed to fetch today\'s goals:', error);
      return this.getFallbackGoalsData();
    }
  }

  // Get current course information
  async getCurrentCourse() {
    try {
      return await this.makeRequest('/api/current-course');
    } catch (error) {
      console.error('Failed to fetch current course:', error);
      return this.getFallbackCourseData();
    }
  }

  // Get leaderboard data
  async getLeaderboard() {
    try {
      return await this.makeRequest('/api/leaderboard');
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error);
      return this.getFallbackLeaderboardData();
    }
  }

  // Mark video as watched for a specific task
  async markVideoWatched(taskId) {
    try {
      return await this.makeRequest('/api/study-plan/task/mark-video-completed', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId }),
      });
    } catch (error) {
      console.error('Failed to mark video as watched:', error);
      throw error;
    }
  }

  // Mark notes as read for a specific task
  async markNotesRead(taskId) {
    try {
      return await this.makeRequest('/api/study-plan/task/mark-notes-completed', {
        method: 'POST',
        body: JSON.stringify({ task_id: taskId }),
      });
    } catch (error) {
      console.error('Failed to mark notes as read:', error);
      throw error;
    }
  }

  // Mark quiz as completed (optional)
  async markQuizCompleted(taskId) {
    try {
      console.log('🎯 Marking quiz as completed for task:', taskId);
      
      const token = this.getAuthToken();
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(`${API_BASE_URL}/api/study-plan/task/mark-quiz-completed`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          task_id: taskId
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Quiz completion tracked successfully:', data);
        return { success: true, data };
      } else {
        console.error('❌ Failed to track quiz completion:', response.statusText);
        return { success: false, message: response.statusText };
      }
    } catch (error) {
      console.error('Failed to mark quiz as completed:', error);
      throw error;
    }
  }

  // Update daily streak
  async updateDailyStreak(userId) {
    try {
      return await this.makeRequest('/api/daily-goal/daily-streak/update', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
    } catch (error) {
      console.error('Failed to update daily streak:', error);
      throw error;
    }
  }

  // Refresh streak data manually
  async refreshStreakData(userId) {
    try {
      return await this.makeRequest(`/api/dashboard/refresh-streak?userId=${userId}`, {
        method: 'POST',
      });
    } catch (error) {
      console.error('Failed to refresh streak data:', error);
      throw error;
    }
  }

  // Mark goal as complete
  async markGoalComplete(userId) {
    try {
      return await this.makeRequest('/api/daily-goal/daily-streak/goal-complete', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });
    } catch (error) {
      console.error('Failed to mark goal as complete:', error);
      throw error;
    }
  }

  // Fallback data methods
  getFallbackDashboardData() {
    return {
      user_info: {
        name: "Student",
        level: 1,
        xp_weekly: 0,
        xp_total: 0
      },
      daily_streak: {
        streak: 0,
        last_active_date: null,
        goal_done: false,
        videos_watched: 0,
        quizzes_completed: 0,
        daily_tasks_completed: false
      },
      weekly_streak: [false, false, false, false, false, false, false],
      leaderboard: [],
      recent_quiz_questions: {},
      current_course: {
        course_title: "B.Pharmacy Fundamentals",
        course_path: "Year 1 / Semester 1 / Pharmacy / Introduction",
        progress_percentage: 0,
        last_lesson: "Introduction to Pharmacy",
        status: "Not Started",
        year: 1,
        semester: 1
      },
      timestamp: new Date().toISOString(),
      error: "Some data could not be loaded"
    };
  }

  getFallbackGoalsData() {
    return {
      user_id: 0,
      date: new Date().toISOString().split('T')[0],
      videos_watched: 0,
      quizzes_completed: 0,
      streak: 0,
      daily_tasks_completed: false
    };
  }

  getFallbackCourseData() {
    return {
      course_title: "B.Pharmacy Fundamentals",
      course_path: "Year 1 / Semester 1 / Pharmacy / Introduction",
      progress_percentage: 0,
      last_lesson: "Introduction to Pharmacy",
      status: "Not Started",
      year: 1,
      semester: 1
    };
  }

  getFallbackLeaderboardData() {
    return [
      { name: "Sarah Chen", xp: 2450, level: 5 },
      { name: "Alex Kumar", xp: 2180, level: 4 },
      { name: "Emma Wilson", xp: 1920, level: 4 },
      { name: "Michael Brown", xp: 1680, level: 3 },
      { name: "Lisa Garcia", xp: 1520, level: 3 }
    ];
  }

  // Get sample today's goals (for fallback)
  getSampleTodayGoals() {
    return [
      { id: 1, text: "Complete Pharmacology Quiz", completed: true },
      { id: 2, text: "Review Drug Interactions", completed: false },
      { id: 3, text: "Practice Calculations", completed: false },
      { id: 4, text: "Study Clinical Cases", completed: false },
      { id: 5, text: "Read Therapeutic Guidelines", completed: false },
      { id: 6, text: "Complete Lab Report", completed: false },
      { id: 7, text: "Review Patient Counseling", completed: false },
      { id: 8, text: "Study Drug Metabolism", completed: false },
      { id: 9, text: "Practice Dosage Calculations", completed: false },
      { id: 10, text: "Review Clinical Trials", completed: false },
      { id: 11, text: "Study Drug Interactions", completed: false },
      { id: 12, text: "Complete Case Studies", completed: false }
    ];
  }

  // Get sample courses (for fallback)
  getSampleCourses() {
    return [
      { 
        name: "Human Anatomy & Physiology I", 
        code: "HA", 
        shortName: "Human Anatomy & Physi...",
        year: 1,
        semester: 1
      },
      { 
        name: "Pharmaceutica I Inorganic Chemistry", 
        code: "PC", 
        shortName: "Pharmaceutica I Inorganic...",
        year: 1,
        semester: 1
      }
    ];
  }
}

// Create and export a singleton instance
const dashboardService = new DashboardService();
export default dashboardService;

