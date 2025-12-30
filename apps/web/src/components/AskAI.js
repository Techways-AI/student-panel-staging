import React, { useState, useRef, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import styles from './AskAI.module.css';
import { useChatSectionManager } from '../hooks/useChatSectionManager';
import { askQuestion, logAIQuery } from '../services/aiService';
import { aiAPI } from '../lib/api';
import { useRouter } from 'next/navigation';
import { useHydration, useLocalStorage } from '../hooks/useHydration';
import { useSubscription } from '../hooks/useSubscription';
import { useDashboard } from '../hooks/useDashboard';

// Dynamic imports for better performance
const MarkdownRenderer = dynamic(() => import('./MarkdownRenderer'), {
  loading: () => <div className="loading-placeholder">Loading...</div>,
  ssr: false
});

const TypingRenderer = dynamic(() => import('./TypingRenderer'), {
  loading: () => <div className="loading-placeholder">Loading...</div>,
  ssr: false
});
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLayout } from '../context/LayoutContext';
 
const quickQuestions = [
  'What is Phase I metabolism?',
  'Difference between syrup and elixir?',
  'How do beta-blockers affect heart rate?',
  'What are the side effects of aspirin?',
  'How to calculate drug dosage?',
  'What is bioavailability?'
];
 
const getWelcomeMessage = (isLogin) => ({
  type: 'ai',
  text: isLogin
    ? `Hi! I'm your AI tutor. I'm here to help you with your B.Pharmacy studies, provide exam tips, and make learning more effective. What would you like to know?`
    : `Welcome! I'm your AI tutor. Please log in to start asking questions about your Pharmacy studies.`,
  isWelcome: true,
  isNew: false,
  liked: false,
  unliked: false,
  bookmarked: false,
});
 
