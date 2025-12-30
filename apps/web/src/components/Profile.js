import React, { useState, useEffect, useCallback } from 'react';
import { useLayout } from '../context/LayoutContext';
import { useSectionManager } from '../hooks/useSectionManager';
import { useTheme } from '../context/ThemeContext';
import { useSubscription } from '../hooks/useSubscription';
import { useRouter } from 'next/navigation';
import { performCompleteLogout, clearAllUserData } from '../lib/api';
import DeviceManagement from './DeviceManagement';

import styles from './Profile.module.css';
// Settings.css import removed - now using CSS Modules

import { API_CONFIG } from '../config/api.js';

const API_BASE_URL = API_CONFIG.BASE_URL;

const Profile = () => {
  const [activeSection, setActiveSection] = useState('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [errors, setErrors] = useState({});
  const [profileImage, setProfileImage] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  
  // Theme context
  const { isDarkMode } = useTheme();
  
  // Subscription context
  const { subscriptionStatus, loading: subscriptionLoading } = useSubscription();
  
  // Router for navigation
  const router = useRouter();

  const buildDeviceHeaders = () => {
    const headers = {};
    if (typeof window === 'undefined') {
      return headers;
    }
    try {
      if (window.deviceManager && typeof window.deviceManager.getDeviceInfo === 'function') {
        const deviceInfo = window.deviceManager.getDeviceInfo();
        if (deviceInfo?.deviceUuid) {
          headers['X-Device-UUID'] = deviceInfo.deviceUuid;
        }
        if (deviceInfo?.deviceType) {
          headers['X-Device-Type'] = deviceInfo.deviceType;
        }
        if (deviceInfo?.fingerprint) {
          headers['X-Device-Fingerprint'] = JSON.stringify(deviceInfo.fingerprint);
        }
      }
    } catch (error) {
      console.error('Failed to build device headers for profile update:', error);
    }
    return headers;
  };

  const callProfileUpdateWithDevice = async (body) => {
    if (typeof window === 'undefined') {
      throw new Error('Window is not available');
    }

    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No authentication token found');
    }

    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...buildDeviceHeaders(),
    };

    const response = await fetch(
      `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROFILE.UPDATE}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Profile update failed with status ${response.status}: ${text || response.statusText}`);
    }

    return response.json();
  };

  // Apply theme to body
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const body = document.body;
      const html = document.documentElement;
      
      // Remove existing theme classes
      body.classList.remove('dark-theme', 'light-theme');
      html.classList.remove('dark-theme', 'light-theme');
      
      // Apply new theme class
      const themeClass = isDarkMode ? 'dark-theme' : 'light-theme';
      body.classList.add(themeClass);
      html.classList.add(themeClass);
      
      // Apply theme styles directly
      if (isDarkMode) {
        body.style.backgroundColor = '#1a1a1a';
        body.style.color = 'white';
        html.style.backgroundColor = '#1a1a1a';
      } else {
        body.style.backgroundColor = '#f8fafc';
        body.style.color = '#1f2937';
        html.style.backgroundColor = '#f8fafc';
      }
    }
    
    // Cleanup function
    return () => {
      if (typeof document !== 'undefined') {
        const body = document.body;
        const html = document.documentElement;
        
        // Remove theme classes and styles
        body.classList.remove('dark-theme', 'light-theme');
        html.classList.remove('dark-theme', 'light-theme');
        body.style.backgroundColor = '';
        body.style.color = '';
        html.style.backgroundColor = '';
      }
    };
  }, [isDarkMode]);
  

  // Section management
  const sectionId = 'profile-main';
  const { isRestored, getSavedSection, clearSavedProgress } = useSectionManager(
    sectionId,
    null, // no video for this section
    null, // no video ref for this section
    true // enabled
  );

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;
        setProfileImage(base64);
        localStorage.setItem('profileImage', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const storedImage = localStorage.getItem('profileImage');
    if (storedImage) {
      setProfileImage(storedImage);
    }
    fetchUserData();
  }, []);

  // Listen for authentication changes and refresh data
  useEffect(() => {
    const handleAuthChange = () => {
      fetchUserData();
    };

    // Listen for custom auth events
    window.addEventListener('auth-change', handleAuthChange);
    
    // Also listen for storage changes (when mobile number is updated)
    const handleStorageChange = (e) => {
      if (e.key === 'mobile' || e.key === 'token') {
        fetchUserData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const fetchUserData = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        // Redirect to login if no token found
        console.log('🔒 No authentication token found, redirecting to login');
        window.location.href = '/login';
        return;
      }

      // Clear any cached user data before fetching fresh data
      if (typeof window !== 'undefined') {
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('cachedUserName_') || key.includes('userData'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, redirect to login
          console.log('🔒 Invalid token, redirecting to login');
          localStorage.removeItem('token');
          localStorage.removeItem('mobile');
          localStorage.removeItem('userInfo');
          window.location.href = '/login';
          return;
        }
        throw new Error('Failed to fetch user data');
      }

      const data = await response.json();
      console.log('📱 Profile: Fetched user data:', data);
      console.log('📱 Profile: Mobile number from API:', data.mobile);
      
      const userInfoData = {
        name: data.name || '',
        gender: data.gender || '',
        email: data.email || '',
        phoneNumber: data.mobile || '',
        collegeName: data.college_name || '',
        university: data.university || '',
        // Store subscription info from user data as fallback
        subscription_status: data.subscription_status,
        subscription_plan: data.subscription_plan,
        subscription_updated_at: data.subscription_updated_at
      };
      
      console.log('📱 Profile: Setting userInfo:', userInfoData);
      setUserInfo(userInfoData);
      
      // Also update localStorage to ensure consistency
      localStorage.setItem('mobile', data.mobile || '');
      localStorage.setItem('userInfo', JSON.stringify(userInfoData));
      
      setIsLoading(false);
    } catch (error) {
      console.error('Error fetching user data:', error);
      setErrors(prev => ({ ...prev, fetch: 'Failed to load user data' }));
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Validate required fields
      const newErrors = {};
      if (!userInfo.name?.trim()) newErrors.name = 'Name is required';
      if (!userInfo.gender?.trim()) newErrors.gender = 'Gender is required';
      if (!userInfo.email?.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userInfo.email)) {
        newErrors.email = 'Invalid email format';
      }
      if (!userInfo.collegeName?.trim()) newErrors.collegeName = 'College name is required';
      if (!userInfo.university?.trim()) newErrors.university = 'University is required';

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      console.log('🔄 Profile: Starting profile update...');
      console.log('📊 Profile: Update data:', {
        name: userInfo.name,
        email: userInfo.email,
        gender: userInfo.gender,
        college_name: userInfo.collegeName,
        university: userInfo.university
      });

      // Use the correct profile API endpoint
      const response = await callProfileUpdateWithDevice({
        name: userInfo.name,
        email: userInfo.email,
        gender: userInfo.gender,
        college_name: userInfo.collegeName,
        university: userInfo.university
      });

      console.log('✅ Profile: Update successful, response:', response);

      // Update local storage with new user info
      if (response.user) {
        const updatedUserInfo = {
          name: response.user.name || userInfo.name,
          gender: response.user.gender || userInfo.gender,
          email: response.user.email || userInfo.email,
          phoneNumber: response.user.mobile || userInfo.phoneNumber,
          collegeName: response.user.college_name || userInfo.collegeName,
          university: response.user.university || userInfo.university,
          subscription_status: response.user.subscription_status,
          subscription_plan: response.user.subscription_plan,
          subscription_updated_at: response.user.subscription_updated_at
        };
        
        localStorage.setItem('userInfo', JSON.stringify(updatedUserInfo));
        setUserInfo(updatedUserInfo);
        console.log('💾 Profile: Updated localStorage with new user info');
      }

      setUpdateSuccess(true);
      setTimeout(() => setUpdateSuccess(false), 3000);
      setIsEditing(false);
      setErrors({});
      
      // Refresh user data to ensure consistency
      await fetchUserData();
      
    } catch (error) {
      console.error('❌ Profile: Error updating profile:', error);
      setErrors(prev => ({ ...prev, update: error.message || 'Failed to update profile' }));
    }
  };

  // Logout function - optimized for immediate execution
  const handleLogout = useCallback(() => {
    console.log('🔒 Profile: Logout initiated');
    
    // Immediate logout using direct imports
    if (typeof window !== 'undefined') {
      try {
        // Use the centralized logout function directly
        performCompleteLogout();
        console.log('🔒 Profile: Using centralized logout function');
        
        // Redirect to login immediately
        router.replace('/login');
      } catch (error) {
        console.error('🔒 Profile: Error during logout:', error);
        // Fallback to basic logout
        try {
          clearAllUserData();
          localStorage.removeItem('token');
          localStorage.removeItem('mobile');
          localStorage.removeItem('isIdentified');
          localStorage.removeItem('userInfo');
          localStorage.removeItem('profileImage');
          router.replace('/login');
        } catch (fallbackError) {
          console.error('🔒 Profile: Fallback logout failed:', fallbackError);
          localStorage.clear();
          sessionStorage.clear();
          router.replace('/login');
        }
      }
    }
  }, [router]);

  // Determine plan-based message based on subscription status
  const getPlanMessage = useCallback(() => {
    const planFeatures = {
      free: ['Limited access to subjects', 'Basic AI Tutor', 'Basic analytics'],
      plus: ['Full access to all subjects', 'Smart Coach guidance', 'Standard analytics'],
      pro: ['Everything in Plus', 'AI Tutor: Unlimited queries', 'Exam prep suite', 'Priority support']
    };

    if (subscriptionLoading || !subscriptionStatus) {
      return {
        type: 'loading',
        title: 'Loading Plan...',
        message: 'Checking your subscription status...',
        showUpgrade: false
      };
    }

    // Check if trial has expired
    if (subscriptionStatus.trial_expired === true) {
      return {
        type: 'trial_expired',
        title: 'Trial Expired',
        message: 'Your free trial has expired. Upgrade to continue accessing all features.',
        showUpgrade: true,
        icon: '🔒'
      };
    }

    // Subject-based subscriptions (access only to selected subjects)
    if (
      subscriptionStatus.status === 'subject_based' ||
      subscriptionStatus.subscription_status === 'subject_based'
    ) {
      const planName = subscriptionStatus.plan_name || 'Subject-Based Plan';
      const validUntil = subscriptionStatus.valid_until
        ? new Date(subscriptionStatus.valid_until).toLocaleDateString()
        : 'Active';
      const totalSubjects =
        subscriptionStatus.total_subjects ||
        (subscriptionStatus.accessible_subjects && subscriptionStatus.accessible_subjects.length) ||
        null;

      return {
        type: 'premium',
        title: planName,
        message: `Valid until: ${validUntil}`,
        showUpgrade: true,
        icon: '📚',
        features: [
          totalSubjects
            ? `Access to ${totalSubjects} purchased subject${totalSubjects > 1 ? 's' : ''}`
            : 'Access to purchased subjects',
          'AI Tutor on purchased subjects',
          'Standard analytics'
        ]
      };
    }

    // Check if user has active subscription (PLUS / PRO plans)
    if (subscriptionStatus.has_subscription === true && subscriptionStatus.is_active === true) {
      const planName = subscriptionStatus.plan_name || 'Premium Plan';
      const validUntil = subscriptionStatus.valid_until
        ? new Date(subscriptionStatus.valid_until).toLocaleDateString()
        : 'Active';

      const statusLabel = (subscriptionStatus.subscription_status || subscriptionStatus.status || '').toLowerCase();
      const planNameLower = (planName || '').toLowerCase();
      const tier =
        subscriptionStatus.tier ||
        (statusLabel.includes('pro') || planNameLower.includes('pro')
          ? 'pro'
          : (statusLabel.includes('plus') || planNameLower.includes('plus') ? 'plus' : null));

      let features;
      if (tier === 'pro') {
        features = planFeatures.pro;
      } else if (tier === 'plus') {
        features = planFeatures.plus;
      } else {
        // Fallback generic premium features
        features = ['Access to all subjects', 'AI Tutor', 'Advanced analytics', 'Priority support'];
      }

      return {
        type: 'premium',
        title: planName,
        message: `Valid until: ${validUntil}`,
        showUpgrade: false,
        icon: '👑',
        features
      };
    }

    // Check if user is on free trial or free plan
    if (subscriptionStatus.status === 'free_trial' || subscriptionStatus.status === 'free') {
      return {
        type: 'free_trial',
        title: 'Free Trial',
        message: 'You\'re currently on a free trial. Upgrade to unlock all features.',
        showUpgrade: true,
        icon: '⏰',
        features: planFeatures.free
      };
    }

    // Fallback: Check user data for premium status
    if (userInfo && userInfo.subscription_status === 'premium') {
      const planName = userInfo.subscription_plan || 'Premium Plan';
      return {
        type: 'premium',
        title: planName,
        message: 'Premium access active',
        showUpgrade: false,
        icon: '👑',
        features: ['Access to all subjects', 'AI Tutor', 'Advanced analytics', 'Priority support']
      };
    }

    // Default to free plan
    return {
      type: 'free',
      title: 'Free Plan',
      message: 'You\'re using the free plan. Upgrade to unlock premium features.',
      showUpgrade: true,
      icon: '📚',
      features: ['Limited access to subjects', 'Basic features']
    };
  }, [subscriptionStatus, subscriptionLoading, userInfo]);

  const planMessage = getPlanMessage();

  if (isLoading) {
    return <div className={styles['loading']}>Loading...</div>;
  }

  return (
            <div className={`${styles['settings-container']} ${isDarkMode ? styles['dark-theme'] : styles['light-theme']}`}>
        <div className={styles['profile-header']}>
            <div className={styles['header-content']}>
                <h2 className={styles['title']}>
                    Account Settings
                </h2>

                <p className={styles['subtitle']}>
                    Manage your profile and subscription preferences.
                </p>
      </div>
      
      {/* Logout Icon positioned in top right */}
      <div className={styles['logout-container']}>
        <button 
          className={styles['logout-button']}
          onClick={handleLogout}
          aria-label="Logout"
        >
          <span className={styles['logout-text']}>Logout</span>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
        </div>
        
        {/* Dynamic Plan Section */}
        <div className={`${styles['trial-plan-section']} ${styles[`plan-${planMessage.type}`]}`}>
          <div className={styles['trial-plan-content']}>
            <div className={styles['trial-plan-left']}>
              <div className={styles['trial-plan-icon']}>
                {planMessage.icon ? (
                  <span style={{ fontSize: '24px' }}>{planMessage.icon}</span>
                ) : (
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z" fill="white"/>
                  </svg>
                )}
              </div>
              <div className={styles['trial-plan-text']}>
                <h3 className={styles['trial-plan-title']}>{planMessage.title}</h3>
                <p className={styles['trial-plan-days']}>{planMessage.message}</p>
                {planMessage.features && (
                  <div className={styles['trial-plan-features']}>
                    {planMessage.features.map((feature, index) => (
                      <span key={index} className={styles['feature-tag']}>{feature}</span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {planMessage.showUpgrade && (
              <div className={styles['trial-plan-right']}>
                <button 
                  className={styles['upgrade-now-button']}
                  onClick={() => router.push('/upgrade')}
                >
                  <img src="/assets/crown.png" alt="Crown" width="16" height="16" style={{ filter: 'brightness(0) invert(1)' }} />
                  Upgrade Now
                </button>
              </div>
            )}
          </div>
        </div>

      {/* Main Content */}
      <div className={styles['settings-info']}>
        <>
            {/* Profile Information Section */}
            <div className={styles['profile-info-section']}>
              <div className={styles['profile-info-card']}>
                <h3 className={styles['profile-info-title']}>Profile Information</h3>
              <div className={styles['profile-form']}>
                {[
                  ['Full Name', 'name', 'person'],
                  ['Email Address', 'email', 'envelope'],
                  ['Phone Number', 'phoneNumber', 'phone'],
                  ['Gender', 'gender', 'dropdown'],
                  ['College', 'collegeName', 'building'],
                  ['University', 'university', 'location']
                ].map(([label, field, iconType]) => (
                  <div className={styles['profile-input-group']} key={field}>
                    <label className={styles['profile-field-label']}>
                      {label}
                    </label>
                    <div className={styles['profile-input-container']}>
                      <div className={styles['profile-input-icon']}>
                        {iconType === 'person' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" fill="currentColor"/>
                          </svg>
                        )}
                        {iconType === 'envelope' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="currentColor"/>
                          </svg>
                        )}
                        {iconType === 'phone' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="currentColor"/>
                          </svg>
                        )}
                        {iconType === 'dropdown' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="currentColor"/>
                          </svg>
                        )}
                        {iconType === 'building' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z" fill="currentColor"/>
                          </svg>
                        )}
                        {iconType === 'location' && (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                          </svg>
                        )}
                      </div>
                    {field === 'gender' ? (
                      isEditing ? (
                        <select
                            className={`${styles['profile-field-input']} ${styles['gender-select']}`}
                          value={userInfo?.[field] || ''}
                          onChange={(e) => setUserInfo({ ...userInfo, [field]: e.target.value })}
                        >
                          <option value="">Select gender</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={userInfo?.[field] ? (userInfo[field] === 'male' ? 'Male' : userInfo[field] === 'female' ? 'Female' : userInfo[field]) : 'Not specified'}
                          readOnly={true}
                          className={`${styles['profile-field-input']} ${styles['readonly-field']}`}
                          placeholder="Gender not specified"
                        />
                      )
                    ) : field === 'phoneNumber' ? (
                      <div className={styles['phone-number-container']}>
                        <input
                          type="tel"
                          value={userInfo?.[field] || ''}
                          readOnly={true}
                          className={`${styles['profile-field-input']} ${styles['readonly-field']}`}
                          maxLength={10}
                          placeholder="Phone number cannot be changed"
                          title="Phone number cannot be edited for security reasons"
                        />
                        <div className={styles['lock-icon']} title="Phone number is locked and cannot be changed">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" fill="currentColor"/>
                          </svg>
                        </div>
                      </div>
                    ) : field === 'university' ? (
                      <div className={styles['phone-number-container']}>
                        <input
                          type="text"
                          value={userInfo?.[field] || ''}
                          readOnly={true}
                          className={`${styles['profile-field-input']} ${styles['readonly-field']}`}
                          placeholder="University cannot be changed"
                          title="University is locked and cannot be changed"
                        />
                        <div className={styles['lock-icon']} title="University is locked and cannot be changed">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" fill="currentColor"/>
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <input
                        type={field === 'email' ? 'email' : 'text'}
                        value={userInfo?.[field] || ''}
                        readOnly={!isEditing}
                          className={styles['profile-field-input']}
                        placeholder={`Enter your ${label.toLowerCase()}`}
                        onChange={(e) => setUserInfo({ ...userInfo, [field]: e.target.value })}
                      />
                    )}
                    </div>
                    {errors?.[field] && (
                      <div className={styles['error-message']}>{errors[field]}</div>
                    )}
                  </div>
                ))}
                
                {/* Success Message */}
                {updateSuccess && (
                  <div className={styles['success-message']}>Profile updated successfully!</div>
                )}
                {/* Error Messages */}
                {errors.fetch && <div className={styles['error-message']}>{errors.fetch}</div>}
                {errors.update && <div className={styles['error-message']}>{errors.update}</div>}
              </div>
              
              {/* Edit Profile Button or Save/Cancel buttons positioned in bottom right */}
              <div className={styles['edit-profile-button-container']}>
                {isEditing ? (
                  <div className={styles['edit-buttons-group']}>
                    <button className={styles['save-changes-button']} onClick={handleUpdate}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                        <path d="m9 11 3 3L22 4"/>
                      </svg>
                      Save Changes
                    </button>
                    <button className={styles['cancel-button']} onClick={() => {
                      setIsEditing(false);
                      setErrors({});
                      fetchUserData(); // Reset to original data
                    }}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles['edit-profile-button']}
                    onClick={() => setIsEditing(true)}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      className="bi bi-pencil-square"
                      viewBox="0 0 16 16"
                    >
                      <path d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                      <path
                        fillRule="evenodd"
                        d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5z"
                      />
                    </svg>
                    Edit Profile
                  </button>
                )}
              </div>
              </div>
              </div>
              {/* Active Devices Section */}
              <div className={styles['profile-info-section']}>
                <div className={styles['profile-info-card']}>
                  <h3 className={styles['profile-info-title']}>Active Devices</h3>
                  <div style={{ marginTop: '12px' }}>
                    <DeviceManagement />
                  </div>
                </div>
              </div>
          </>
      </div>
    </div>
  );
};

export default Profile;

