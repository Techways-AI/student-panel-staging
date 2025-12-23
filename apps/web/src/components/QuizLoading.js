"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import styles from './QuizLoading.module.css';

const QuizLoading = ({ 
  type = 'quiz', 
  message = 'Loading quiz questions...', 
  score = null,
  totalQuestions = null 
}) => {
  const [loadingType, setLoadingType] = useState('quiz');
  const [loadingMessage, setLoadingMessage] = useState('Loading quiz questions...');
  const [showLoading, setShowLoading] = useState(false);

  const getScoreMessage = (score, total) => {
    if (total === 0) return 'Keep practicing! 💪';
    
    const percentage = (score / total) * 100;
    
    if (percentage === 100) {
      return 'Perfect! You\'re a genius! 🧠✨';
    } else if (percentage >= 90) {
      return 'Outstanding! You\'re brilliant! 🌟';
    } else if (percentage >= 80) {
      return 'Excellent! You\'re doing great! 🎯';
    } else if (percentage >= 70) {
      return 'Great job! You\'re on the right track! 🎉';
    } else if (percentage >= 60) {
      return 'Good effort! Keep learning! 📚';
    } else if (percentage >= 50) {
      return 'Not bad! Room for improvement! 💪';
    } else if (percentage >= 40) {
      return 'Keep practicing! You can do better! 🔥';
    } else if (percentage >= 30) {
      return 'Don\'t give up! Practice makes perfect! 💪';
    } else if (percentage >= 20) {
      return 'Every expert was once a beginner! 🌱';
    } else {
      return 'Keep learning! Every attempt counts! 📖';
    }
  };

  const renderContent = () => {
    switch (type) {
      case 'quiz':
        return (
          <>
            <div className={styles.logoShineContainer}>
              <Image 
                src="/assets/logo-name.png" 
                alt="Logo" 
                width={150}
                height={160}
                priority
                className={styles.shiningLogo}
              />
            </div>
            <div className={styles.loadingText}>
              <span className={styles.loadingDots}>
                {message}
                <span className={styles.dot}>.</span>
                <span className={styles.dot}>.</span>
                <span className={styles.dot}>.</span>
              </span>
            </div>
            <div className={styles.loadingSpinner}></div>
          </>
        );
      
      case 'score':
        return (
          <>
            <div className={styles.logoShineContainer}>
              <Image 
                src="/assets/logo-name.png" 
                alt="Logo" 
                width={150}
                height={160}
                priority
                className={styles.shiningLogo}
              />
            </div>
            <div className={styles.scoreDisplay}>
              <h2 className={styles.scoreTitle}>Quiz Complete!</h2>
              <div className={styles.scoreResult}>
                <span className={styles.scoreNumber}>{score}</span>
                <span className={styles.scoreSeparator}>/</span>
                <span className={styles.totalQuestions}>{totalQuestions}</span>
              </div>
              <p className={styles.scoreMessage}>
                {getScoreMessage(score, totalQuestions)}
              </p>
            </div>
            <div className={styles.loadingSpinner}></div>
          </>
        );
      
      default:
        return (
          <>
            <div className={styles.logoShineContainer}>
              <Image 
                src="/assets/logo-name.png" 
                alt="Logo" 
                width={150}
                height={160}
                priority
                className={styles.shiningLogo}
              />
            </div>
            <div className={styles.loadingText}>
              <span className={styles.loadingDots}>
                {message}
                <span className={styles.dot}>.</span>
                <span className={styles.dot}>.</span>
                <span className={styles.dot}>.</span>
              </span>
            </div>
            <div className={styles.loadingSpinner}></div>
          </>
        );
    }
  };

  return (
    <div className={styles.quizLoadingOverlay}>
      <div className={styles.quizLoadingContainer}>
        {renderContent()}
      </div>
    </div>
  );
};

export default QuizLoading; 

