"use client";

import { usePathname } from 'next/navigation';
import { useState, useEffect, useRef, memo } from 'react';
import { LayoutProvider, useLayout } from '../context/LayoutContext';
import { ThemeProvider } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import useActiveTimeTracker from '../hooks/useActiveTimeTracker';

import dynamic from 'next/dynamic';
const Navbar = dynamic(() => import('./Navbar'), { ssr: false });
const Upgrade = dynamic(() => import('./Upgrade'), { ssr: false });
import LoadingProgress from './LoadingProgress';
import PageLoader from './PageLoader';

// Memoized MainLayout for better performance
const MainLayout = memo(({ children }) => {
    const { showUpgrade } = useLayout();
    const pathname = usePathname();
    const isAITutorPage = pathname === '/Ask-ai';

    // If it's the AI Tutor page, don't show the navbar but keep the layout structure
    if (isAITutorPage) {
        return (
            <div className="app-container">
                <div className="main-wrapper">
                    <main className="main-content">
                        <div className="dashboard-content">
                            {showUpgrade ? <Upgrade /> : children}
                        </div>
                    </main>
                </div>
            </div>
        );
    }

    return (
        <div className="app-container">
            <Navbar />
            <div className="main-wrapper">
                <main className="main-content">
                    <div className="dashboard-content">
                        {showUpgrade ? <Upgrade /> : children}
                    </div>
                </main>
            </div>
        </div>
    );
});

MainLayout.displayName = 'MainLayout';

// Optimized RootLayoutClient with reduced re-renders
const RootLayoutClient = memo(({ children }) => {
    const pathname = usePathname();
    const isPreLogin = pathname === '/' || pathname === '/prelogin' || pathname === '/login' || pathname === '/onboarding';
    const [isCourseContent, setIsCourseContent] = useState(false);
    const courseContentRef = useRef(false);
    const authContext = useAuth();
    const { user, isAuthenticated } = authContext || { user: null, isAuthenticated: false };
    const [isNavLoading, setIsNavLoading] = useState(false);
    const [skeletonActive, setSkeletonActive] = useState(false);
    const prevPathnameRef = useRef(pathname);
    const loadingTimeoutRef = useRef(null);

    // Determine identifier (id preferred, fallback to mobile). Call hook unconditionally.
    const userIdentifier = (!isPreLogin && isAuthenticated) ? (user?.id || user?.mobile || null) : null;
    useActiveTimeTracker(userIdentifier);
    
    // Track skeleton usage from pages and show loader only while skeleton is active
    useEffect(() => {
        const onStart = () => {
            setSkeletonActive(true);
            setIsNavLoading(true);
        };
        const onEnd = () => {
            setSkeletonActive(false);
            // Delay hiding loader to ensure smooth transition
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
            loadingTimeoutRef.current = setTimeout(() => {
                setIsNavLoading(false);
            }, 200);
        };
        window.addEventListener('page-skeleton-start', onStart);
        window.addEventListener('page-skeleton-end', onEnd);
        return () => {
            window.removeEventListener('page-skeleton-start', onStart);
            window.removeEventListener('page-skeleton-end', onEnd);
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, []);

    // Show loading on route change
    useEffect(() => {
        // Only show loading if pathname actually changed (not initial mount)
        if (prevPathnameRef.current !== pathname && prevPathnameRef.current !== null) {
            setIsNavLoading(true);
            
            // Auto-hide after 2 seconds if skeleton doesn't trigger
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
            loadingTimeoutRef.current = setTimeout(() => {
                // Only hide if skeleton hasn't taken over
                if (!skeletonActive) {
                    setIsNavLoading(false);
                }
            }, 2000);
        }
        
        // Update previous pathname
        prevPathnameRef.current = pathname;
        
        return () => {
            if (loadingTimeoutRef.current) {
                clearTimeout(loadingTimeoutRef.current);
            }
        };
    }, [pathname, skeletonActive]);

    // Fail-safe: ensure the nav loader can never remain stuck indefinitely
    // This preserves existing behavior but guarantees PageLoader hides
    // even if skeleton events or route effects fail for any reason.
    useEffect(() => {
        if (!isNavLoading) return;
        const maxLoaderTimeout = setTimeout(() => {
            setIsNavLoading(false);
        }, 3000); // hard cap nav loader to 3s
        return () => {
            clearTimeout(maxLoaderTimeout);
        };
    }, [isNavLoading]);

    useEffect(() => {
        const check = () => {
            // Add null check to prevent error during SSR
            if (typeof document === 'undefined' || !document.body) return;
            
            const hasCourseContentClass = document.body.classList.contains('course-content-active');
            
            // Only update state if it actually changed to prevent unnecessary re-renders
            if (courseContentRef.current !== hasCourseContentClass) {
                courseContentRef.current = hasCourseContentClass;
                // Use requestAnimationFrame to batch state updates and prevent rapid re-renders
                requestAnimationFrame(() => {
                    setIsCourseContent(hasCourseContentClass);
                });
            }
        };

        // Check immediately
        check();

        // Use a more stable approach - only check on specific events
        const handleCourseContentChange = () => {
            check();
        };

        window.addEventListener('course-content-toggle', handleCourseContentChange);
        
        return () => {
            window.removeEventListener('course-content-toggle', handleCourseContentChange);
        };
    }, []);

    // Ensure body doesn't keep course-content-active when leaving CourseContent
    useEffect(() => {
        if (typeof document === 'undefined' || !document.body) return;
        const body = document.body;
        const html = document.documentElement;
        const goingToSubjects = pathname?.startsWith('/subjects');
        const isNonCourseRoute = !(pathname?.startsWith('/course') || pathname?.startsWith('/content') || goingToSubjects);

        // Always clear on non-course routes
        if (isNonCourseRoute && body.classList.contains('course-content-active')) {
            body.classList.remove('course-content-active');
            html.classList.remove('course-content-active');
            body.classList.remove('ios');
            courseContentRef.current = false;
            setIsCourseContent(false);
            try { window.dispatchEvent(new Event('course-content-toggle')); } catch {}
        }

        // Special case: when returning to Subjects, ensure page is unlocked immediately
        if (goingToSubjects && body.classList.contains('course-content-active')) {
            body.classList.remove('course-content-active');
            html.classList.remove('course-content-active');
            body.classList.remove('ios');
            courseContentRef.current = false;
            setIsCourseContent(false);
            try { window.dispatchEvent(new Event('course-content-toggle')); } catch {}
        }
    }, [pathname]);

    if (isPreLogin) {
        return (
            <div className="prelogin-body">
                {children}
            </div>
        );
    }

    // Use a single div element with conditional classes and content
    return (
        <div className={isCourseContent ? 'course-content-body' : ''}>
            <ThemeProvider>
                <LayoutProvider isCourseContent={isCourseContent}>
                    {isNavLoading && (
                        <PageLoader message="Loading..." size="large" fullScreen delayMs={0} showLogo />
                    )}
                    <MainLayout>{children}</MainLayout>
                </LayoutProvider>
            </ThemeProvider>
        </div>
    );
});

RootLayoutClient.displayName = 'RootLayoutClient';

export default RootLayoutClient;

