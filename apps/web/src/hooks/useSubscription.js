import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

// Global subscription cache to prevent multiple instances from making duplicate calls
const globalSubscriptionCache = new Map();
const CACHE_DURATION = 60 * 1000; // 60 seconds cache - balance between freshness and performance
let globalRequestInProgress = false;

export const useSubscription = () => {
  const { user, token } = useAuth();
  
  // Fallback to localStorage if AuthContext doesn't have user data
  const effectiveToken = token || (typeof window !== 'undefined' ? localStorage.getItem('token') : null);
  const effectiveUser = user || (typeof window !== 'undefined' ? {
    mobile: localStorage.getItem('mobile'),
    id: JSON.parse(localStorage.getItem('userInfo') || '{}').id
  } : null);
  
  // Removed excessive debug logging
  
  const [subscriptionStatus, setSubscriptionStatus] = useState(() => {
    // Don't initialize from localStorage to prevent flash of stale data
    // localStorage is only used as fallback if API fails
    return {
      has_subscription: null, // null means unknown/loading
      status: null, // null means unknown/loading
      plan_name: null,
      valid_until: null,
      is_active: null
    };
  });
  const [loading, setLoading] = useState(false); // Never show loading
  const [error, setError] = useState(null);
  
  // Request deduplication ref
  const requestRef = useRef(null);

  const fetchSubscriptionStatus = useCallback(async (force = false) => {
    if (!effectiveToken) {
      return; // Keep using fallback data
    }

    // Check global cache first (skip if force)
    const cacheKey = `subscription_${effectiveToken}`;
    const cached = globalSubscriptionCache.get(cacheKey);
    
    if (!force && cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      setSubscriptionStatus(prev => ({ ...prev, ...cached.data }));
      return;
    }

    // Prevent duplicate requests globally unless forced
    if (!force && globalRequestInProgress) {
      return;
    }

    try {
      globalRequestInProgress = true;
      
      // Add cache-busting parameter to force fresh data
      const cacheBuster = force ? `?_t=${Date.now()}` : '';
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/'}/api/payments/status${cacheBuster}`, {
        headers: {
          'Authorization': `Bearer ${effectiveToken}`,
        },
        cache: 'no-store', // Prevent browser caching
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No subscription found - return free status
          const freeStatus = {
            has_subscription: false,
            is_active: false,
            status: 'free',
            subscription_status: null,
            subscription_plan: null,
            plan_name: null,
            valid_until: null,
            tier: null,
            billing_cycle: null,
            is_plus: false,
            is_pro: false,
            is_yearly: false,
            is_semester: false
          };
          globalSubscriptionCache.set(cacheKey, {
            data: freeStatus,
            timestamp: Date.now()
          });
          setSubscriptionStatus(prev => ({ ...prev, ...freeStatus }));
          return;
        }
        throw new Error('Failed to fetch subscription status');
      }

      const data = await response.json();

      const planId = data?.subscription_status || data?.plan_id || null;
      const planCycle = data?.subscription_plan ?? null;
      const isActive = Boolean(data?.is_active);
      const hasSubscription = Boolean(data?.has_subscription);
      const rawStatus = (data?.status || '').toLowerCase();
      const planLower = (planId || '').toLowerCase();
      const planNameLower = (data?.plan_name || '').toLowerCase();
      const planCycleLower = (planCycle || '').toLowerCase();
      const normalizedTier = (() => {
        if (planLower.includes('pro')) return 'pharma pro';
        if (planLower.includes('plus')) return 'pharma plus';
        if (rawStatus.includes('pharma pro')) return 'pharma pro';
        if (rawStatus.includes('pharma plus')) return 'pharma plus';
        return null;
      })();

      const isProTier = planLower.includes('pro') || planNameLower.includes('pro') || rawStatus.includes('pro');
      const isPlusTier = !isProTier && (planLower.includes('plus') || planNameLower.includes('plus') || rawStatus.includes('plus'));
      const billingCycle = (() => {
        if (planCycleLower) return planCycleLower;
        if (planLower.includes('year')) return 'yearly';
        if (planLower.includes('sem')) return 'semester';
        if (planNameLower.includes('year')) return 'yearly';
        if (planNameLower.includes('sem')) return 'semester';
        return null;
      })();

      const normalized = {
        ...data,
        has_subscription: hasSubscription,
        is_active: isActive,
        status: normalizedTier || (hasSubscription && isActive ? (data?.status || 'active') : (data?.status || 'free')),
        subscription_status: planId,
        subscription_plan: planCycle,
        plan_name: data?.plan_name ?? null,
        valid_until: data?.valid_until ?? null,
        trial_expired: data?.trial_expired ?? null,
        trial_days_remaining: data?.trial_days_remaining ?? null,
        tier: isProTier ? 'pro' : (isPlusTier ? 'plus' : null),
        billing_cycle: billingCycle,
        is_plus: isPlusTier,
        is_pro: isProTier,
        is_yearly: billingCycle === 'yearly',
        is_semester: billingCycle === 'semester'
      };

      // Cache the successful response globally
      globalSubscriptionCache.set(cacheKey, {
        data: normalized,
        timestamp: Date.now()
      });
      
      setSubscriptionStatus(prev => ({ ...prev, ...normalized }));
      
      // Persist to localStorage with timestamp for offline fallback
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('subscriptionStatus', JSON.stringify({
            data: normalized,
            timestamp: Date.now()
          }));
        } catch (error) {
          console.warn('Failed to persist subscription to localStorage:', error);
        }
      }
    } catch (err) {
      console.error('Error fetching subscription status:', err);
      
      // Fallback to localStorage only if API fails and data is recent (< 5 minutes old)
      if (typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('subscriptionStatus');
          if (stored) {
            const { data, timestamp } = JSON.parse(stored);
            const age = Date.now() - timestamp;
            const FIVE_MINUTES = 5 * 60 * 1000;
            
            if (age < FIVE_MINUTES && data) {
              console.log('Using localStorage fallback (age:', Math.round(age / 1000), 'seconds)');
              setSubscriptionStatus(prev => ({ ...prev, ...data }));
            }
          }
        } catch (storageError) {
          console.warn('Failed to read localStorage fallback:', storageError);
        }
      }
    } finally {
      globalRequestInProgress = false;
    }
  }, [effectiveToken]);

  const refreshSubscription = useCallback(() => {
    // Clear global cache to force fresh fetch
    if (effectiveToken) {
      const cacheKey = `subscription_${effectiveToken}`;
      globalSubscriptionCache.delete(cacheKey);
    }
    
    // Clear localStorage cache
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('subscriptionStatus');
      } catch (error) {
        console.warn('Failed to clear subscription status from localStorage:', error);
      }
    }
    
    return fetchSubscriptionStatus(true);
  }, [effectiveToken, fetchSubscriptionStatus]);

  // Single consolidated effect for fetching subscription on mount/token change
  useEffect(() => {
    fetchSubscriptionStatus();
  }, [effectiveToken]);

  // Clear cache only when user mobile changes (actual user switch, not just token refresh)
  const prevMobileRef = useRef(effectiveUser?.mobile);
  useEffect(() => {
    const prevMobile = prevMobileRef.current;
    const currentMobile = effectiveUser?.mobile;
    
    // Only clear and refetch if user actually changed (not on initial mount)
    if (prevMobile && currentMobile && prevMobile !== currentMobile) {
      globalSubscriptionCache.clear();
      
      if (typeof window !== 'undefined') {
        try {
          localStorage.removeItem('subscriptionStatus');
          localStorage.removeItem(`subscription_${prevMobile}`);
        } catch (error) {
          console.warn('Failed to clear subscription status from localStorage:', error);
        }
      }
      
      // Force fresh fetch for new user
      if (effectiveToken) {
        fetchSubscriptionStatus(true);
      }
    }
    
    prevMobileRef.current = currentMobile;
  }, [effectiveUser?.mobile, effectiveToken, fetchSubscriptionStatus]);

  // Note: localStorage persistence is now handled in fetchSubscriptionStatus
  // to include timestamp and prevent stale data on mount

  // Expose refresh function globally for payment success callbacks
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.refreshSubscriptionStatus = async () => {
        try {
          await refreshSubscription();
        } catch (e) {
          // no-op
        }
      };
    }
    
    return () => {
      if (typeof window !== 'undefined') {
        delete window.refreshSubscriptionStatus;
      }
    };
  }, [refreshSubscription]);

  return {
    subscriptionStatus,
    loading,
    error,
    refreshSubscription
  };
};

