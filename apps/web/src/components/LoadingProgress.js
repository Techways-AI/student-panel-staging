import React, { useState, useEffect } from 'react';
import styles from './LoadingProgress.module.css';

const LoadingProgress = ({ 
  duration = 2000, 
  onComplete = null,
  showPercentage = true,
  color = '#007bb8' 
}) => {
  const [progress, setProgress] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newProgress = Math.min((elapsed / duration) * 100, 100);
      
      setProgress(newProgress);
      
      if (newProgress >= 100) {
        setIsComplete(true);
        clearInterval(interval);
        if (onComplete) {
          setTimeout(onComplete, 300); // Small delay for smooth transition
        }
      }
    }, 16); // ~60fps

    return () => clearInterval(interval);
  }, [duration, onComplete]);

  return (
    <div className={styles.loadingProgressContainer}>
      <div className={styles.loadingProgressBar}>
        <div 
          className={styles.loadingProgressFill}
          style={{ 
            width: `${progress}%`,
            backgroundColor: color
          }}
        />
      </div>
      {showPercentage && (
        <div className={styles.loadingProgressText}>
          {Math.round(progress)}%
        </div>
      )}
    </div>
  );
};

export default LoadingProgress; 

