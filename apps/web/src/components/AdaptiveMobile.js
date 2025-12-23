"use client";

import React, { useState, useEffect } from 'react';
import styles from './AdaptiveMobile.module.css';

const AdaptiveMobile = () => {
  // Add all state variables needed for full feature parity
  const fullTitle = 'Welcome to Adaptive Learning';
  const description = 'Experience personalized education that adapts to your learning style and pace.';
  const descriptionWords = description.split(' ');
  const [displayedTitle, setDisplayedTitle] = useState('');
  const [wordsToShow, setWordsToShow] = useState(0);
  const [buttonDance, setButtonDance] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showRequirementModal, setShowRequirementModal] = useState(false);
  const [completedTopicsData, setCompletedTopicsData] = useState(null);
  const [isCheckingRequirement, setIsCheckingRequirement] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [studyPlan, setStudyPlan] = useState(null);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const [showStudyPlanModal, setShowStudyPlanModal] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [showPerformanceDetails, setShowPerformanceDetails] = useState(false);
  const [isPerformanceExpanded, setIsPerformanceExpanded] = useState(false);
  const [topicsToShow, setTopicsToShow] = useState(6);

  // Get token from localStorage
  const getToken = () => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('token');
    }
    return null;
  };

  const fetchPerformanceData = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch('/api/quiz/performance-analysis', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPerformanceData(data);
      }
    } catch (error) {
      console.error('Error fetching performance data:', error);
    }
  };

  const fetchStudyPlan = async () => {
    const token = getToken();
    if (!token) return;

    try {
      const response = await fetch('/api/quiz/study-plan', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStudyPlan(data);
      }
    } catch (error) {
      console.error('Error fetching study plan:', error);
    }
  };

  const checkQuizRequirement = async () => {
    const token = getToken();
    if (!token) {
      alert('Please log in to access adaptive learning.');
      return false;
    }

    setIsCheckingRequirement(true);
    try {
      const response = await fetch('/api/quiz/completed-topics-count', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCompletedTopicsData(data);
        return data.meets_minimum_requirement;
      }
      return false;
    } catch (error) {
      console.error('Error checking quiz requirement:', error);
      return false;
    } finally {
      setIsCheckingRequirement(false);
    }
  };

  const handleStartLearning = async () => {
    const meetsRequirement = await checkQuizRequirement();
    
    if (meetsRequirement) {
      setIsLoadingDashboard(true);
      await Promise.all([fetchPerformanceData(), fetchStudyPlan()]);
      setIsLoadingDashboard(false);
      setShowDashboard(true);
    } else {
      setShowRequirementModal(true);
    }
  };

  const handleStartPlan = () => {
    setShowStudyPlanModal(true);
  };

  const closeStudyPlanModal = () => {
    setShowStudyPlanModal(false);
  };

  const closeRequirementModal = () => {
    setShowRequirementModal(false);
  };

  const togglePerformanceExpansion = () => {
    if (isPerformanceExpanded) {
      // Reset topics count when collapsing
      setTopicsToShow(6);
    }
    setIsPerformanceExpanded(!isPerformanceExpanded);
  };

  const showMoreTopics = () => {
    setTopicsToShow(prev => prev + 10);
  };

  const showLessTopics = () => {
    setTopicsToShow(6);
  };

  const getTaskIcon = (type) => {
    switch (type) {
      case 'quiz': return '🕒';
      case 'review': return '📚';
      case 'advanced': return '⚡';
      default: return '📝';
    }
  };

  const getTaskPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  };

  // Animation effects for intro
  useEffect(() => {
    setDisplayedTitle(''); // Always start empty on mount
    let i = 0;
    const interval = setInterval(() => {
      setDisplayedTitle(fullTitle.slice(0, i + 1));
      i++;
      if (i === fullTitle.length) clearInterval(interval);
    }, 45);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (displayedTitle === fullTitle) {
      setWordsToShow(0);
      setButtonDance(false);
      let i = 0;
      const wordInterval = setInterval(() => {
        i++;
        setWordsToShow(i);
        if (i === descriptionWords.length) {
          clearInterval(wordInterval);
          setTimeout(() => setButtonDance(true), 350); // Start dance after last word
        }
      }, 300);
      return () => clearInterval(wordInterval);
    }
  }, [displayedTitle, fullTitle, descriptionWords.length]);

  // Loading state
  if (showDashboard && (isLoadingDashboard || !performanceData || !studyPlan)) {
    return (
      <div className={styles.mobileAdaptiveContainer}>
        <div className={styles.mobileAdaptiveHeader}>
          <h1>Adaptive Learning</h1>
        </div>
        <div className={styles.mobileLoadingState}>
          <div className={styles.mobileLoadingSpinner}></div>
          <h2>Analyzing Your Performance...</h2>
          <p>Generating your personalized study plan based on your quiz results.</p>
        </div>
      </div>
    );
  }

  // Dashboard state
  if (showDashboard && performanceData && studyPlan) {
    return (
      <div className={styles.mobileAdaptiveContainer}>
        <div className={styles.mobileAdaptiveHeader}>
          <button 
            className={styles.mobileBackBtn}
            onClick={() => setShowDashboard(false)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <h1>Learning Dashboard</h1>
        </div>

        <div className={styles.mobileDashboardContent}>
          {/* Quick Stats */}
          <div className={styles.mobileStatsRow}>
            <div className={styles.mobileStatCard}>
              <div className={styles.mobileStatValue}>{performanceData.total_quizzes}</div>
              <div className={styles.mobileStatLabel}>Quizzes</div>
            </div>
            <div className={styles.mobileStatCard}>
              <div className={styles.mobileStatValue}>{performanceData.average_percentage}%</div>
              <div className={styles.mobileStatLabel}>Average</div>
            </div>
            <div className={styles.mobileStatCard}>
              <div className={styles.mobileStatValue}>{Object.keys(performanceData.topic_performance || {}).length}</div>
              <div className={styles.mobileStatLabel}>Topics</div>
            </div>
          </div>

          {/* Profile Card */}
          <div className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <h3>Learning Profile</h3>
            </div>
            <div className={styles.mobileCardContent}>
              <div className={styles.mobileProfileItem}>
                <span className={styles.mobileProfileLabel}>Category</span>
                <span className={`${styles.mobileBadge} ${styles.mobileBadgeCategory}`}>{performanceData.overall_category}</span>
              </div>
              <div className={styles.mobileProfileItem}>
                <span className={styles.mobileProfileLabel}>Engagement</span>
                <span className={`${styles.mobileBadge} ${styles.mobileBadgeEngagement}`}>{performanceData.engagement_level}</span>
              </div>
            </div>
          </div>

          {/* Study Plan Card */}
          <div className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <h3>Study Plan</h3>
              <button 
                className={styles.mobileExpandBtn}
                onClick={handleStartPlan}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
            <div className={styles.mobileCardContent}>
              <div className={styles.mobilePlanType}>{studyPlan.plan_type}</div>
              <div className={styles.mobilePlanDesc}>{studyPlan.description}</div>
              <button className={`${styles.mobileBtnPrimary} ${styles.mobilePlanBtn}`} onClick={handleStartPlan}>
                Start Plan
              </button>
            </div>
          </div>

          {/* Tasks Card */}
          <div className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <h3>Priority Tasks</h3>
              <span className={styles.mobileTaskCount}>{studyPlan.tasks.length}</span>
            </div>
            <div className={styles.mobileCardContent}>
              {studyPlan.tasks.slice(0, 3).map((task, index) => (
                <div key={task.id} className={styles.mobileTaskItem}>
                  <div className={styles.mobileTaskIcon}>{getTaskIcon(task.type)}</div>
                  <div className={styles.mobileTaskInfo}>
                    <div className={styles.mobileTaskTitle}>{task.title}</div>
                    <div className={styles.mobileTaskMeta}>
                      <span 
                        className={`${styles.mobileTaskPriority} ${styles[`mobileTaskPriority${task.priority}`]}`}
                      >
                        {task.priority}
                      </span>
                      <span className={styles.mobileTaskTime}>{task.estimated_time}</span>
                    </div>
                  </div>
                  <button className={styles.mobileTaskBtn}>Start</button>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Card with Enhanced Features */}
          <div className={styles.mobileCard}>
            <div className={styles.mobileCardHeader}>
              <h3>Performance Analysis</h3>
              <button 
                className={styles.mobileExpandBtn}
                onClick={togglePerformanceExpansion}
              >
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  style={{ transform: isPerformanceExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                >
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              </button>
            </div>
            <div className={styles.mobileCardContent}>
              {!isPerformanceExpanded ? (
                // Compact View
                <div className={styles.mobilePerformanceSummary}>
                  {performanceData.strengths.length > 0 && (
                    <div className={styles.mobileStrengthItem}>
                      <span className={styles.mobileStrengthIcon}>✓</span>
                      <span className={styles.mobileStrengthText}>
                        Best: {performanceData.strengths[0].name}
                      </span>
                    </div>
                  )}
                  {performanceData.weaknesses.length > 0 && (
                    <div className={styles.mobileWeaknessItem}>
                      <span className={styles.mobileWeaknessIcon}>!</span>
                      <span className={styles.mobileWeaknessText}>
                        Focus: {performanceData.weaknesses[0].name}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                // Expanded View with All Features
                <div className={styles.mobilePerformanceDetails}>
                  <div className={styles.mobilePerformanceSection}>
                    <h4>Strengths</h4>
                    {performanceData.strengths.length > 0 ? (
                      performanceData.strengths.slice(0, 3).map((strength, index) => (
                      <div key={index} className={styles.mobilePerformanceRow}>
                          <span className={styles.mobilePerformanceLabel}>
                            {strength.type === 'topic' ? strength.name : `${strength.name} (Subject)`}
                          </span>
                      </div>
                      ))
                    ) : (
                      <div className={styles.mobilePerformanceRow}>
                        <span className={styles.mobilePerformanceLabel}>Complete more quizzes to identify strengths</span>
                      </div>
                    )}
                  </div>
                  
                  <div className={styles.mobilePerformanceSection}>
                    <h4>Areas for Improvement</h4>
                    {performanceData.weaknesses.length > 0 ? (
                      performanceData.weaknesses.slice(0, 2).map((weakness, index) => (
                      <div key={index} className={styles.mobilePerformanceRow}>
                          <span className={styles.mobilePerformanceLabel}>
                            {weakness.type === 'topic' ? weakness.name : `${weakness.name} (Subject)`}
                          </span>
                      </div>
                      ))
                    ) : (
                      <div className={styles.mobilePerformanceRow}>
                        <span className={styles.mobilePerformanceLabel}>Great job! No major weaknesses identified</span>
                      </div>
                    )}
                  </div>

                  {/* All Completed Topics */}
                  {performanceData.topic_performance && Object.keys(performanceData.topic_performance).length > 0 && (
                    <div className={styles.mobilePerformanceSection}>
                      <div className={styles.mobileTopicsHeader}>
                        <h4>All Completed Topics</h4>
                        <span className={styles.mobileTopicsCount}>
                          ({Object.keys(performanceData.topic_performance).length} total)
                        </span>
                      </div>
                      
                      {Object.entries(performanceData.topic_performance)
                        .sort(([,a], [,b]) => b.average_percentage - a.average_percentage)
                        .slice(0, topicsToShow)
                        .map(([topicName, topicData], index) => (
                        <div key={index} className={styles.mobilePerformanceRow}>
                          <span className={`${styles.mobilePerformanceLabel} ${styles.mobileTopicName}`}>
                            {topicName}
                            <span className={styles.mobileTopicSubject}>({topicData.subject})</span>
                          </span>
                          <div className={styles.mobilePerformanceBar}>
                            <div 
                              className={`${styles.mobilePerformanceFill} ${topicData.average_percentage < 60 ? styles.mobileWeaknessFill : ''}`} 
                              style={{width: `${topicData.average_percentage}%`}}
                            ></div>
                          </div>
                          <span className={styles.mobilePerformanceValue}>{topicData.average_percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                      
                      {/* Show More/Less Controls */}
                      {Object.keys(performanceData.topic_performance).length > 6 && (
                        <div className={styles.mobileTopicsControls}>
                          {topicsToShow < Object.keys(performanceData.topic_performance).length ? (
                            <button 
                              className={`${styles.mobileTopicsControlBtn} ${styles.mobileShowMoreBtn}`} 
                              onClick={showMoreTopics}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="6,9 12,15 18,9"></polyline>
                              </svg>
                              Show More ({Object.keys(performanceData.topic_performance).length - topicsToShow} remaining)
                            </button>
                          ) : (
                            <button 
                              className={`${styles.mobileTopicsControlBtn} ${styles.mobileShowLessBtn}`} 
                              onClick={showLessTopics}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="18,15 12,9 6,15"></polyline>
                              </svg>
                              Show Less
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Study Metrics */}
                  <div className={`${styles.mobilePerformanceSection} ${styles.mobileStudyMetrics}`}>
                    <h4>Study Metrics</h4>
                    <div className={styles.mobileMetricRow}>
                      <svg width="18" height="18" fill="none" stroke="#5a6273" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                      <span className={styles.mobileMetricValue}>{performanceData.total_quizzes} quizzes</span>
                    </div>
                    <div className={styles.mobileMetricLabel}>Completed</div>
                    <div className={styles.mobileMetricRow}>
                      <svg width="18" height="18" fill="none" stroke="#1bb97a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/></svg>
                      <span className={styles.mobileMetricValue}>{performanceData.average_percentage}%</span>
                    </div>
                    <div className={styles.mobileMetricLabel}>Average Score</div>
                    
                    <div className={styles.mobileMetricRow} style={{ marginTop: '12px' }}>
                      <svg width="18" height="18" fill="none" stroke="#667eea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                      <span className={styles.mobileMetricValue}>{Object.keys(performanceData.topic_performance || {}).length}</span>
                    </div>
                    <div className={styles.mobileMetricLabel}>Topics Mastered</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enhanced Study Plan Modal */}
        {showStudyPlanModal && studyPlan && (
          <div className={styles.mobileModalOverlay} onClick={closeStudyPlanModal}>
            <div className={`${styles.mobileModal} ${styles.mobileStudyPlanModal}`} onClick={e => e.stopPropagation()}>
              <div className={styles.mobileModalHeader}>
                <h2>Your Personalized Study Plan</h2>
                <button 
                  className={styles.mobileModalClose}
                  onClick={closeStudyPlanModal}
                >
                  ×
                </button>
              </div>
              <div className={`${styles.mobileModalContent} ${styles.mobileStudyPlanContent}`}>
                {/* Plan Overview */}
                <div className={styles.mobilePlanOverview}>
                  <div className={`${styles.mobilePlanTypeBadge} ${styles.mobilePlanTypeBadge}`}>{studyPlan.plan_type}</div>
                  <p className={styles.mobilePlanDescription}>{studyPlan.description}</p>
                  
                  {/* Performance Summary */}
                  <div className={styles.mobilePerformanceSummarySection}>
                    <h3>Your Performance Summary</h3>
                    <div className={styles.mobileSummaryStats}>
                      <div className={styles.mobileStatItem}>
                        <span className={styles.mobileStatLabel}>Quizzes Completed</span>
                        <span className={styles.mobileStatValue}>{studyPlan.performance_summary?.total_quizzes || 0}</span>
                      </div>
                      <div className={styles.mobileStatItem}>
                        <span className={styles.mobileStatLabel}>Average Score</span>
                        <span className={styles.mobileStatValue}>{studyPlan.performance_summary?.average_percentage || 0}%</span>
                      </div>
                      <div className={styles.mobileStatItem}>
                        <span className={styles.mobileStatLabel}>Category</span>
                        <span className={styles.mobileStatValue}>{studyPlan.performance_summary?.category || 'N/A'}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Focus Areas */}
                {studyPlan.focus_areas && studyPlan.focus_areas.length > 0 && (
                  <div className={styles.mobileFocusAreasSection}>
                    <h3>Priority Focus Areas</h3>
                    <div className={styles.mobileFocusAreasGrid}>
                      {studyPlan.focus_areas.map((area, index) => (
                        <div key={index} className={styles.mobileFocusAreaCard}>
                          <div className={styles.mobileFocusAreaHeader}>
                            <span className={styles.mobileFocusAreaSubject}>{area.subject}</span>
                            <span className={`${styles.mobileFocusAreaPriority} ${styles[`mobilePriority${area.priority}`]}`}>{area.priority}</span>
                          </div>
                          <p className={styles.mobileFocusAreaReason}>{area.reason}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recommended Tasks */}
                <div className={styles.mobileRecommendedTasksSection}>
                  <h3>Recommended Learning Tasks</h3>
                  <div className={styles.mobileTasksList}>
                  {studyPlan.tasks.map((task, index) => (
                      <div key={task.id} className={styles.mobileTaskCard}>
                        <div className={styles.mobileTaskHeader}>
                          <div className={styles.mobileTaskInfo}>
                            <span className={styles.mobileTaskIcon}>{getTaskIcon(task.type)}</span>
                            <div className={styles.mobileTaskDetails}>
                              <h4 className={styles.mobileTaskTitle}>{task.title}</h4>
                              <p className={styles.mobileTaskDescription}>{task.description}</p>
                            </div>
                          </div>
                          <div className={styles.mobileTaskMeta}>
                            <span className={`${styles.mobileTaskPriority} ${styles[`mobilePriority${task.priority}`]}`}>{task.priority}</span>
                            <span className={styles.mobileTaskTime}>{task.estimated_time}</span>
                          </div>
                        </div>
                        <div className={styles.mobileTaskActions}>
                          <button className={`${styles.mobileTaskBtn} ${styles[`mobileTaskBtn${task.priority}`]}`}>
                            {task.type === 'quiz' ? 'Take Quiz' : task.type === 'review' ? 'Start Review' : 'Begin Practice'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>

                {/* Recommendations */}
                {studyPlan.recommendations && studyPlan.recommendations.length > 0 && (
                  <div className={styles.mobileRecommendationsSection}>
                    <h3>Study Recommendations</h3>
                    <ul className={styles.mobileRecommendationsList}>
                      {studyPlan.recommendations.map((recommendation, index) => (
                        <li key={index} className={styles.mobileRecommendationItem}>
                          <span className={styles.mobileRecommendationIcon}>💡</span>
                          <span className={styles.mobileRecommendationText}>{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              <div className={styles.mobileStudyPlanModalFooter}>
                <button className={`${styles.mobileModalBtnSecondary} ${styles.mobileModalBtnSecondary}`} onClick={closeStudyPlanModal}>
                  Close
                </button>
                <button className={`${styles.mobileModalBtnPrimary} ${styles.mobileModalBtnPrimary}`}>
                  Start Learning Journey
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Initial state with animations
  return (
    <div className={styles.mobileAdaptiveContainer}>
      <div className={styles.mobileAdaptiveIntro}>
        <div className={styles.mobileIntroIcon}>
          <img src="/assets/brain.png" alt="Adaptive Learning" />
        </div>
        <h1 className={`${styles.mobileIntroTitle} ${styles.mobileTypingAnimation}`}>
          {displayedTitle}{displayedTitle !== fullTitle && <span className={styles.mobileTypingCursor}>|</span>}
        </h1>
        <p className={styles.mobileIntroDesc}>
          {descriptionWords.map((word, idx) => (
            <span
              key={idx}
              className={`${styles.mobileFadeUpWord}${idx < wordsToShow ? ' ' + styles.visible : ''}`}
              style={{ transitionDelay: `${idx * 60}ms` }}
            >
              {word}{' '}
            </span>
          ))}
        </p>
        <button 
          className={`${styles.mobileBtnPrimary} ${styles.mobileStartBtn}${buttonDance ? ' ' + styles.mobileDance : ''}`}
          onClick={handleStartLearning}
          disabled={isCheckingRequirement}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          {isCheckingRequirement ? 'Checking Progress...' : 'Start Learning'}
        </button>
      </div>

      {/* Requirement Modal */}
      {showRequirementModal && (
        <div className={styles.mobileModalOverlay} onClick={closeRequirementModal}>
          <div className={`${styles.mobileModal} ${styles.mobileModal}`} onClick={e => e.stopPropagation()}>
            <div className={styles.mobileModalHeader}>
              <h2>Complete More Quizzes to Unlock</h2>
              <button 
                className={styles.mobileModalClose}
                onClick={closeRequirementModal}
              >
                ×
              </button>
            </div>
            <div className={styles.mobileModalContent}>
              <div className={styles.mobileRequirementIcon}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 6v6l4 2"/>
                </svg>
              </div>
              <p className={styles.mobileModalText}>
                To access the Adaptive Learning Dashboard, you need to complete at least <strong>3 quizzes on different topics</strong>.
              </p>
              {completedTopicsData && (
                <div className={styles.mobileProgressInfo}>
                  <p className={styles.mobileProgressCurrent}>
                    Current Progress: <span className={styles.mobileProgressCount}>{completedTopicsData.completed_topics_count} / 3</span> topics completed
                  </p>
                  {completedTopicsData.completed_topics.length > 0 && (
                    <div className={styles.mobileCompletedTopics}>
                      <p className={styles.mobileCompletedLabel}>Completed Topics:</p>
                      <ul className={styles.mobileTopicsList}>
                      {completedTopicsData.completed_topics.map((topic, index) => (
                          <li key={index} className={styles.mobileTopicItem}>✓ {topic}</li>
                      ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
              <p className={styles.mobileModalSuggestion}>
                Visit the <strong>My Course</strong> section to complete more quizzes and unlock adaptive learning features!
              </p>
            </div>
            <div className={styles.mobileModalActions}>
              <button className={`${styles.mobileModalBtnPrimary} ${styles.mobileModalBtnPrimary}`} onClick={closeRequirementModal}>
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdaptiveMobile; 

