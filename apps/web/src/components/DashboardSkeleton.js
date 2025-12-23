import React from 'react';
import styles from './DashboardSkeleton.module.css';

// Skeleton for individual dashboard cards
const CardSkeleton = ({ height = '200px', children }) => (
  <div className={styles.cardSkeleton} style={{ height }}>
    {children}
  </div>
);

// Skeleton for text elements
const TextSkeleton = ({ width = '100%', height = '20px' }) => (
  <div 
    className={styles.textSkeleton} 
    style={{ width, height }}
  />
);

// Skeleton for circular elements (like avatars or icons)
const CircleSkeleton = ({ size = '40px' }) => (
  <div 
    className={styles.circleSkeleton} 
    style={{ width: size, height: size }}
  />
);

// Premium Card Skeleton
const PremiumCardSkeleton = () => (
  <CardSkeleton height="160px">
    <div className={styles.premiumCardContent}>
      <CircleSkeleton size="48px" />
      <div className={styles.premiumTextGroup}>
        <TextSkeleton width="80%" height="24px" />
        <TextSkeleton width="90%" height="16px" />
      </div>
      <div className={styles.premiumButtonSkeleton} />
    </div>
  </CardSkeleton>
);

// Streak Card Skeleton
const StreakCardSkeleton = () => (
  <CardSkeleton height="120px">
    <div className={styles.streakCardContent}>
      <div className={styles.streakHeaderSkeleton}>
        <CircleSkeleton size="60px" />
        <CircleSkeleton size="30px" />
      </div>
      <div className={styles.weeklyStreakSkeleton}>
        {Array.from({ length: 7 }).map((_, index) => (
          <CircleSkeleton key={index} size="20px" />
        ))}
      </div>
      <div className={styles.streakDaysSkeleton}>
        {Array.from({ length: 7 }).map((_, index) => (
          <TextSkeleton key={index} width="12px" height="12px" />
        ))}
      </div>
    </div>
  </CardSkeleton>
);

// AI Tutor Card Skeleton
const AiTutorCardSkeleton = () => (
  <CardSkeleton height="140px">
    <div className={styles.aiTutorCardContent}>
      <CircleSkeleton size="40px" />
      <div className={styles.aiTutorTextGroup}>
        <TextSkeleton width="85%" height="20px" />
        <TextSkeleton width="95%" height="14px" />
      </div>
    </div>
  </CardSkeleton>
);

// Subject Card Skeleton
const SubjectCardSkeleton = () => (
  <CardSkeleton height="200px">
    <div className={styles.subjectCardContent}>
      <div className={styles.subjectCardHeader}>
        <TextSkeleton width="70%" height="18px" />
        <CircleSkeleton size="24px" />
      </div>
      <div className={styles.subjectCardBody}>
        <div className={styles.progressBarSkeleton} />
        <TextSkeleton width="50%" height="14px" />
      </div>
      <div className={styles.subjectCardFooter}>
        <TextSkeleton width="40%" height="14px" />
        <TextSkeleton width="30%" height="14px" />
      </div>
    </div>
  </CardSkeleton>
);

// Today's Goals Card Skeleton
const TodayGoalsCardSkeleton = () => (
  <CardSkeleton height="320px">
    <div className={styles.todayGoalsContent}>
      <div className={styles.todayGoalsHeader}>
        <TextSkeleton width="60%" height="20px" />
        <TextSkeleton width="40%" height="14px" />
      </div>
      <div className={styles.todayGoalsList}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className={styles.goalItemSkeleton}>
            <CircleSkeleton size="20px" />
            <div className={styles.goalTextGroup}>
              <TextSkeleton width="80%" height="16px" />
              <TextSkeleton width="60%" height="12px" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </CardSkeleton>
);

// Leaderboard Card Skeleton
const LeaderboardCardSkeleton = () => (
  <CardSkeleton height="350px">
    <div className={styles.leaderboardContent}>
      <div className={styles.leaderboardHeader}>
        <TextSkeleton width="50%" height="20px" />
      </div>
      <div className={styles.leaderboardList}>
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className={styles.leaderboardItemSkeleton}>
            <TextSkeleton width="20px" height="16px" />
            <CircleSkeleton size="32px" />
            <div className={styles.leaderboardTextGroup}>
              <TextSkeleton width="70%" height="14px" />
              <TextSkeleton width="40%" height="12px" />
            </div>
            <TextSkeleton width="30px" height="14px" />
          </div>
        ))}
      </div>
    </div>
  </CardSkeleton>
);

// Main Dashboard Skeleton Layout
const DashboardSkeleton = () => (
  <div className={styles.dashboardSkeletonContainer}>
    {/* Left Column */}
    <div className={styles.leftColumn}>
      <PremiumCardSkeleton />
      <StreakCardSkeleton />
    </div>

    {/* Center Column */}
    <div className={styles.centerColumn}>
      <div className={styles.subjectsGridSkeleton}>
        {Array.from({ length: 6 }).map((_, index) => (
          <SubjectCardSkeleton key={index} />
        ))}
      </div>
    </div>

    {/* Right Column */}
    <div className={styles.rightColumn}>
      <TodayGoalsCardSkeleton />
      <LeaderboardCardSkeleton />
    </div>
  </div>
);

export default DashboardSkeleton;
export {
  CardSkeleton,
  TextSkeleton,
  CircleSkeleton,
  PremiumCardSkeleton,
  StreakCardSkeleton,
  AiTutorCardSkeleton,
  SubjectCardSkeleton,
  TodayGoalsCardSkeleton,
  LeaderboardCardSkeleton
};