const AskAI = () => {
  const router = useRouter();
  const { isHydrated } = useHydration();
  const { setShowUpgrade } = useLayout();
  const [token] = useLocalStorage('token');
  const { subscriptionStatus } = useSubscription();
  const { user } = useAuth() || { user: null };
  const { isDarkMode, toggleTheme } = useTheme();
  
  // Get user ID for streak fetching (same as navbar)
  const userId = user?.mobile || (typeof window !== 'undefined' ? localStorage.getItem('mobile') : null);
  
  // Fetch streak data using the same hook as navbar
  const { dailyStreak, isLoading: streakLoading } = useDashboard(userId);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [chat, setChat] = useState([]);
  const chatAreaRef = useRef(null);
  const [welcomeAnimated, setWelcomeAnimated] = useState(false);
  const [showQuickAccessPrompts, setShowQuickAccessPrompts] = useState(false);
  const [queryCount, setQueryCount] = useState(0);
  const [queryUsageLoaded, setQueryUsageLoaded] = useState(false);
  
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

  const hasProAccess = accessInfo.isPro;

  const planLimit = useMemo(() => {
    const planId = (subscriptionStatus?.subscription_status || '').toLowerCase();
    const status = (subscriptionStatus?.status || '').toLowerCase();

    const isProTier = planId.includes('pro') || status.includes('pharma pro') || status === 'pro';
    const isPlusTier = !isProTier && (planId.includes('plus') || status.includes('pharma plus') || status === 'plus');

    if (isProTier) return 20;
    if (isPlusTier) return 2;

    return 5;
  }, [subscriptionStatus]);

  const remainingQueries = useMemo(() => {
    if (planLimit == null) return null;
    return Math.max(planLimit - queryCount, 0);
  }, [planLimit, queryCount]);
 
  const hasExhaustedQueries = useMemo(() => {
    if (planLimit == null) return false;
    return queryCount >= planLimit;
  }, [planLimit, queryCount]);

  // Check if Ask AI should be locked - lock only after usage limits are exhausted
  const isAITutorLocked = useMemo(() => {
    if (!token) {
      return false;
    }
    return hasExhaustedQueries;
  }, [token, hasExhaustedQueries]);
  
  // Debug logging
  console.log('🔍 AskAI subscription check:', {
    subscriptionStatus,
    trial_expired: subscriptionStatus?.trial_expired,
    status: subscriptionStatus?.status,
    subscription_status: subscriptionStatus?.subscription_status,
    has_subscription: subscriptionStatus?.has_subscription,
    is_active: subscriptionStatus?.is_active,
    plan_name: subscriptionStatus?.plan_name,
    accessInfo,
    hasProAccess,
    isAITutorLocked,
    token: token ? 'present' : 'missing'
  });

  // Additional debugging for premium users
  if (hasProAccess) {
    console.log('🎯 PREMIUM USER DETECTED:', {
      status: subscriptionStatus?.status,
      subscription_status: subscriptionStatus?.subscription_status,
      has_subscription: subscriptionStatus?.has_subscription,
      is_active: subscriptionStatus?.is_active,
      plan_id: subscriptionStatus?.subscription_status,
      isAITutorLocked,
      isLocked: isAITutorLocked
    });
  }

  useEffect(() => {
    if (queryUsageLoaded) return;
    if (!token) return;

    const fetchUsage = async () => {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';
        const res = await fetch(`${baseUrl}/api/ai/query-count`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!res.ok) {
          setQueryUsageLoaded(true);
          return;
        }

        const data = await res.json();
        if (typeof data.query_count === 'number') {
          setQueryCount(Number(data.query_count));
        } else if (typeof data.remaining === 'number' && typeof data.limit === 'number') {
          setQueryCount(Math.max(Number(data.limit) - Number(data.remaining), 0));
        }
      } catch (err) {
        console.error('AskAI: Failed to fetch initial AI query usage', err);
      } finally {
        setQueryUsageLoaded(true);
      }
    };

    fetchUsage();
  }, [token, queryUsageLoaded]);
 
  // Section management
  const sectionId = 'ask-ai-main';
  const { isRestored, getSavedSection, clearSavedProgress } = useChatSectionManager(
    sectionId,
    chat,
    input,
    setChat,
    setInput,
    showQuickAccessPrompts,
    setShowQuickAccessPrompts,
    !isNavigating // Disable section management when navigating
  );
 
  // Initialize chat on mount
  useEffect(() => {
    if (!isHydrated) return;
   
    if (!isRestored) {
      if (token) {
        setChat([getWelcomeMessage(true)]);
        setShowQuickAccessPrompts(false);
      } else {
        setChat([getWelcomeMessage(false)]);
        setShowQuickAccessPrompts(false);
      }
    } else {
      // Clean up isNew property from restored messages
      setChat(prev => prev.map(msg => {
        const { isNew, ...cleanMsg } = msg;
        return cleanMsg;
      }));
      
      setShowQuickAccessPrompts(false);
    }
  }, [isHydrated, isRestored, token]);
 
  // Animated onboarding for welcome message
  useEffect(() => {
    setWelcomeAnimated(true);
  }, []);

  // Listen for streak updates from other components (same as navbar)
  useEffect(() => {
    const handleStreakUpdate = (event) => {
      console.log('🔥 AskAI received streak update:', event.detail);
      // The streak will be automatically updated by the useDashboard hook
    };

    window.addEventListener('streak-updated', handleStreakUpdate);
    return () => window.removeEventListener('streak-updated', handleStreakUpdate);
  }, []);
 
  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleBackToHome = () => {
    setIsNavigating(true);
    router.replace('/dashboard');
    
    // Reset navigation state after a shorter timeout
    setTimeout(() => {
      setIsNavigating(false);
    }, 1500);
  };

  const handleProfileClick = () => {
    router.push('/Profile');
  };
 
  const sendQuestion = async (question) => {
    if (!question.trim()) return;
    setShowQuickAccessPrompts(false);
    
    // Check if Ask AI is locked due to usage limits
    if (isAITutorLocked) {
      const effectiveLimit = planLimit ?? 20;
      setChat(prev => [
        ...prev.filter(msg => !msg.isWelcome),
        { type: 'user', text: question },
        {
          type: 'ai',
          text: `🔒 You have used all ${effectiveLimit} AI queries. Upgrade to Pharma Pro to continue with higher limits.`,
          isWelcome: false,
          liked: false,
          unliked: false,
          bookmarked: false,
        }
      ]);
      return;
    }
    
    if (!token) {
      setChat(prev => [
        ...prev.filter(msg => !msg.isWelcome),
        { type: 'user', text: question },
        {
          type: 'ai',
          text: 'Please log in to use the AI assistant. Redirecting you to the login page...',
          isWelcome: false,
          liked: false,
          unliked: false,
          bookmarked: false,
        }
      ]);
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
      return;
    }
   
    // At this point, user has Pro access and a valid token. Apply shared AI limits.
    setChat(prev => prev.filter(msg => !msg.isWelcome));
    setChat(prev => [
      ...prev,
      { type: 'user', text: question }
    ]);

    // Shared AI query limit with AI Tutor (Free/Plus/Pro)
    try {
      const usage = await aiAPI.incrementQueryCount();
      if (usage) {
        if (typeof usage.query_count === 'number') {
          setQueryCount(Number(usage.query_count));
        } else if (typeof usage.remaining === 'number' && typeof usage.limit === 'number') {
          setQueryCount(Math.max(Number(usage.limit) - Number(usage.remaining), 0));
        } else {
          setQueryCount(prev => prev + 1);
        }
      }
      if (usage?.locked) {
        const effectiveLimit = usage?.limit ?? 20;
        setChat(prev => [
          ...prev,
          {
            type: 'ai',
            text: `🔒 You have used all ${effectiveLimit} AI queries. Upgrade to Pharma Pro to continue with higher limits.`,
            isWelcome: false,
            liked: false,
            unliked: false,
            bookmarked: false,
          }
        ]);
        return;
      }
    } catch (error) {
      console.error('AskAI: Failed to increment AI query count', error);
      // If the limit check fails, allow the question to proceed without blocking Ask AI
    }

    setIsLoading(true);
    setChat(prev => [
      ...prev,
      {
        type: 'ai',
        text: 'Thinking...',
        isLoading: true,
        liked: false,
        unliked: false,
        bookmarked: false,
      }
    ]);
   
    let aiText = '';
    try {
      const data = await askQuestion(question, {
        jwtToken: token
      });
      aiText = data.answer || data.response || "No answer received.";

      if (token) {
        logAIQuery(question, {
          jwtToken: token
        });
      }
    } catch (err) {
      if (err.message === 'No authentication token found' || err.message === 'Session expired') {
        aiText = "Your session has expired. Please log in again.";
        typeof window !== 'undefined' ? localStorage.removeItem('token') : null;
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        aiText = "Error: " + err.message;
      }
    }
   
    setIsLoading(false);
    setChat(prev => [
      ...prev.filter(msg => !msg.isLoading),
      {
        type: 'ai',
        text: aiText,
        isWelcome: false,
        isNew: true,
        liked: false,
        unliked: false,
        bookmarked: false,
      }
    ]);
  };
 
  const handleAskClick = async () => {
    if (!input.trim()) return;
    await sendQuestion(input);
    setInput('');
  };
 
  const handleInputKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (!token) {
        window.location.href = '/login';
        return;
      }
      handleAskClick();
    }
  };
 
  const handleQuickQuestion = async (question) => {
    await sendQuestion(question);
  };
 
  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    if (chatAreaRef.current) {
      const scrollToBottom = () => {
        chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight;
      };
      requestAnimationFrame(scrollToBottom);
    }
  }, [chat]);
 
  const formatTime = () => {
    const now = new Date();
    return now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };
 
  return (
    <div className={styles.askaiContainer}>
      {/* Header */}
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={handleBackToHome}
          disabled={isNavigating}
          aria-label="Go back to dashboard"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}>
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          {isNavigating ? 'Loading...' : 'Back'}
        </button>
       
        <div className={styles.aiTutorProfile}>
          <div className={styles.aiTutorAvatar}>
            <span className={styles.aiTutorIcon}>✨</span>
          </div>
          <div className={styles.aiTutorInfo}>
            <h1>AI Tutor</h1>
            <p>Your personal learning assistant</p>
          </div>
        </div>
       
        <div className={styles.headerActions}>
          <button
            className={styles.profileButton}
            aria-label="Toggle theme"
            onClick={toggleTheme}
            title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDarkMode ? (
              // Sun icon for light mode
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              // Moon icon for dark mode
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          <div className={styles.actionItem}>
            <span className={styles.actionNumber}>{dailyStreak?.streak || 0}</span>
            <svg
              className={styles.actionIcon}
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
          <div className={styles.userProfile}>
            <button
              className={styles.profileButton}
              aria-label="Profile"
              onClick={handleProfileClick}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Locked State */}
      {isAITutorLocked && (
        <div className={styles.lockedArea}>
          <div className={styles.lockedContent}>
            <div className={styles.lockedIcon}>🔒</div>
            <h3 className={styles.lockedTitle}>AI Tutor Locked</h3>
            <p className={styles.lockedMessage}>
              {hasExhaustedQueries && planLimit != null
                ? `You have used all ${planLimit} AI queries available on your current plan.`
                : 'Ask AI is currently locked for your account.'}
            </p>
            <p className={styles.lockedSubMessage}>Upgrade to Pharma Pro to get higher daily limits and the full AI Tutor experience.</p>
            <button
              className={styles.upgradeButton}
              onClick={() => setShowUpgrade(true)}
            >
              Upgrade to Pharma Pro
            </button>
          </div>
        </div>
      )}
 
      {/* Chat Content */}
      <div className={styles.chatContent}>
        {!hasProAccess && remainingQueries !== null && planLimit !== null && (
          <div className={styles.queryPillContainer}>
            <div className={styles.queryPill}>
              {`${remainingQueries} / ${planLimit} queries left today`}
            </div>
          </div>
        )}
        <div className={styles.chatArea} ref={chatAreaRef} role="log" aria-live="polite" aria-label="Chat messages">
          {/* Welcome Message */}
          {chat.length === 1 && chat[0].isWelcome && (
            <div className={`${styles.welcomeMessage} ${welcomeAnimated ? styles.animated : ''}`}>
              <div className={styles.aiAvatar}>
                <span className={styles.aiIcon}>✨</span>
              </div>
              <div className={styles.messageBubble}>
                <MarkdownRenderer answer={chat[0].text} />
                <span className={styles.messageTime}>{formatTime()}</span>
              </div>
            </div>
          )}
 
          {/* Chat Messages */}
          {chat.length > 1 && chat.map((msg, idx) => (
            msg.type === 'ai' ? (
              <div key={idx} className={styles.aiMessage}>
                <div className={styles.aiAvatar}>
                  <span className={styles.aiIcon}>✨</span>
                </div>
                <div className={styles.messageBubble}>
                  {msg.isLoading ? (
                    <div className={styles.thinkingMessage}>
                      <span>Thinking</span>
                      <span className={styles.dots}>...</span>
                    </div>
                  ) : msg.isNew === true ? (
                    <TypingRenderer 
                      text={msg.text} 
                      speed={15}
                      showCursor={!msg.text.startsWith('Error:')}
                      onComplete={() => {
                        // Mark message as no longer new after typing completes
                        setChat(prev => prev.map((m, i) => 
                          i === idx ? { ...m, isNew: false } : m
                        ));
                      }}
                    />
                  ) : (
                    <MarkdownRenderer answer={msg.text} />
                  )}
                  <span className={styles.messageTime}>{formatTime()}</span>
                </div>
              </div>
            ) : (
              <div key={idx} className={styles.userMessage}>
                <div className={styles.messageBubble}>
                  <p>{msg.text}</p>
                </div>
                <div className={styles.userAvatar}>
                  <span className={styles.userIcon}>👤</span>
                </div>
              </div>
            )
          ))}
        </div>
 
        {/* Quick Access Prompts */}
        {showQuickAccessPrompts && !isAITutorLocked && (
          <div className={styles.quickAccess}>
            {quickQuestions.slice(0, 3).map((question, idx) => (
              <button
                key={idx}
                className={styles.quickAccessButton}
                onClick={() => handleQuickQuestion(question)}
              >
                {question}
              </button>
            ))}
          </div>
        )}
 
        {/* Input Bar */}
        <div className={styles.inputBar}>
          <input
            className={styles.input}
            type="text"
            placeholder={isAITutorLocked ? "AI Tutor is locked - upgrade to continue" : "Ask me anything about B.Pharmacy, exam tips, or study strategies..."}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleInputKeyDown}
            disabled={isLoading || !token || isAITutorLocked}
            aria-label="Ask AI a question"
            aria-describedby="input-help"
          />
          <button
            className={styles.sendButton}
            onClick={token ? handleAskClick : () => window.location.href = '/login'}
            disabled={isLoading || (!input.trim() && token) || isAITutorLocked}
            aria-label="Send message"
          >
            <svg className={styles.sendIcon} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"></line>
              <polygon points="22,2 15,22 11,13 2,9"></polygon>
            </svg>
          </button>
        </div>
 
        {/* Side Effect Warning */}
        <div className={styles.sideEffectWarning}>
          <span className={styles.warningIcon}>⚠️</span>
          <span>Side effect: talking to me may improve your grades & boost your confidence.</span>
        </div>
      </div>
 
    </div>
  );
};
 
export default AskAI;
 

