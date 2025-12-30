'use client';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { subjectContentAPI, studentContentAPI } from '../lib/api';
import { useTheme } from '../context/ThemeContext';
import styles from './CourseContent.module.css';
import mobileStyles from './CourseContentMobile.module.css';

// Dynamic import for MarkdownRenderer to improve initial load time
const MarkdownRenderer = dynamic(() => import('./MarkdownRenderer'), {
  loading: () => <div className="loading-placeholder">Loading content...</div>,
  ssr: false
});

const Notes = ({ currentTopic, subject, onNotesRead, onBackToVideo, onTakeQuiz, notesCompleted = false, onReadyForQuiz, registerTakeQuizButton }) => {
  const { isDarkMode } = useTheme();
  const [notesData, setNotesData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasReadNotes, setHasReadNotes] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  // Use ref for cache to avoid re-renders when cache is updated
  const notesCacheRef = useRef({});
  const isFetchingRef = useRef(false);

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track when notes are read (scrolled through)
  const handleScroll = useCallback((e) => {
    if (!hasReadNotes && onNotesRead) {
      const { scrollTop, scrollHeight, clientHeight } = e.target;
      const scrollPercentage = (scrollTop + clientHeight) / scrollHeight;
      
      // Mark as read when user scrolls through 80% of the content
      if (scrollPercentage >= 0.8) {
        setHasReadNotes(true);
        onNotesRead();
        if (typeof onReadyForQuiz === 'function') {
          onReadyForQuiz();
        }
      }
    }
  }, [hasReadNotes, onNotesRead, onReadyForQuiz]);

  // Reset read status when topic changes
  useEffect(() => {
    setHasReadNotes(false);
  }, [currentTopic?.title]);

  // Memoize the props to prevent unnecessary re-renders
  const memoizedProps = useMemo(() => ({
    currentTopic,
    subject
  }), [currentTopic?.title, subject?.fullPath]);

  // Debug logging
  console.log('🔍 Notes component props:', memoizedProps);

  // Fetch notes - Using ref for cache to avoid re-renders
  useEffect(() => {
    if (!currentTopic || !subject) {
      setNotesData(null);
      return;
    }

    // Create cache key from topic and subject
    const cacheKey = `${subject.fullPath || subject.fullTitle}-${currentTopic.title}`;
    
    // Check cache first - prevents repeated API calls
    if (notesCacheRef.current[cacheKey]) {
      console.log('📦 Using cached notes for:', cacheKey);
      setNotesData(notesCacheRef.current[cacheKey]);
      setIsLoading(false);
      return;
    }

    // Prevent multiple simultaneous fetches for the same key
    if (isFetchingRef.current === cacheKey) {
      console.log('⏳ Already fetching notes for:', cacheKey);
      return;
    }

    let isMounted = true; // Prevent state updates if component unmounts
    isFetchingRef.current = cacheKey; // Mark as fetching

    const fetchNotes = async () => {
      setIsLoading(true);
      setError(null);

      try {
        console.log(`📖 Notes.js: Fetching for topic='${currentTopic.title}'`);
        
        // NEW: Try the robust student content API first
        const studentContent = await studentContentAPI.getTopicContent(currentTopic.title, 'notes');
        console.log('📖 Notes.js: studentContentAPI response:', studentContent);
        
        if (studentContent && studentContent.items && studentContent.items.length > 0) {
          const item = studentContent.items[0];
          console.log('📖 Notes.js: Found item in studentContent:', item);
          
          if (item.notes_content) {
            console.log('📖 Notes.js: Using notes_content from studentContentAPI');
            const robustResponse = {
              found: true,
              notes_content: item.notes_content,
              subject: subject.fullTitle,
              topic: currentTopic.title,
              from_s3: true
            };
            notesCacheRef.current[cacheKey] = robustResponse;
            setNotesData(robustResponse);
            setIsLoading(false);
            isFetchingRef.current = false;
            return;
          } else if (item.video_url) {
            // This is likely a PDF or other document file returned via proxy
            console.log('📖 Notes.js: Found document URL instead of text content:', item.video_url);
            const robustResponse = {
              found: true,
              notes_content: `[Click here to view the notes document](${item.video_url})`,
              subject: subject.fullTitle,
              topic: currentTopic.title,
              from_s3: true,
              is_file: true,
              file_url: item.video_url
            };
            notesCacheRef.current[cacheKey] = robustResponse;
            setNotesData(robustResponse);
            setIsLoading(false);
            isFetchingRef.current = false;
            return;
          } else {
            console.log('📖 Notes.js: Item found but both notes_content and video_url are missing');
          }
        } else {
          console.log('📖 Notes.js: No items found in studentContentAPI');
        }

        // Fallback to existing logic if new API doesn't return content
        console.log('📖 Notes.js: Trying fallback subjectContentAPI.getNotesBySubjectAndTopic');
        const notesResponse = await subjectContentAPI.getNotesBySubjectAndTopic(
          subject.fullTitle,
          currentTopic.title
        );
        
        if (!isMounted) return;
        console.log('📖 Notes response:', notesResponse);

        if (notesResponse.found) {
          // Cache the response to prevent future API calls (using ref, not state)
          notesCacheRef.current[cacheKey] = notesResponse;
          setNotesData(notesResponse);
        } else {
          // Fallback to the original two-step process if direct lookup fails
          console.log('🔄 Direct lookup failed, trying document ID approach...');
          
          if (!subject?.fullPath) {
            console.error('❌ Subject fullPath is undefined:', subject);
            setError('Subject path information is missing. Please try refreshing the page.');
            setNotesData(null);
            return;
          }
          
          if (!currentTopic?.title) {
            console.error('❌ Current topic title is undefined:', currentTopic);
            setError('Topic information is missing. Please try refreshing the page.');
            setNotesData(null);
            return;
          }
          
          const fullPath = `${subject.fullPath}/${currentTopic.title}`;
          console.log('🔍 Fetching document ID for path:', fullPath);
          
          const documentIdResponse = await subjectContentAPI.getDocumentId(fullPath);
          if (!isMounted) return;
          console.log('📄 Document ID response:', documentIdResponse);
          
          if (documentIdResponse.document_id) {
            console.log('🔍 Fetching notes for document ID:', documentIdResponse.document_id);
            
            const fallbackNotesResponse = await subjectContentAPI.getNotesByDocumentId(documentIdResponse.document_id);
            if (!isMounted) return;
            console.log('📖 Fallback notes response:', fallbackNotesResponse);

            if (fallbackNotesResponse.found) {
              // Cache the fallback response (using ref, not state)
              notesCacheRef.current[cacheKey] = fallbackNotesResponse;
              setNotesData(fallbackNotesResponse);
            } else {
              setError('No notes available for this topic yet.');
              setNotesData(null);
            }
          } else {
            console.log('❌ No document ID found for path:', fullPath);
            setError('No document found for this topic.');
            setNotesData(null);
          }
        }
      } catch (err) {
        if (!isMounted) return;
        console.error(' Error fetching notes:', err);
        setError('Failed to load notes. Please try again.');
        setNotesData(null);
      } finally {
        if (isMounted) {
          setIsLoading(false);
          isFetchingRef.current = false; // Clear fetching flag
        }
      }
    };

    fetchNotes();

    // Cleanup function to prevent state updates after unmount
    return () => {
      isMounted = false;
      if (isFetchingRef.current === cacheKey) {
        isFetchingRef.current = false;
      }
    };
  }, [currentTopic?.title, subject?.fullPath]); // ONLY topic/subject changes trigger this

  if (isLoading) {
    return (
      <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage'] : styles.notesContainer} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
        <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-content'] : styles.notesContent} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
          <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-body'] : ''} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
            <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-text'] : ''} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
              <div className={styles.loadingSpinner} />
              <p>Loading notes...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage'] : styles.notesContainer} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
        <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-content'] : styles.notesContent} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
          {!isMobile && <h4>Notes for {currentTopic?.title}</h4>}
          <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-body'] : styles.errorMessage} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
            <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-text'] : ''} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
              <p>{error}</p>
              <p className={`${styles.notesHint} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>
                Notes will be generated automatically when you upload documents for this topic.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderNotesContent = (hasContent = false) => (
    <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage'] : styles.notesContainer} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
      {/* Mobile Header with Back Button */}
      {isMobile && (
        <div className={`${mobileStyles['mobile-notes-header']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}>
          <button 
            onClick={onBackToVideo}
            className={`${mobileStyles['mobile-notes-back-button']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Video
          </button>
          <h4 className={`${mobileStyles['mobile-notes-title']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}>
            Notes: {currentTopic?.title}
          </h4>
        </div>
      )}
      
      <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-content'] : styles.notesContent} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
        {!isMobile && hasContent && (
          <div className={`${isMobile ? mobileStyles['mobile-notes-header'] : styles.notesHeader} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
            <h4>Notes for {notesData?.filename || currentTopic?.title}</h4>
            <div className={`${isMobile ? mobileStyles['mobile-notes-meta'] : styles.notesMeta} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
              <span className={`${styles.notesSubject} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>{notesData?.subject}</span>
              <span className={`${styles.notesUnit} ${isDarkMode ? styles.darkTheme : styles.lightTheme}`}>{notesData?.unit}</span>
            </div>
          </div>
        )}
        {!isMobile && !hasContent && <h4>Notes for {currentTopic?.title}</h4>}
        
        <div 
          className={`${isMobile ? mobileStyles['mobile-notes-fullpage-body'] : styles.notesBody} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}
          onScroll={handleScroll}
        >
          {hasContent && notesData?.is_file ? (
            <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-text'] : styles.notesText} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`} style={{ height: '100%', minHeight: '500px' }}>
              <iframe 
                src={notesData.file_url} 
                width="100%" 
                height="100%" 
                style={{ border: 'none', borderRadius: '8px', minHeight: '600px' }}
                title="Notes Document"
              />
              <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                <a href={notesData.file_url} target="_blank" rel="noopener noreferrer" className={styles.nextButton} style={{ display: 'inline-flex' }}>
                  📥 Download / View in New Tab
                </a>
              </div>
            </div>
          ) : hasContent && notesData?.notes_content ? (
            <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-text'] : styles.notesText} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
              <MarkdownRenderer answer={notesData.notes_content} isUser={false} />
            </div>
          ) : (
            <div className={`${isMobile ? mobileStyles['mobile-notes-fullpage-text'] : ''} ${isDarkMode ? (isMobile ? mobileStyles['darkTheme'] : styles.darkTheme) : (isMobile ? mobileStyles['lightTheme'] : styles.lightTheme)}`}>
              <p>{hasContent ? 'No notes content available.' : 'No notes available for this topic yet.'}</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Mobile Bottom Quiz Button */}
      {isMobile && (
        <div className={`${mobileStyles['mobile-notes-bottom-bar']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}>
          <button
            ref={registerTakeQuizButton}
            onClick={onTakeQuiz}
            className={`${mobileStyles['mobile-notes-quiz-button']} ${isDarkMode ? mobileStyles['darkTheme'] : mobileStyles['lightTheme']}`}
            disabled={!hasReadNotes && !notesCompleted}
            style={{
              backgroundColor: (hasReadNotes || notesCompleted) ? undefined : '#9ca3af',
              cursor: (hasReadNotes || notesCompleted) ? 'pointer' : 'not-allowed',
              opacity: (hasReadNotes || notesCompleted) ? 1 : 0.7,
              animation: (hasReadNotes || notesCompleted) ? 'pulse 2s infinite' : 'none'
            }}
          >
            {(hasReadNotes || notesCompleted) ? 'Take Quiz →' : 'Complete Notes First'}
          </button>
        </div>
      )}
    </div>
  );

  if (!notesData) {
    const content = renderNotesContent(false);
    return isMobile && typeof window !== 'undefined' 
      ? createPortal(content, document.body)
      : content;
  }

  const content = renderNotesContent(true);
  return isMobile && typeof window !== 'undefined' 
    ? createPortal(content, document.body)
    : content;
};

export default Notes;













