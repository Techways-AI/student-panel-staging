"use client";

import React, { useEffect, useState } from 'react';
import styles from './PageLoader.module.css';

const PageLoader = ({ 
  message = "Loading content...", 
  size = "medium",
  fullScreen = false,
  delayMs = 400,
  showLogo = true
}) => {
  const [visible, setVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [delayMs]);

  if (!visible) return null;

  return (
    <div className={`${styles.pageLoader} ${fullScreen ? styles.pageLoaderFullScreen : ''} ${size === 'small' ? styles.pageLoaderSmall : size === 'large' ? styles.pageLoaderLarge : ''}`}>
      <div className={styles.pageLoaderContent}>
        <div className={styles.pageLoaderSpinner}>
          {showLogo && (
            <div className={styles.spinnerLogoWrap} aria-hidden="true">
              <img src="/assets/logo.png" alt="Loading" className={styles.spinnerLogo} />
              <span className={styles.spinnerShine}></span>
            </div>
          )}
          <div className={styles.spinnerRing}></div>
          <div className={styles.spinnerRing}></div>
          <div className={styles.spinnerRing}></div>
        </div>
        <div className={styles.pageLoaderText}>
          <p className={styles.pageLoaderMessage}>{message}</p>
          <div className={styles.pageLoaderDots}>
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PageLoader; 

