"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';

const LayoutContext = createContext();

export function LayoutProvider({ children, isCourseContent = false }) {
    const [isMobile, setIsMobile] = useState(() => {
        try {
            if (typeof window !== 'undefined') {
                return window.innerWidth <= 768;
            }
        } catch {}
        return false;
    });
    const [isHydrated, setIsHydrated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [showUpgrade, setShowUpgrade] = useState(false);
    const [navigationState, setNavigationState] = useState('idle'); // idle, navigating, ready
    const resizeTimeoutRef = useRef(null);
    const navigationTimeoutRef = useRef(null);

    // Instant hydration for production-ready performance
    useEffect(() => {
        setIsHydrated(true);
        // Immediate loading state for instant navigation
        setIsLoading(false);
        setNavigationState('ready');
        // Immediately verify mobile state on mount to avoid one-frame mismatch
        try {
            if (typeof window !== 'undefined') {
                setIsMobile(window.innerWidth <= 768);
            }
        } catch {}
    }, []);

    // Optimized mobile detection with caching
    const checkMobile = useCallback(() => {
        try {
            if (typeof window !== 'undefined') {
                const mobile = window.innerWidth <= 768;
                setIsMobile(mobile);
            }
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Error in mobile detection:', error);
            }
            setIsMobile(false);
        }
    }, []);

    // Debounced resize handler for better performance
    const handleResize = useCallback(() => {
        if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
        }
        resizeTimeoutRef.current = setTimeout(checkMobile, 100); // Reduced debounce time
    }, [checkMobile]);

    useEffect(() => {
        if (!isHydrated) return;
        
        try {
            checkMobile();
            window.addEventListener('resize', handleResize, { passive: true });
            
            return () => {
                window.removeEventListener('resize', handleResize);
                if (resizeTimeoutRef.current) {
                    clearTimeout(resizeTimeoutRef.current);
                }
            };
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.error('Error setting up mobile detection:', error);
            }
        }
    }, [isHydrated, checkMobile, handleResize]);

    // Navigation state management for instant transitions
    const startNavigation = useCallback(() => {
        setNavigationState('navigating');
        // Clear any existing timeout
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
        }
        // Reset to ready state quickly
        navigationTimeoutRef.current = setTimeout(() => {
            setNavigationState('ready');
        }, 50);
    }, []);

    // Memoized context value to prevent unnecessary re-renders
    const contextValue = useMemo(() => ({
        isMobile,
        isHydrated,
        isLoading,
        showUpgrade,
        setShowUpgrade,
        navigationState,
        startNavigation,
        isCourseContent
    }), [isMobile, isHydrated, isLoading, showUpgrade, navigationState, startNavigation, isCourseContent]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (resizeTimeoutRef.current) {
                clearTimeout(resizeTimeoutRef.current);
            }
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
            }
        };
    }, []);

    return (
        <LayoutContext.Provider value={contextValue}>
            {children}
        </LayoutContext.Provider>
    );
}

export function useLayout() {
    const context = useContext(LayoutContext);
    if (!context) {
        throw new Error('useLayout must be used within a LayoutProvider');
    }
    return context;
}

