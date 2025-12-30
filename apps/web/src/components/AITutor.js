import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from '../context/ThemeContext';
import { useLayout } from '../context/LayoutContext';
import styles from './AITutor.module.css';
import { aiAPI } from '../lib/api';
import { sanitizeError, logTechnicalError } from '../utils/errorHandler';
 
// Dynamic import for MarkdownRenderer to improve initial load time
const MarkdownRenderer = dynamic(() => import('./MarkdownRenderer'), {
  loading: () => <div className="loading-placeholder">Loading...</div>,
  ssr: false
});
 
const DEFAULT_QUERY_LIMIT = 20;
 
const AITutor = ({ selectedTopic, documentContent, currentDocumentId, learningSubject, subjectCode, activeYear, activeSemester, subscriptionStatus, subscriptionData }) => {
  const { isDarkMode } = useTheme();
  const { setShowUpgrade } = useLayout();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [error, setError] = useState(null);
  const [queryCount, setQueryCount] = useState(0);
  const [queryUsageLoaded, setQueryUsageLoaded] = useState(false);

  const inputRef = useRef(null);
  const messagesAreaRef = useRef(null);

  const isProPlan = useMemo(() => {
    const planId = (subscriptionStatus?.subscription_status || '').toLowerCase();
    const tier = (subscriptionStatus?.tier || '').toLowerCase();
    return !!subscriptionStatus?.is_pro || planId.includes('pro') || tier === 'pro';
  }, [subscriptionStatus]);

  const effectiveSubjectCode = useMemo(() => {
    if (subjectCode) return subjectCode;
    if (learningSubject && typeof learningSubject === 'string') {
      const codePart = learningSubject.split(':')[0]?.trim();
      if (codePart) return codePart;
    }
    if (selectedTopic?.subjectCode) {
      return selectedTopic.subjectCode;
    }
    return '';
  }, [subjectCode, learningSubject, selectedTopic]);

  const normalizedSubjectCode = useMemo(() => (effectiveSubjectCode || '').toLowerCase(), [effectiveSubjectCode]);

  const accessibleSubjects = useMemo(() => {
    const subjects = subscriptionStatus?.accessible_subjects;
    if (!Array.isArray(subjects)) return [];
    return subjects.map(code => (code || '').toLowerCase());
  }, [subscriptionStatus]);

  const isSubjectBasedPlan = useMemo(() => {
    const status = (subscriptionStatus?.status || '').toLowerCase();
    const subStatus = (subscriptionStatus?.subscription_status || '').toLowerCase();
    return status === 'subject_based' || subStatus === 'subject_based' || status.includes('subject');
  }, [subscriptionStatus]);

  const hasUnlimitedSubjectAccess = useMemo(() => {
    if (!isSubjectBasedPlan) return false;
    if (!normalizedSubjectCode) return false;
    return accessibleSubjects.includes(normalizedSubjectCode);
  }, [isSubjectBasedPlan, accessibleSubjects, normalizedSubjectCode]);

  const hasUnlimitedAccess = useMemo(() => {
    const unlimited = hasUnlimitedSubjectAccess;
    if (process.env.NODE_ENV !== 'production') {
      console.debug('AITutor access evaluation', {
        subjectCode,
        effectiveSubjectCode,
        normalizedSubjectCode,
        accessibleSubjects,
        isProPlan,
        isSubjectBasedPlan,
        hasUnlimitedSubjectAccess,
        unlimited
      });
    }
    return unlimited;
  }, [hasUnlimitedSubjectAccess, subjectCode, effectiveSubjectCode, normalizedSubjectCode, accessibleSubjects, isSubjectBasedPlan]);

  useEffect(() => {
    if (queryUsageLoaded) return;
    if (hasUnlimitedAccess) {
      setQueryUsageLoaded(true);
      return;
    }

    let token = null;
    if (typeof window !== 'undefined') {
      token = localStorage.getItem('token');
    }

    if (!token) {
      setQueryUsageLoaded(true);
      return;
    }

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
        console.error('AITutor: Failed to fetch initial AI query usage', err);
      } finally {
        setQueryUsageLoaded(true);
      }
    };

    fetchUsage();
  }, [hasUnlimitedAccess, queryUsageLoaded]);

  // Plan-specific limits: free = 5 (lifetime), plus = 2/day, pro = 20/day
  const planLimit = useMemo(() => {
    if (hasUnlimitedAccess) return null;

    const planId = (subscriptionStatus?.subscription_status || '').toLowerCase();
    const status = (subscriptionStatus?.status || '').toLowerCase();

    const isProTier = planId.includes('pro') || status.includes('pharma pro') || status === 'pro';
    const isPlusTier = !isProTier && (planId.includes('plus') || status.includes('pharma plus') || status === 'plus');

    if (isProTier) return 20;
    if (isPlusTier) return 2;

    // Free / unknown plans
    return 5;
  }, [subscriptionStatus, hasUnlimitedAccess]);

  // Check if AI Tutor should be locked for non-unlimited plans
  // Use SAME logic as AskAI component to ensure consistency
  const isAITutorLocked = useMemo(() => {
    // If subscription status is still loading (null values), don't lock
    if (subscriptionStatus?.status === null || subscriptionStatus?.has_subscription === null) {
      return false;
    }

    // Users with subject-based unlimited access have access
    if (hasUnlimitedAccess) {
      return false;
    }

    if (planLimit === null) {
      return false;
    }

    return queryCount >= planLimit;
  }, [subscriptionStatus, hasUnlimitedAccess, queryCount, planLimit]);

  const hasExhaustedQueries = !hasUnlimitedAccess && planLimit !== null && queryCount >= planLimit;
  const remainingQueries = hasUnlimitedAccess || planLimit === null ? null : Math.max(planLimit - queryCount, 0);

  const incrementQueryCount = useCallback(async () => {
    if (hasUnlimitedAccess) {
      return { locked: false, query_count: queryCount, remaining: null, limit: null, period: null };
    }
    try {
      const data = await aiAPI.incrementQueryCount();
      setQueryCount(Number(data?.query_count || 0));
      return data;
    } catch (e) {
      // If the increment call fails, do not block asking; keep previous count
      return {
        locked: false,
        query_count: queryCount,
        remaining: planLimit !== null ? Math.max(planLimit - queryCount, 0) : null,
        limit: planLimit ?? DEFAULT_QUERY_LIMIT,
        period: null
      };
    }
  }, [hasUnlimitedAccess, queryCount, planLimit]);

  // Memoized values for better performance
  const hasValidContext = useMemo(() => {
    const valid = selectedTopic && currentDocumentId;
    console.log('🔍 AITutor hasValidContext:', {
      selectedTopic: !!selectedTopic,
      currentDocumentId: !!currentDocumentId,
      documentContent: !!documentContent,
      learningSubject: !!learningSubject,
      activeYear: !!activeYear,
      activeSemester: !!activeSemester,
      valid
    });
    return valid;
  }, [selectedTopic, documentContent, currentDocumentId]);

  // Auto-scroll to bottom when new messages are added
  const scrollToBottom = useCallback(() => {
    if (messagesAreaRef.current) {
      messagesAreaRef.current.scrollTop = messagesAreaRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Fetch prompt suggestions with better error handling - DISABLED
  useEffect(() => {
    // Disabled suggestions fetching to improve performance
    setSuggestions([]);
    setShowSuggestions(false);
    setIsSuggestionsLoading(false);
    setError(null);

    /* Original suggestions fetching logic - commented out
    if (hasValidContext) {
      setIsSuggestionsLoading(true);
      setSuggestions([]);
      setShowSuggestions(true);
      setError(null);

      const fetchSuggestions = async () => {
        try {
          let token = null;
          if (typeof window !== 'undefined') {
            token = localStorage.getItem('token');
          }

          if (!token) {
            console.warn('AITutor: No token available for suggestions');
            setSuggestions([]);
            return;
          }

          const data = await aiAPI.suggestPrompts({
            topic: selectedTopic?.title || "",
            fileName: selectedTopic?.files?.[0]?.name || "",
            document_id: currentDocumentId
          });

          setSuggestions(Array.isArray(data.prompts) ? data.prompts : []);
        } catch (err) {
          console.error('AITutor: Error fetching suggestions:', err);
          // Provide fallback suggestions when API is not available
          const fallbackSuggestions = [
            `What are the key concepts in ${selectedTopic?.title || 'this topic'}?`,
            `Can you explain ${selectedTopic?.title || 'this topic'} in simpler terms?`,
            `What are some important points to remember about ${selectedTopic?.title || 'this topic'}?`,
            `How can I better understand ${selectedTopic?.title || 'this topic'}?`
          ];
          setSuggestions(fallbackSuggestions);
          setError('Using fallback suggestions - AI service is being configured');
        } finally {
          setIsSuggestionsLoading(false);
        }
      };

      fetchSuggestions();
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
      setIsSuggestionsLoading(false);
      setError(null);
    }
    */
  }, [hasValidContext, selectedTopic, currentDocumentId]);

  // Initialize with welcome message when document content changes
  useEffect(() => {
    let newMessages = [];

    if (selectedTopic) {
      const currentFile = selectedTopic.files?.[0];

      if (currentDocumentId) {
        newMessages = [
          {
            id: 'welcome',
            type: 'ai',
            content: `Hello! I'm your AI tutor for **${selectedTopic.title}**.`,
            timestamp: new Date().toISOString()
          }
        ];
      } else {
        newMessages = [
          {
            id: 'welcome-no-doc',
            type: 'ai',
            content: `Hello! I'm your AI tutor for **${selectedTopic.title}**. I'm here to help you with any questions you have about this topic.

What would you like to know about ${selectedTopic.title}?`,
            timestamp: new Date().toISOString()
          }
        ];
      }
    } else {
      newMessages = [
        {
          id: 'welcome-general',
          type: 'ai',
          content: `Hello! I'm your AI tutor. I'm here to help you with your studies.`,
          timestamp: new Date().toISOString()
        }
      ];
    }

    setMessages(newMessages);
  }, [selectedTopic, documentContent, currentDocumentId]);

  // Handle sending messages with better error handling
  const handleSendMessage = useCallback(async (messageContent) => {
    if (!messageContent.trim() || isLoading) return;

    // Check if AI Tutor is locked due to plan limits
    if (isAITutorLocked) {
      const effectiveLimit = planLimit ?? DEFAULT_QUERY_LIMIT;
      const lockedMessageText = hasExhaustedQueries
        ? `🔒 You have used all ${effectiveLimit} AI Tutor queries. Upgrade to Pharma Pro to continue with higher limits.`
        : '🔒 AI Tutor is locked for your current plan. Upgrade to Pharma Pro to continue using all AI features.';
      const lockedMessage = {
        id: Date.now().toString(),
        type: 'ai',
        content: lockedMessageText,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, lockedMessage]);
      return;
    }

    console.log('🚀 AITutor: Sending message:', messageContent);
    console.log('📋 AITutor: Context:', {
      selectedTopic: selectedTopic?.title,
      currentDocumentId,
      learningSubject,
      activeYear,
      activeSemester,
      hasValidContext
    });

    const userMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: messageContent,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      let token = null;
      if (typeof window !== 'undefined') {
        token = localStorage.getItem('token');
      }

      if (!token) {
        throw new Error('Authentication required');
      }

      const usage = await incrementQueryCount();
      if (usage?.locked && !hasUnlimitedAccess) {
        const effectiveLimit = usage?.limit ?? planLimit ?? DEFAULT_QUERY_LIMIT;
        const lockedMessageText = `🔒 You have used all ${effectiveLimit} AI Tutor queries. Upgrade to Pharma Pro to continue with higher limits.`;
        const lockedMessage = {
          id: Date.now().toString(),
          type: 'ai',
          content: lockedMessageText,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, lockedMessage]);
        setIsLoading(false);
        return;
      }

      const response = await aiAPI.ask({
        question: messageContent,
        topic: selectedTopic?.title || "",
        fileName: selectedTopic?.files?.[0]?.name || "",
        document_id: currentDocumentId,
        learning_subject: learningSubject || "",
        active_year: activeYear || 1,
        active_semester: activeSemester || 1
      });

      console.log('✅ AITutor: API response received:', response);

      const aiMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: response.answer || 'I apologize, but I couldn\'t generate a response. Please try again.',
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      // Log technical error for debugging
      logTechnicalError(err, 'ai-tutor', {
        topic: selectedTopic?.title,
        documentId: currentDocumentId,
        messageLength: input.length
      });

      // Provide a helpful fallback response when API is not available
      const fallbackResponse = `I'm here to help you with **${selectedTopic?.title || 'this topic'}**!

Since the AI service is currently being configured, I can provide general guidance:

• **Understanding Concepts**: I can help explain key concepts in simpler terms
• **Study Tips**: I can suggest effective study strategies for this material
• **Practice Questions**: I can help you think through practice problems
• **Clarification**: I can help clarify any confusing parts of the content

What specific aspect of ${selectedTopic?.title || 'this topic'} would you like to discuss?`;

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: fallbackResponse,
        timestamp: new Date().toISOString(),
        isError: false // Not really an error, just a fallback
      };

      setMessages(prev => [...prev, errorMessage]);
      // Show user-friendly error message
      setError(sanitizeError(err, 'ai tutor'));
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, selectedTopic, currentDocumentId, learningSubject, activeYear, activeSemester, isAITutorLocked, subscriptionStatus, incrementQueryCount, hasExhaustedQueries, planLimit]);

  // Handle suggestion clicks - DISABLED
  /* const handleSuggestionClick = useCallback((suggestion) => {
    handleSendMessage(suggestion);
    setShowSuggestions(false);
  }, [handleSendMessage]); */

  // Handle form submission
  const handleSubmit = useCallback((e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      handleSendMessage(input.trim());
    }
  }, [input, isLoading, handleSendMessage]);

  // Handle input changes with debouncing
  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    setError(null);
  }, []);

  // Handle key press for better UX
  const handleKeyPress = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (input.trim() && !isLoading) {
        handleSendMessage(input.trim());
      }
    }
  }, [input, isLoading, handleSendMessage]);

  // Auto-focus input when component mounts
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <div className={`${styles.aiTutorContainer} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
      {/* AI Tutor Header */}
      <div className={`${styles.aiTutorHeader} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
        <div className={styles.aiTutorIcon}>
          <span className={styles.aiIcon}>✨</span>
        </div>
        <div className={styles.aiTutorInfo}>
          <h3 className={styles.aiTutorTitle}>AI Tutor</h3>
          <p className={styles.aiTutorSubtitle}>Always here to help</p>
        </div>
      </div>

      {remainingQueries !== null && planLimit !== null && (
        <div className={styles.queryPillWrapper}>
          <div className={styles.queryPill}>
            {`${remainingQueries} / ${planLimit} queries left today`}
          </div>
        </div>
      )}

      {/* Locked State */}
      {isAITutorLocked && (
        <div className={`${styles.lockedArea} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
          <div className={styles.lockedContent}>
            <div className={styles.lockedIcon}>🔒</div>
            <h3 className={styles.lockedTitle}>AI Tutor Locked</h3>
            <p className={styles.lockedMessage}>
              {hasExhaustedQueries
                ? `You have used all ${planLimit ?? DEFAULT_QUERY_LIMIT} AI Tutor queries.`
                : 'AI Tutor is locked for your current plan.'}
            </p>
            {!hasExhaustedQueries && (
              <p className={styles.lockedSubMessage}>Upgrade to Pharma Pro to access the AI Tutor and all features.</p>
            )}
            {hasExhaustedQueries && (
              <p className={styles.lockedSubMessage}>Upgrade to Pharma Pro for unlimited access and continued AI support.</p>
            )}
            <button
              className={styles.upgradeButton}
              onClick={() => setShowUpgrade(true)}
            >
              Upgrade to Pharma Pro
            </button>
          </div>
        </div>
      )}
 
      {/* Messages Area */}
      <div
        ref={messagesAreaRef}
        className={`${styles.messagesArea} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={`${styles.messageBubble} ${
              message.type === 'user' ? styles.userMessage : styles.aiMessage
            } ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}
          >
            <div className={styles.messageContent}>
              <MarkdownRenderer answer={message.content} isUser={message.type === 'user'} />
            </div>
            {message.isError && (
              <div className={styles.errorIndicator}>
                <span>⚠️</span>
              </div>
            )}
          </div>
        ))}
       
        {isLoading && (
          <div className={`${styles.messageBubble} ${styles.aiMessage} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
            <div className={styles.messageContent}>
              <div className={styles.loadingIndicator}>
                <div className={styles.typingDots}>
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
 
      {/* Suggestions Area - Disabled */}
      {/* {showSuggestions && suggestions.length > 0 && (
        <div className={`${styles.suggestionsArea} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
          <div className={styles.suggestionsHeader}>
            <span className={styles.suggestionsTitle}>Suggested Questions:</span>
          </div>
          <div className={styles.suggestionsList}>
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                className={`${styles.suggestionButton} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}
                onClick={() => handleSuggestionClick(suggestion)}
                disabled={isLoading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )} */}
 
      {/* Error Display */}
      {error && (
        <div className={`${styles.errorArea} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
          <div className={styles.errorMessage}>
            <span className={styles.errorIcon}>⚠️</span>
            {error}
          </div>
        </div>
      )}
 
      {/* Input Area */}
      <div className={`${styles.inputArea} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
        <form onSubmit={handleSubmit} className={styles.inputForm}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder={isAITutorLocked
              ? hasExhaustedQueries
                ? 'AI Tutor limit reached - upgrade to continue'
                : 'AI Tutor is locked - upgrade to continue'
              : remainingQueries !== null && remainingQueries <= 3
                ? `Ask your AI tutor... (${remainingQueries} left)`
                : 'Ask your AI tutor...'}
            className={styles.messageInput}
            disabled={isLoading || isAITutorLocked}
            aria-label="Type your question"
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!input.trim() || isLoading || isAITutorLocked}
            aria-label="Send message"
          >
            <svg className={styles.sendIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2L11 13M22 2L15 22L11 13M22 2L2 9L11 13" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};
 
export default AITutor;
 
 

