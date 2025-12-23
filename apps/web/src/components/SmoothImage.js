import React, { useState } from 'react';
import styles from './SmoothImage.module.css';

const SmoothImage = ({ 
  src, 
  alt, 
  className = '', 
  fallbackSrc = null,
  onLoad = null,
  onError = null,
  ...props 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  const handleLoad = () => {
    setIsLoading(false);
    setHasError(false);
    if (onLoad) onLoad();
  };

  const handleError = () => {
    if (fallbackSrc && currentSrc !== fallbackSrc) {
      setCurrentSrc(fallbackSrc);
      setHasError(false);
    } else {
      setIsLoading(false);
      setHasError(true);
      if (onError) onError();
    }
  };

  return (
    <div className={`${styles.smoothImageContainer} ${className}`}>
      {/* Loading skeleton */}
      {isLoading && (
        <div className={styles.smoothImageSkeleton}></div>
      )}
      
      {/* Image */}
      <img
        src={currentSrc}
        alt={alt}
        className={`${styles.smoothImage} ${isLoading ? styles.smoothImageLoading : styles.smoothImageLoaded}`}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
      
      {/* Error fallback */}
      {hasError && (
        <div className={styles.smoothImageError}>
          <span>📷</span>
        </div>
      )}
    </div>
  );
};

export default SmoothImage; 

