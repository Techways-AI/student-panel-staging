import React, { useEffect, useState, useMemo, useCallback, memo } from 'react';
import styles from './SubscriptionPlans.module.css';
import { useLayout } from '../context/LayoutContext';
import { useTheme } from '../context/ThemeContext';
import SimpleSubscriptionService from '../services/simpleSubscriptionService';

// Memoized check icon to prevent recreation
const checkIcon = (
  <svg width="20" height="20" fill="none" viewBox="0 0 20 20">
    <circle cx="10" cy="10" r="10" fill="#22c55e"/>
    <path d="M6 10.5l2.5 2.5 5-5" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Memoized SubscriptionPlanCard component
const SubscriptionPlanCard = memo(({ plan, onSubscribe, isProcessingPayment, currentSubscription }) => {
  const handleSubscribe = useCallback(() => {
    if (!currentSubscription && onSubscribe && !isProcessingPayment) {
      onSubscribe(plan);
    }
  }, [plan, onSubscribe, isProcessingPayment, currentSubscription]);

  const isCurrentPlan = currentSubscription && currentSubscription.plan_id === plan.id.toString();
  const isActive = currentSubscription && currentSubscription.is_active;

  return (
    <div
      className={`${styles.planCard}${plan.name.toLowerCase().includes('yearly') ? ' ' + styles.bestValue : ''}${isCurrentPlan ? ' ' + styles.current : ''}`}
    >
      {plan.name.toLowerCase().includes('yearly') && <div className={styles.bestValueBadge}>⭐ Most Popular</div>}
      {isCurrentPlan && <div className={styles.currentPlanBadge}>✓ Current Plan</div>}
      
      <h3>{plan.name}</h3>
      <div className={styles.planDesc}>{plan.description}</div>
      
      <div className={styles.planPriceRow}>
        <span className={styles.planPrice}>{plan.formatted_amount}</span>
        <span className={styles.planPeriod}>{plan.interval_display}</span>
      </div>
      
      {/* Trial info removed */}
      
      <ul className={styles.planFeatures}>
        {plan.features && Object.entries(plan.features).map(([key, value]) => (
          value && <li key={key}>{checkIcon}<span>{key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span></li>
        ))}
      </ul>
      
      <button
        type="button"
        className={isCurrentPlan ? styles.currentBtn : styles.subscribeBtn}
        aria-label={isCurrentPlan ? 'Current Plan' : `Subscribe to ${plan.name}`}
        disabled={isCurrentPlan || isProcessingPayment}
        onClick={handleSubscribe}
      >
        {isProcessingPayment ? (
          <>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #f3f3f3',
              borderTop: '2px solid #2563eb',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              marginRight: '8px'
            }}></div>
            Processing...
          </>
        ) : (
          <>
            <svg className="lucide lucide-sparkles w-4 h-4" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.936l6.135 1.582a.5.5 0 0 1 0 .962L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              <path d="m20 3 4 4-4 4"/>
              <path d="m4 21 4-4-4-4"/>
            </svg>
            {isCurrentPlan ? 'Current Plan' : 'Subscribe Now'}
          </>
        )}
      </button>
    </div>
  );
});

SubscriptionPlanCard.displayName = 'SubscriptionPlanCard';

