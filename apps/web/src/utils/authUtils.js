// Authentication utility functions
import { performCompleteLogout, clearAllUserData } from '../lib/api';

// Check if user is properly authenticated
export const checkAuthentication = () => {
  if (typeof window === 'undefined') return false;
  
  const token = localStorage.getItem('token');
  const mobile = localStorage.getItem('mobile');
  
  if (!token || !mobile) {
    console.log('🔒 No authentication data found');
    return false;
  }
  
  // Check if token is expired
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.log('🔒 Invalid token format');
      return false;
    }
    
    const payload = JSON.parse(atob(parts[1]));
    const currentTime = Date.now() / 1000;
    
    if (payload.exp < currentTime) {
      console.log('🔒 Token expired');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('🔒 Error checking token:', error);
    return false;
  }
};

// Force logout and redirect - optimized for immediate execution
export const forceLogout = () => {
  if (typeof window === 'undefined') return;
  
  console.log('🔒 Force logout called');
  
  try {
    // Use the centralized logout function directly
    performCompleteLogout();
    console.log('🔒 Force logout: Using centralized logout function');
    
    // Immediate redirect to login
    window.location.href = '/login';
  } catch (error) {
    console.error('🔒 Force logout: Error during logout:', error);
    // Fallback to manual cleanup if centralized function fails
    console.log('🔒 Force logout: Fallback to manual cleanup');
    
    try {
      clearAllUserData();
      console.log('🧹 Cleared all user data and API caches on force logout');
    } catch (clearError) {
      console.error('🔒 Force logout: Error clearing user data:', clearError);
    }
    
    // Clear ALL localStorage
    localStorage.clear();
    
    // Clear sessionStorage
    sessionStorage.clear();
    
    // Clear cookies
    document.cookie.split(";").forEach(function(c) { 
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
    });
    
    // Redirect to login
    window.location.href = '/login';
  }
};

// Debug current user data
export const debugUserData = () => {
  if (typeof window === 'undefined') {
    console.log('🔍 Debug: Running on server side');
    return;
  }

  console.log('🔍 === USER DATA DEBUG ===');
  
  // Check localStorage data
  const token = localStorage.getItem('token');
  const mobile = localStorage.getItem('mobile');
  const userInfo = localStorage.getItem('userInfo');
  const isIdentified = localStorage.getItem('isIdentified');
  
  console.log('📱 localStorage data:');
  console.log('  - token:', token ? `${token.substring(0, 20)}...` : 'null');
  console.log('  - mobile:', mobile);
  console.log('  - isIdentified:', isIdentified);
  console.log('  - userInfo:', userInfo ? JSON.parse(userInfo) : 'null');
  
  // Check for any cached user data
  const cachedKeys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.includes('user') || key.includes('cached'))) {
      cachedKeys.push(key);
    }
  }
  console.log('  - cached user keys:', cachedKeys);
  
  // Check authentication status
  const isAuth = checkAuthentication();
  console.log('🔐 Authentication status:', isAuth);
  
  console.log('🔍 === END DEBUG ===');
};

// Sync user data from API
export const syncUserData = async () => {
  if (typeof window === 'undefined') return;
  
  const token = localStorage.getItem('token');
  if (!token) {
    console.log('🔒 No token found for sync');
    return;
  }
  
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000'}/api/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log('🔄 Syncing user data:', data);
      
      // Update localStorage with fresh data
      localStorage.setItem('mobile', data.mobile);
      localStorage.setItem('userInfo', JSON.stringify(data));
      
      console.log('✅ User data synced successfully');
    } else {
      console.log('❌ Failed to sync user data');
    }
  } catch (error) {
    console.error('❌ Error syncing user data:', error);
  }
};

