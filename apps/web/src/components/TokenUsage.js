import React, { useState, useEffect } from 'react';
import styles from './TokenUsage.module.css';

const TokenUsage = () => {
  const [usageData, setUsageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  let token = null;
  if (typeof window !== 'undefined') {
    token = localStorage.getItem('token');
  }

  useEffect(() => {
    fetchUsageData();
  }, []);

  const fetchUsageData = async () => {
    try {
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/tokens/usage/summary', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setUsageData(data);
    } catch (err) {
      console.error('Error fetching usage data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat().format(num);
  };

  const getAlertMessage = (alerts) => {
    if (!alerts || alerts.length === 0) return null;
    
    const messages = {
      'daily_limit_warning': 'You are approaching your daily token limit',
      'daily_limit_critical': 'You are very close to your daily token limit',
      'monthly_limit_warning': 'You are approaching your monthly token limit',
      'monthly_limit_critical': 'You are very close to your monthly token limit'
    };

    return alerts.map(alert => messages[alert]).filter(Boolean);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 90) return '#dc3545'; // Red
    if (percentage >= 80) return '#ffc107'; // Yellow
    return '#28a745'; // Green
  };

  if (loading) {
    return (
      <div className={styles.tokenUsageContainer}>
        <div className={styles.tokenUsageLoading}>
          <div className={styles.spinner}></div>
          <p>Loading usage data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.tokenUsageContainer}>
        <div className={styles.tokenUsageError}>
          <p>Error loading usage data: {error}</p>
          <button onClick={fetchUsageData} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!usageData) {
    return (
      <div className={styles.tokenUsageContainer}>
        <p>No usage data available</p>
      </div>
    );
  }

  const alertMessages = getAlertMessage(usageData.alerts);

  return (
    <div className={styles.tokenUsageContainer}>
      <div className={styles.tokenUsageHeader}>
        <h3>Token Usage</h3>
        <span className={styles.planBadge}>{usageData.plan_type}</span>
      </div>

      {alertMessages && alertMessages.length > 0 && (
        <div className={styles.tokenUsageAlerts}>
          {alertMessages.map((message, index) => (
            <div key={index} className={styles.alertMessage}>
              ⚠️ {message}
            </div>
          ))}
        </div>
      )}

      <div className={styles.tokenUsageGrid}>
        <div className={styles.usageCard}>
          <div className={styles.usageCardHeader}>
            <h4>Daily Usage</h4>
            <span className={styles.usagePercentage}>
              {usageData.daily_percentage.toFixed(1)}%
            </span>
          </div>
          <div className={styles.usageProgress}>
            <div 
              className={styles.progressBar}
              style={{
                width: `${Math.min(usageData.daily_percentage, 100)}%`,
                backgroundColor: getProgressColor(usageData.daily_percentage)
              }}
            ></div>
          </div>
          <div className={styles.usageStats}>
            <span className={styles.used}>{formatNumber(usageData.daily_usage)}</span>
            <span className={styles.separator}>/</span>
            <span className={styles.limit}>{formatNumber(usageData.daily_limit)}</span>
            <span className={styles.unit}>tokens</span>
          </div>
        </div>

        <div className={styles.usageCard}>
          <div className={styles.usageCardHeader}>
            <h4>Monthly Usage</h4>
            <span className={styles.usagePercentage}>
              {usageData.monthly_percentage.toFixed(1)}%
            </span>
          </div>
          <div className={styles.usageProgress}>
            <div 
              className={styles.progressBar}
              style={{
                width: `${Math.min(usageData.monthly_percentage, 100)}%`,
                backgroundColor: getProgressColor(usageData.monthly_percentage)
              }}
            ></div>
          </div>
          <div className={styles.usageStats}>
            <span className={styles.used}>{formatNumber(usageData.monthly_usage)}</span>
            <span className={styles.separator}>/</span>
            <span className={styles.limit}>{formatNumber(usageData.monthly_limit)}</span>
            <span className={styles.unit}>tokens</span>
          </div>
        </div>
      </div>

      {usageData.last_updated && (
        <div className={styles.lastUpdated}>
          Last updated: {new Date(usageData.last_updated).toLocaleString()}
        </div>
      )}

      <div className={styles.tokenUsageInfo}>
        <p>
          <strong>What are tokens?</strong> Tokens are pieces of text that AI models use to process your questions and generate responses. 
          On average, 1 token ≈ 4 characters or 0.75 words.
        </p>
        <p>
          <strong>Your plan:</strong> {usageData.plan_type.charAt(0).toUpperCase() + usageData.plan_type.slice(1)} 
          ({formatNumber(usageData.daily_limit)} daily, {formatNumber(usageData.monthly_limit)} monthly)
        </p>
      </div>
    </div>
  );
};

export default TokenUsage; 

