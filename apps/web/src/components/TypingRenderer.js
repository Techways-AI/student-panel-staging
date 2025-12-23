import React, { useState, useEffect } from 'react';
import styles from './AskAI.module.css';

// Only import MarkdownRenderer in production
let MarkdownRenderer = null;
if (process.env.NODE_ENV === 'production') {
  MarkdownRenderer = require('./MarkdownRenderer').default;
}

const TypingRenderer = ({ text, speed = 30, onComplete, showCursor = true }) => {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!text || currentIndex >= text.length) {
      setIsTyping(false);
      if (onComplete) onComplete();
      return;
    }

    const timer = setTimeout(() => {
      setDisplayedText(text.slice(0, currentIndex + 1));
      setCurrentIndex(currentIndex + 1);
    }, speed);

    return () => clearTimeout(timer);
  }, [currentIndex, text, speed, onComplete]);

  // Reset when text changes
  useEffect(() => {
    setDisplayedText('');
    setCurrentIndex(0);
    setIsTyping(true);
  }, [text]);

  return (
    <div className={styles.typingContainer}>
      {process.env.NODE_ENV === 'development' ? (
        <div style={{ whiteSpace: 'pre-wrap' }}>{displayedText}</div>
      ) : (
        MarkdownRenderer && <MarkdownRenderer answer={displayedText} />
      )}
      {isTyping && showCursor && (
        <span className={styles.typingCursor}>|</span>
      )}
    </div>
  );
};

export default TypingRenderer;

