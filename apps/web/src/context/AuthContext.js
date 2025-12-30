"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { performCompleteLogout, clearAllUserData } from '../lib/api';

const AuthContext = createContext();

// Helper function to decode base64 safely
const decodeBase64 = (str) => {
    try {
        // Use atob if available (browser environment)
        if (typeof atob !== 'undefined') {
            return atob(str);
        }
        // Fallback for Node.js environment
        return Buffer.from(str, 'base64').toString('utf-8');
    } catch (error) {
        console.error('Error decoding base64:', error);
        return null;
    }
};

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const [profileCompletion, setProfileCompletion] = useState(null);

    // Initialize auth state from localStorage - OPTIMIZED for speed
    useEffect(() => {
        if (typeof window !== 'undefined') {
            // Get auth data first (critical path)
            const storedToken = localStorage.getItem('token');
            const storedMobile = localStorage.getItem('mobile');
            
            if (storedToken && storedMobile) {
                setToken(storedToken);
                setUser({ mobile: storedMobile });
                setIsAuthenticated(true);
            }
            setLoading(false);
            setIsHydrated(true);
            
            // Clear stale cached data in background (non-blocking)
            // Only clear specific known keys instead of iterating all localStorage
            requestIdleCallback ? requestIdleCallback(() => {
                ['userYear', 'userSemester'].forEach(key => localStorage.removeItem(key));
                // Only iterate if we need to clear pattern-based keys
                const keysToRemove = [];
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key && (key.startsWith('cachedUserName_') || key.startsWith('studyPlan_'))) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(key => localStorage.removeItem(key));
            }) : setTimeout(() => {
                ['userYear', 'userSemester'].forEach(key => localStorage.removeItem(key));
            }, 0);
        } else {
            // For SSR, set hydrated immediately
            setIsHydrated(true);
            setLoading(false);
        }
        
        // Listen for auth events from API layer
        const handleAuthChange = (event) => {
            console.log('🔄 Auth change event received:', event.detail);
            const { token: newToken, user: newUser } = event.detail;
            
            if (newToken) {
                setToken(newToken);
                setIsAuthenticated(true);
                
                if (newUser) {
                    setUser(newUser);
                }
            }
        };
        
        const handleAuthLogout = () => {
            console.log('🚪 Auth logout event received');
            logout();
        };
        
        if (typeof window !== 'undefined') {
            window.addEventListener('auth-change', handleAuthChange);
            window.addEventListener('auth-logout', handleAuthLogout);
        }
        
        // Cleanup event listeners
        return () => {
            if (typeof window !== 'undefined') {
                window.removeEventListener('auth-change', handleAuthChange);
                window.removeEventListener('auth-logout', handleAuthLogout);
            }
        };
    }, []);

    // Login function - updated to handle refresh tokens
    const login = (userData, accessToken, refreshToken = null) => {
        console.log('🔐 AuthContext: Login called with userData:', userData);
        console.log('🔐 AuthContext: Token (first 20 chars):', accessToken.substring(0, 20) + '...');
        
        if (typeof window !== 'undefined') {
            // Use the centralized clean login function to ensure no stale data
            import('../lib/api').then((apiModule) => {
                if (apiModule.ensureCleanLogin) {
                    apiModule.ensureCleanLogin();
                    console.log('🔐 AuthContext: Using centralized clean login function');
                } else {
                    // Fallback to manual cleanup if centralized function not available
                    console.log('🔐 AuthContext: Fallback to manual cleanup');
                    
                    // Clear any previous user data to prevent showing wrong information
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && (key.startsWith('cachedUserName_') || key.includes('user'))) {
                            keysToRemove.push(key);
                        }
                    }
                    console.log('🔐 AuthContext: Clearing previous user data keys:', keysToRemove);
                    keysToRemove.forEach(key => localStorage.removeItem(key));
                }
                
                // Set new authentication data
                localStorage.setItem('token', accessToken);
                localStorage.setItem('mobile', userData.mobile);
                localStorage.setItem('isIdentified', 'true');
                
                // Store refresh token if provided
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                    console.log('🔐 AuthContext: Refresh token stored');
                }
                
                // Store userInfo for payment processing
                localStorage.setItem('userInfo', JSON.stringify(userData));
                
                // Set first login timestamp if not exists
                if (!localStorage.getItem('firstLogin')) {
                    localStorage.setItem('firstLogin', Date.now().toString());
                }
                localStorage.setItem('lastLogin', Date.now().toString());
                
                console.log('🔐 AuthContext: Authentication data stored in localStorage');
                
                // Update state
                setToken(accessToken);
                setUser(userData);
                setIsAuthenticated(true);
                setProfileCompletion(null);
                console.log('🔐 AuthContext: Login completed successfully');
                
                // Dispatch custom event to notify other components
                window.dispatchEvent(new CustomEvent('auth-change', { 
                    detail: { userData, accessToken, refreshToken } 
                }));
            }).catch((error) => {
                console.error('🔐 AuthContext: Error importing clean login function:', error);
                // Fallback to basic login
                localStorage.setItem('token', accessToken);
                localStorage.setItem('mobile', userData.mobile);
                localStorage.setItem('isIdentified', 'true');
                
                if (refreshToken) {
                    localStorage.setItem('refreshToken', refreshToken);
                }
                
                setToken(accessToken);
                setUser(userData);
                setIsAuthenticated(true);
                setProfileCompletion(null);
                console.log('🔐 AuthContext: Login completed successfully (fallback)');
            });
        } else {
            // Update state for SSR
            setToken(accessToken);
            setUser(userData);
            setIsAuthenticated(true);
            setProfileCompletion(null);
        }
    };

    // Logout function - optimized for immediate execution
    const logout = () => {
        console.log('🔐 AuthContext: Logout called');
        
        if (typeof window !== 'undefined') {
            try {
                // Use the centralized logout function directly
                performCompleteLogout();
                console.log('🔐 AuthContext: Using centralized logout function');
                
                // Reset all state
                setToken(null);
                setUser(null);
                setIsAuthenticated(false);
                setProfileCompletion(null);
                
                // Immediate redirect to login
                window.location.href = '/login';
            } catch (error) {
                console.error('🔐 AuthContext: Error during logout:', error);
                // Fallback to manual cleanup if centralized function fails
                console.log('🔐 AuthContext: Fallback to manual cleanup');
                
                try {
                    clearAllUserData();
                    console.log('🧹 Cleared all user data and API caches on logout');
                } catch (clearError) {
                    console.error('🔐 AuthContext: Error clearing user data:', clearError);
                }
                
                // Clear ALL authentication and user-related data
                const allKeysToRemove = [];
                
                // Get all localStorage keys
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key) {
                        // Remove ALL user-related data
                        if (key.includes('user') || 
                            key.includes('token') || 
                            key.includes('mobile') || 
                            key.includes('auth') || 
                            key.includes('login') || 
                            key.includes('session') ||
                            key.includes('profile') ||
                            key.includes('cached') ||
                            key.includes('course') ||
                            key.includes('progress') ||
                            key.includes('section') ||
                            key.includes('video') ||
                            key.includes('chat') ||
                            key.includes('subject') ||
                            key.includes('exam') ||
                            key.includes('schedule') ||
                            key.includes('coach')) {
                            allKeysToRemove.push(key);
                        }
                    }
                }
                
                console.log('🔐 AuthContext: Clearing ALL user-related keys on logout:', allKeysToRemove);
                
                // Clear all identified keys
                allKeysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                    console.log(`  - removed: ${key}`);
                });
                
                // Also clear sessionStorage if any user data is stored there
                if (sessionStorage.length > 0) {
                    for (let i = 0; i < sessionStorage.length; i++) {
                        const key = sessionStorage.key(i);
                        if (key && (key.includes('user') || key.includes('token') || key.includes('auth'))) {
                            sessionStorage.removeItem(key);
                            console.log(`  - removed from sessionStorage: ${key}`);
                        }
                    }
                }
                
                // Clear any cookies that might contain user data
                document.cookie.split(";").forEach(function(c) { 
                    document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
                });
                
                console.log('🔐 AuthContext: Complete data cleanup completed');
                
                // Reset all state
                setToken(null);
                setUser(null);
                setIsAuthenticated(false);
                setProfileCompletion(null);
                
                // Redirect to login
                window.location.href = '/login';
            }
        } else {
            // Reset all state for SSR
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
            setProfileCompletion(null);
        }
        
        console.log('🔐 AuthContext: Logout completed successfully');
    };

    // Update user data
    const updateUser = (userData) => {
        setUser(prev => ({ ...prev, ...userData }));
    };

    // Automatic token refresh function (header-based, no refreshToken required)
    const refreshAccessToken = async () => {
        try {
            const currentToken = typeof window !== 'undefined' ? localStorage.getItem('token') : token;
            if (!currentToken) {
                console.log('🔄 No access token available for refresh');
                return false;
            }

            console.log('🔄 Attempting to refresh access token (header-based)...');
            
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                
                // Update localStorage with new tokens
                localStorage.setItem('token', data.access_token);
                if (data.refresh_token) {
                    localStorage.setItem('refreshToken', data.refresh_token);
                }
                if (data.user_info) {
                    localStorage.setItem('userInfo', JSON.stringify(data.user_info));
                }
                
                // Update state
                setToken(data.access_token);
                if (data.user_info) {
                    setUser(data.user_info);
                }
                
                console.log('✅ Token refreshed successfully');
                return true;
            } else {
                console.error('❌ Token refresh failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('❌ Error refreshing token:', error);
            return false;
        }
    };

    // Check if token is valid with automatic refresh
    const isTokenValid = async () => {
        if (!token) return false;
        
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            const payloadStr = decodeBase64(parts[1]);
            if (!payloadStr) return false;
            
            const payload = JSON.parse(payloadStr);
            const currentTime = Date.now() / 1000;
            
            // Check if token is expired
            const isExpired = payload.exp <= currentTime;
            
            // Log token validation details for debugging
            if (process.env.NODE_ENV === 'development') {
                console.log('Token validation:', {
                    currentTime: new Date(currentTime * 1000),
                    expiryTime: new Date(payload.exp * 1000),
                    timeRemaining: payload.exp - currentTime,
                    isExpired: isExpired
                });
            }
            
            // If token is expired, try to refresh it
            if (isExpired) {
                console.log('🔄 Access token expired, attempting refresh...');
                const refreshed = await refreshAccessToken();
                if (refreshed) {
                    console.log('✅ Token refreshed, user stays logged in');
                    return true;
                } else {
                    console.log('❌ Token refresh failed, user will be logged out');
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error parsing token:', error);
            // Don't fail validation on parsing errors - let the backend handle it
            return true;
        }
    };

    // Synchronous token check (for immediate validation without refresh)
    const isTokenValidSync = () => {
        if (!token) return false;
        
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            const payloadStr = decodeBase64(parts[1]);
            if (!payloadStr) return false;
            
            const payload = JSON.parse(payloadStr);
            const currentTime = Date.now() / 1000;
            
            // Add a 5-minute buffer to prevent premature expiration
            const bufferTime = 5 * 60; // 5 minutes in seconds
            const isValid = payload.exp > (currentTime - bufferTime);
            
            return isValid;
        } catch (error) {
            console.error('Error parsing token:', error);
            return true;
        }
    };

    // More lenient token check for API calls
    const isTokenValidForAPI = () => {
        if (!token) return false;
        
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return false;
            
            const payloadStr = decodeBase64(parts[1]);
            if (!payloadStr) return false;
            
            const payload = JSON.parse(payloadStr);
            const currentTime = Date.now() / 1000;
            
            // More lenient check - only fail if token is clearly expired (more than 1 hour past expiry)
            const gracePeriod = 60 * 60; // 1 hour in seconds
            return payload.exp > (currentTime - gracePeriod);
        } catch (error) {
            console.error('Error parsing token for API:', error);
            // For API calls, be more lenient and let the backend decide
            return true;
        }
    };

    const checkProfileCompletion = useCallback(async (force = false) => {
        if (!token) {
            return false;
        }

        if (!force && profileCompletion !== null) {
            return profileCompletion;
        }

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/'}/api/auth/profile-completion-status`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setProfileCompletion(data.is_profile_complete);
                return data.is_profile_complete;
            }

            setProfileCompletion(true);
            return true;
        } catch (error) {
            console.error('Error fetching profile completion status:', error);
            setProfileCompletion(true);
            return true;
        }
    }, [token, profileCompletion]);

    const value = {
        user,
        token,
        loading,
        isAuthenticated,
        isHydrated,
        login,
        logout,
        updateUser,
        isTokenValid,
        isTokenValidSync,
        isTokenValidForAPI,
        refreshAccessToken,
        profileCompletion,
        checkProfileCompletion
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