// Memoized CurrentSubscriptionCard component
const CurrentSubscriptionCard = memo(({ subscription }) => (
  <div className={styles.currentSubscriptionCard}>
    <div className={styles.currentSubscriptionInfo}>
      <span className={styles.currentSubscriptionIcon}>{checkIcon}</span>
      <div>
        <div className={styles.currentSubscriptionLabel}>
          {subscription.is_active ? `You're subscribed to ${subscription.plan_name}` : 'Your subscription is inactive'}
        </div>
        <div className={styles.currentSubscriptionDate}>
          {subscription.is_active 
            ? `Valid till: ${new Date(subscription.end_date).toLocaleDateString()}`
            : `Expired on: ${new Date(subscription.end_date).toLocaleDateString()}`
          }
        </div>
        {subscription.next_billing_date && (
          <div className={styles.nextBillingDate}>
            Next billing: {new Date(subscription.next_billing_date).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
    <div className={styles.subscriptionStatus}>
      Status: <span className={`${styles.statusBadge} ${subscription.is_active ? styles.active : styles.inactive}`}>
        {subscription.is_active ? 'Active' : 'Inactive'}
      </span>
    </div>
  </div>
));

CurrentSubscriptionCard.displayName = 'CurrentSubscriptionCard';

// Memoized FeatureHighlights component
const FeatureHighlights = memo(() => (
  <div className={styles.featureHighlights}>
    <h3>Why Choose Our Subscription Plans?</h3>
    <div className={styles.featureCards}>
      <div className={styles.featureCard}>
        <div className={`${styles.featureIcon} ${styles.iconBlue}`}>🔄</div>
        <h4>Automatic Renewals</h4>
        <p>Never miss access with automatic subscription renewals. Cancel anytime with no questions asked.</p>
      </div>
      <div className={styles.featureCard}>
        <div className={`${styles.featureIcon} ${styles.iconGreen}`}>⏸️</div>
        <h4>Pause & Resume</h4>
        <p>Pause your subscription during breaks and resume when you're ready to continue learning.</p>
      </div>
      <div className={styles.featureCard}>
        <div className={`${styles.featureIcon} ${styles.iconPurple}`}>📊</div>
        <h4>Usage Analytics</h4>
        <p>Track your learning progress with detailed analytics and personalized insights.</p>
      </div>
    </div>
  </div>
));

FeatureHighlights.displayName = 'FeatureHighlights';

const SubscriptionPlans = () => {
  const { setShowUpgrade } = useLayout();
  const { isDarkMode } = useTheme();
  const [plans, setPlans] = useState([]);
  const [currentSubscription, setCurrentSubscription] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [loading, setLoading] = useState(true);

  // Fetch subscription plans and current subscription
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [plansResponse, subscriptionResponse] = await Promise.all([
          SubscriptionService.getSubscriptionPlans(),
          SubscriptionService.getSubscriptionStatus()
        ]);
        
        setPlans(plansResponse.plans || []);
        setCurrentSubscription(subscriptionResponse);
      } catch (error) {
        console.error('Error fetching subscription data:', error);
        setPaymentError('Failed to load subscription plans. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Memoized subscription handler
  const handleSubscribe = useCallback(async (selectedPlan) => {
    try {
      console.log('Selected plan:', selectedPlan.name);
      setIsProcessingPayment(true);
      setPaymentError(null);

      // Get user data from localStorage
      const token = localStorage.getItem('token');
      const mobile = localStorage.getItem('mobile');
      
      // Try to get userInfo from different possible locations
      let userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      
      // If userInfo doesn't have id, try to get it from 'user' key (from useAuth.ts)
      if (!userInfo.id) {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData.id) {
          userInfo = userData;
        }
      }
      
      // If still no id, try to get user data from API
      if (!userInfo.id && token) {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app'}/api/profile/me`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const profileData = await response.json();
            userInfo = {
              id: profileData.id,
              name: profileData.name,
              email: profileData.email,
              mobile: profileData.mobile
            };
            // Store it for future use
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
          }
        } catch (error) {
          console.warn('Failed to fetch user profile:', error);
        }
      }

      if (!token) {
        throw new Error('User not authenticated. Please login again.');
      }

      if (!userInfo.id) {
        throw new Error('User information not available. Please login again.');
      }

      // Prepare user data for subscription
      const userData = {
        id: userInfo.id, // Use the actual user ID from userInfo, don't fallback to mobile
        name: userInfo.name || mobile,
        email: userInfo.email || '',
        mobile: mobile
      };

      console.log('Creating subscription for plan:', selectedPlan);
      
      // Process direct payment
      const result = await SimpleSubscriptionService.processDirectPayment(selectedPlan, userData);
      console.log('Subscription successful:', result);

      // Show success message
      alert(`Subscription successful! Welcome to ${selectedPlan.name}. You now have access to all premium features.`);
      
      // Refresh subscription status
      const updatedSubscription = await SimpleSubscriptionService.getSubscriptionStatus();
      setCurrentSubscription(updatedSubscription);

    } catch (error) {
      console.error('Subscription error:', error);
      setPaymentError(error.message || 'Subscription failed. Please try again.');
      
      // Show error message
      if (error.message.includes('cancelled')) {
        console.log('Subscription cancelled by user');
      } else {
        alert(`Subscription failed: ${error.message}`);
      }
    } finally {
      setIsProcessingPayment(false);
    }
  }, []);

  // Memoized close handler
  const handleClose = useCallback(() => {
    setShowUpgrade(false);
  }, [setShowUpgrade]);

  // Memoized escape key handler
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') {
      setShowUpgrade(false);
    }
  }, [setShowUpgrade]);

  // Close subscription plans when clicking outside or pressing escape
  useEffect(() => {
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [handleEscape]);

  // Debug theme state
  useEffect(() => {
    console.log('🎨 SubscriptionPlans Theme:', isDarkMode ? 'Dark' : 'Light');
    
    // Force set data-theme attribute for testing
    if (isDarkMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [isDarkMode]);

  if (loading) {
    return (
      <div className={`${styles.subscriptionPlansPage} ${isDarkMode ? 'dark-theme' : 'light-theme'}`}>
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p>Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`${styles.subscriptionPlansPage} ${isDarkMode ? 'dark-theme' : 'light-theme'}`}
      style={isDarkMode ? { 
        background: '#111827', 
        color: '#f9fafb' 
      } : {}}
    >
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      
      <div className={styles.subscriptionHeader}>
        <div className={styles.titleRow}>
          <div className={styles.headerCrownIcon}>👑</div>
          <h2 className={styles.subscriptionTitle}>Choose Your Subscription Plan</h2>
        </div>
        <p className={styles.subscriptionSubtitle}>
          Get unlimited access to all premium features with our flexible subscription plans. 
          Cancel or pause anytime with no questions asked.
        </p>
        
        <div className={styles.statsRow}>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>🔄</span>
            <span>Auto-renewal</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>⏸️</span>
            <span>Pause anytime</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statIcon}>💰</span>
            <span>Secure payments</span>
          </div>
        </div>
      </div>

      {currentSubscription && (
        <CurrentSubscriptionCard subscription={currentSubscription} />
      )}
        
      <div className={styles.planOptions}>
        {plans.map((plan) => (
          <SubscriptionPlanCard 
            key={plan.id} 
            plan={plan} 
            onSubscribe={handleSubscribe}
            isProcessingPayment={isProcessingPayment}
            currentSubscription={currentSubscription}
          />
        ))}
      </div>
      
      {paymentError && (
        <div className={styles.paymentError}>
          <div className={styles.errorIcon}>⚠️</div>
          <div className={styles.errorMessage}>{paymentError}</div>
          <button 
            className={styles.dismissError}
            onClick={() => setPaymentError(null)}
          >
            ✕
          </button>
        </div>
      )}
      
      <FeatureHighlights />
      
      <div className={styles.bottomCTA}>
        <h3>Ready to Start Your Learning Journey?</h3>
        <p>Join thousands of pharmacy students who are excelling with our comprehensive learning platform.</p>
        <div className={styles.ctaButtons}>
          <button className={styles.subscribeBtn}>
            <img className={styles.ctaCrownIcon} src="/assets/crown.png" alt="Crown" width="28" height="28" /> 
            Upgrade Now
          </button>
          <button className={styles.viewDemoBtn}>View Demo</button>
        </div>
      </div>
    </div>
  );
};

export default memo(SubscriptionPlans);

