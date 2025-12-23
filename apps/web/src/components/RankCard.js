import React from 'react';
import styles from './RankCard.module.css';

const RankCard = ({ 
  rank, 
  totalStudents, 
  isLoading = false, 
  className = '' 
}) => {
  if (isLoading) {
    return (
      <div className={`${styles.rankCard} ${className}`}>
        <div className={styles.iconContainer}>
          <div className={styles.starIcon}>⭐</div>
        </div>
        <div className={styles.content}>
          <div className={styles.rankValue}>--</div>
          <div className={styles.rankLabel}>Class Rank</div>
          <div className={styles.rankSubtext}>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.rankCard} ${className}`}>
      <div className={styles.iconContainer}>
        <div className={styles.starIcon}>⭐</div>
      </div>
      <div className={styles.content}>
        <div className={styles.rankValue}>
          #{rank || '--'}
        </div>
        <div className={styles.rankLabel}>Class Rank</div>
        <div className={styles.rankSubtext}>
          out of {totalStudents || 0} students
        </div>
      </div>
    </div>
  );
};

export default RankCard;

