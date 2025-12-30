import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import styles from './Navbar.module.css';
import { useLayout } from '../context/LayoutContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { performCompleteLogout, clearAllUserData } from '../lib/api';
import navigationMonitor from '../utils/navigationPerformance';
import { useDashboard } from '../hooks/useDashboard';

// Optimized notifications - only load when needed
const getMockNotifications = () => [
    {
        id: 1,
        name: 'Leaderboard Update',
        text: 'Congratulations! You have moved up to the top 10 in the leaderboard.',
        time: '1 hour ago',
        type: 'leaderboard'
    },
    {
        id: 2,
        name: 'Special Offer',
        text: 'Get 50% off on our premium pack. Limited time offer!',
        time: '3 hours ago',
        type: 'offer'
    }
];

const Navbar = React.memo(() => {
    const { isMobile, showUpgrade, setShowUpgrade, isHydrated, isLoading, navigationState, startNavigation, isCourseContent } = useLayout();
    const { isDarkMode, toggleTheme } = useTheme();
    const [showDropdown, setShowDropdown] = useState(false);
    const [showMobileMenu, setShowMobileMenu] = useState(false);
    
    // Debug mobile detection
    useEffect(() => {
        console.log('📱 Navbar - isMobile:', isMobile, 'window.innerWidth:', typeof window !== 'undefined' ? window.innerWidth : 'N/A');
        console.log('📱 Navbar - isHydrated:', isHydrated);
        console.log('📱 Navbar - showMobileMenu:', showMobileMenu);
        
        // Force mobile detection for testing
        if (typeof window !== 'undefined' && window.innerWidth <= 768) {
            console.log('📱 Navbar - Should show hamburger menu on mobile');
        } else {
            console.log('📱 Navbar - Should hide hamburger menu on desktop');
        }
    }, [isMobile, isHydrated, showMobileMenu]);
    const [isNavbarReady, setIsNavbarReady] = useState(true);
    const dropdownRef = useRef(null);
    const mobileMenuRef = useRef(null);
    const mobileMenuToggleRef = useRef(null);
    const [username, setUsername] = useState('');
    const [notifications, setNotifications] = useState([]);
    const router = useRouter();
    const pathname = usePathname();
    const { logout, user } = useAuth();

    // Get user ID for streak fetching
    const userId = user?.mobile || (typeof window !== 'undefined' ? localStorage.getItem('mobile') : null);
    
    // Fetch streak data using the dashboard hook
    const { dailyStreak, isLoading: streakLoading } = useDashboard(userId, { mode: 'light' });

    // Memoized navigation paths for better performance
    const navigationPaths = useMemo(() => ({
        dashboard: '/dashboard',
        subjects: '/subjects',
        askAi: '/Ask-ai',
        importantQuestions: '/important-questions',
        schedule: '/schedule',
        smartCoach: '/smart-coach',
        profile: '/Profile',
        examPrep: '/exam-prep'
    }), []);

    // Development-only performance monitoring
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            const handleKeyPress = (e) => {
                if (e.ctrlKey && e.shiftKey && e.key === 'P') {
                    e.preventDefault();
                    navigationMonitor.logPerformanceReport();
                }
            };
            
            document.addEventListener('keydown', handleKeyPress);
            return () => document.removeEventListener('keydown', handleKeyPress);
        }
    }, []);

    // Optimized event handlers with reduced dependencies
    const handleClickOutside = useCallback((event) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
            setShowDropdown(false);
        }
    }, []);

    const handleClickOutsideMobileMenu = useCallback((event) => {
        if (mobileMenuToggleRef.current && mobileMenuToggleRef.current.contains(event.target)) {
            return;
        }
        if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) {
            setShowMobileMenu(false);
        }
    }, []);

    const handleMobileMenuToggle = useCallback(() => {
        setShowMobileMenu(prev => !prev);
        setShowDropdown(false);
    }, []);

    const handleProfileClick = useCallback(() => {
        router.push(navigationPaths.profile);
    }, [router, navigationPaths.profile]);

    const handleDeleteNotification = useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    // Ultra-fast navigation handler
    const handleNavigation = useCallback((href) => {
        if (process.env.NODE_ENV === 'development') {
            navigationMonitor.startNavigation(pathname, href);
        }
        
        startNavigation();
        setShowUpgrade(false);
        setShowDropdown(false);
        setShowMobileMenu(false);
        // Ensure any course-content page lock is cleared before navigating away
        if (typeof document !== 'undefined') {
            try { document.body.classList.remove('course-content-active'); } catch {}
            try { document.documentElement.classList.remove('course-content-active'); } catch {}
            try { document.body.classList.remove('ios'); } catch {}
            try { window.dispatchEvent(new CustomEvent('course-content-toggle')); } catch {}
        }
        router.push(href);
        
        if (process.env.NODE_ENV === 'development') {
            setTimeout(() => navigationMonitor.endNavigation(pathname, href), 50);
        }
    }, [router, startNavigation, pathname]);



    // Optimized logout handler
    const handleLogout = useCallback(() => {
        if (typeof window !== 'undefined') {
            try {
                performCompleteLogout();
                router.replace('/login');
            } catch (error) {
                try {
                    clearAllUserData();
                    localStorage.removeItem('token');
                    localStorage.removeItem('mobile');
                    localStorage.removeItem('isIdentified');
                    router.replace('/login');
                } catch (fallbackError) {
                    localStorage.clear();
                    sessionStorage.clear();
                    router.replace('/login');
                }
            }
        }
    }, [router]);



    // Optimized outside click handlers
    useEffect(() => {
        if (showDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [showDropdown, handleClickOutside]);

    useEffect(() => {
        if (showMobileMenu) {
            document.addEventListener('mousedown', handleClickOutsideMobileMenu);
            document.addEventListener('touchstart', handleClickOutsideMobileMenu);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutsideMobileMenu);
            document.removeEventListener('touchstart', handleClickOutsideMobileMenu);
        };
    }, [showMobileMenu, handleClickOutsideMobileMenu]);

    // Optimized user data fetching with caching
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
                if (token) {
                    const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app'}/api/auth/me`, {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json',
                        },
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        const name = data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim() || 'User';
                        setUsername(name);
                    } else {
                        throw new Error('Failed to fetch user data');
                    }
                } else {
                    setUsername(typeof window !== 'undefined' ? localStorage.getItem('mobile') || 'User' : 'User');
                }
            } catch (error) {
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error fetching user data:', error);
                }
                setUsername(typeof window !== 'undefined' ? localStorage.getItem('mobile') || 'User' : 'User');
            }
        };

        fetchUserData();
    }, []);

    // Load notifications only when dropdown is opened
    useEffect(() => {
        if (showDropdown && notifications.length === 0) {
            setNotifications(getMockNotifications());
        }
    }, [showDropdown, notifications.length]);

    // Listen for streak updates from other components
    useEffect(() => {
        const handleStreakUpdate = (event) => {
            console.log('🔥 Navbar received streak update:', event.detail);
            // The streak will be automatically updated by the useDashboard hook
            // This is just for logging and potential future custom handling
        };

        window.addEventListener('streak-updated', handleStreakUpdate);
        return () => window.removeEventListener('streak-updated', handleStreakUpdate);
    }, []);

    // Optimized active link checker
    const isActiveLink = useCallback((href) => {
        if (href === navigationPaths.dashboard) return pathname === navigationPaths.dashboard;
        if (href === navigationPaths.importantQuestions) return pathname === navigationPaths.importantQuestions;
        if (href === navigationPaths.schedule) return pathname === navigationPaths.schedule;
        if (href === navigationPaths.smartCoach) return pathname === navigationPaths.smartCoach;
        // Treat legacy/alias routes as active for Subjects
        if (href === navigationPaths.subjects) {
            return pathname === navigationPaths.subjects 
                || pathname.startsWith('/subjects')
                || pathname.startsWith('/course')
                || pathname.startsWith('/courses')
                || pathname.startsWith('/my-subjects');
        }
        return pathname.startsWith(href);
    }, [pathname, navigationPaths]);

    return (
        <>
            {/* Temporarily disable loading state for debugging */}
            <header className={`${styles['navbar']} navbar-stable`}>
                <div className={styles['navbar-left']}>
                    {/* Back Button for Mobile on Important Questions Page (CSS controls visibility on mobile) */}
                    {pathname === '/important-questions' && (
                        <button 
                            className={styles['mobile-back-button']}
                            onClick={() => router.back()}
                            aria-label="Go back"
                            title="Go back"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M19 12H5"/>
                                <path d="M12 19l-7-7 7-7"/>
                            </svg>
                        </button>
                    )}
                    
                    {/* Logo */}
                    <div className={styles['navbar-logo']}>
                        <Link href="/dashboard" className={styles['logo-link']} onClick={() => setShowUpgrade(false)}>
                            <Image
                                src="/assets/durranis-logo-hd.png"
                                alt="Durrani's Logo"
                                width={88}
                                height={28}
                                className={styles['logo-image']}
                                priority
                            />
                        </Link>
                    </div>
                        
                        <nav className={styles['nav-links']}>
                            <button onClick={() => handleNavigation(navigationPaths.dashboard)} className={`${styles['nav-link']} ${isActiveLink(navigationPaths.dashboard) ? styles['active'] : ''}`}>
                                <span className={styles['nav-icon']}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                        <polyline points="9,22 9,12 15,12 15,22"/>
                                    </svg>
                                </span>
                                <span className={styles['nav-text']}>Home</span>
                            </button>
                            <button onClick={() => handleNavigation(navigationPaths.subjects)} className={`${styles['nav-link']} ${isActiveLink(navigationPaths.subjects) ? styles['active'] : ''}`}>
                                <span className={styles['nav-icon']}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                                    </svg>
                                </span>
                                <span className={styles['nav-text']}>Subjects</span>
                            </button>
                            <button onClick={() => handleNavigation(navigationPaths.askAi)} className={styles['nav-link']}>
                                <span className={styles['nav-icon']}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                                        <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                                        <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
                                        <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
                                        <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
                                        <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
                                        <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
                                        <path d="M6 18a4 4 0 0 1-1.967-.516"/>
                                        <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
                                    </svg>
                                </span>
                                <span className={styles['nav-text']}>AI Tutor</span>
                            </button>
                            <button onClick={() => handleNavigation(navigationPaths.importantQuestions)} className={`${styles['nav-link']} ${isActiveLink(navigationPaths.importantQuestions) ? styles['active'] : ''}`}>
                                <span className={styles['nav-icon']}>
                                    <svg width="20" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
                                        <path d="M22 10v6"/>
                                        <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
                                    </svg>
                                </span>
                                <span className={styles['nav-text']}>Important Questions</span>
                            </button>
                            <button onClick={() => handleNavigation(navigationPaths.schedule)} className={`${styles['nav-link']} ${isActiveLink(navigationPaths.schedule) ? styles['active'] : ''}`}>
                                <span className={styles['nav-icon']}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M8 2v4"/>
                                        <path d="M16 2v4"/>
                                        <rect width="18" height="18" x="3" y="4" rx="2"/>
                                        <path d="M3 10h18"/>
                                    </svg>
                                </span>
                                <span className={styles['nav-text']}>My Schedule</span>
                            </button>
                            <button onClick={() => handleNavigation(navigationPaths.smartCoach)} className={`${styles['nav-link']} ${isActiveLink(navigationPaths.smartCoach) ? styles['active'] : ''}`}>
                                <span className={styles['nav-icon']}>
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10"/>
                                        <circle cx="12" cy="12" r="6"/>
                                        <circle cx="12" cy="12" r="2"/>
                                    </svg>
                                </span>
                                <span className={styles['nav-text']}>Smart Coach</span>
                            </button>
                        </nav>
                    </div>
                    
                    <div className={styles['navbar-right']}>
                        {/* Theme Toggle - Always present but styled differently for mobile */}
                        <button 
                            className={`${styles['icon-button']} ${styles['mobile-theme-toggle']}`}
                            aria-label="Toggle dark mode"
                            onClick={toggleTheme}
                        >
                            {isDarkMode ? (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                                    <circle cx="12" cy="12" r="5"/>
                                    <path d="M12 1v2"/>
                                    <path d="M12 21v2"/>
                                    <path d="M4.22 4.22l1.42 1.42"/>
                                    <path d="M18.36 18.36l1.42 1.42"/>
                                    <path d="M1 12h2"/>
                                    <path d="M21 12h2"/>
                                    <path d="M4.22 19.78l1.42-1.42"/>
                                    <path d="M18.36 5.64l1.42-1.42"/>
                                </svg>
                            ) : (
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                                </svg>
                            )}
                        </button>
                        
                        {/* Streak Counter - Always present but styled differently for mobile */}
                        <div className={`${styles['notification-badge']} ${styles['mobile-streak-counter']}`} style={{ position: 'relative' }}>
                            <div 
                                className={styles['action-item']}
                                style={{ cursor: 'default' }}
                                aria-hidden="true"
                            >
                                <span className={styles['action-number']}>{dailyStreak?.streak || 0}</span>
                                <svg
                                    className={styles['action-icon']}
                                    width="20"
                                    height="20"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    xmlns="http://www.w3.org/2000/svg"
                                >
                                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                                </svg>
                            </div>
                        </div>
                        
                        {/* Mobile Menu Toggle - Always render but hidden on desktop via CSS */}
                        <button 
                            ref={mobileMenuToggleRef}
                            className={`${styles['mobile-menu-toggle']} ${styles['icon-button']}`}
                            aria-label={showMobileMenu ? "Close mobile menu" : "Open mobile menu"}
                            onClick={handleMobileMenuToggle}
                        >
                            {showMobileMenu ? (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                            ) : (
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="3" y1="6" x2="21" y2="6"/>
                                    <line x1="3" y1="12" x2="21" y2="12"/>
                                    <line x1="3" y1="18" x2="21" y2="18"/>
                                </svg>
                            )}
                        </button>
                        
                        {/* Profile Icon - Always rendered; hidden on mobile via CSS */}
                        <div style={{ position: 'relative' }} className={styles['profile-button']}>
                            <button
                                className={styles['icon-button']}
                                aria-label="Profile"
                                onClick={handleProfileClick}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                    <circle cx="12" cy="7" r="4" />
                                </svg>
                            </button>
                        </div>
                    </div>
                </header>
            
            {/* Mobile Menu Full Screen */}
            <div 
                ref={mobileMenuRef}
                className={`${styles['mobile-menu-sidebar']} ${showMobileMenu ? styles['active'] : ''}`}
                onClick={(e) => {
                    // Close menu when clicking on the background (not on menu items)
                    if (e.target === e.currentTarget) {
                        setShowMobileMenu(false);
                    }
                }}
            >
                <div className={styles['mobile-menu-header']}>
                    {/* Close button removed - hamburger menu now transforms to X */}
                </div>
                
                <nav className={styles['mobile-menu-nav']}>
                    <Link 
                        href={navigationPaths.dashboard} 
                        className={`${styles['mobile-menu-nav-link']} ${isActiveLink(navigationPaths.dashboard) ? styles['active'] : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                    >
                        <span className={styles['mobile-menu-nav-icon']}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9,22 9,12 15,12 15,22"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-menu-nav-text']}>Home</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.subjects} 
                        className={`${styles['mobile-menu-nav-link']} ${isActiveLink(navigationPaths.subjects) ? styles['active'] : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                    >
                        <span className={styles['mobile-menu-nav-icon']}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-menu-nav-text']}>Subjects</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.askAi} 
                        className={`${styles['mobile-menu-nav-link']} ${isActiveLink(navigationPaths.askAi) ? styles['active'] : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                    >
                        <span className={styles['mobile-menu-nav-icon']}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
                                <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
                                <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
                                <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
                                <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
                                <path d="M6 18a4 4 0 0 1-1.967-.516"/>
                                <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-menu-nav-text']}>AI Tutor</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.importantQuestions} 
                        className={`${styles['mobile-menu-nav-link']} ${isActiveLink(navigationPaths.importantQuestions) ? styles['active'] : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                    >
                        <span className={styles['mobile-menu-nav-icon']}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
                                <path d="M22 10v6"/>
                                <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-menu-nav-text']}>Important Questions</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.schedule} 
                        className={`${styles['mobile-menu-nav-link']} ${isActiveLink(navigationPaths.schedule) ? styles['active'] : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                    >
                        <span className={styles['mobile-menu-nav-icon']}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M8 2v4"/>
                                <path d="M16 2v4"/>
                                <rect width="18" height="18" x="3" y="4" rx="2"/>
                                <path d="M3 10h18"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-menu-nav-text']}>My Schedule</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.smartCoach} 
                        className={`${styles['mobile-menu-nav-link']} ${isActiveLink(navigationPaths.smartCoach) ? styles['active'] : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                    >
                        <span className={styles['mobile-menu-nav-icon']}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"/>
                                <circle cx="12" cy="12" r="6"/>
                                <circle cx="12" cy="12" r="2"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-menu-nav-text']}>Smart Coach</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.profile} 
                        className={`${styles['mobile-menu-nav-link']} ${isActiveLink(navigationPaths.profile) ? styles['active'] : ''}`}
                        onClick={() => setShowMobileMenu(false)}
                    >
                        <span className={styles['mobile-menu-nav-icon']}>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                <circle cx="12" cy="7" r="4" />
                            </svg>
                        </span>
                        <span className={styles['mobile-menu-nav-text']}>Profile</span>
                    </Link>
                </nav>
            </div>

            {/* Mobile Bottom Navigation Bar */}
            {pathname !== navigationPaths.importantQuestions && pathname !== navigationPaths.askAi && !isCourseContent && (
                <div className={`${styles['mobile-bottom-nav']} bottom-nav-stable`}>
                    <Link 
                        href={navigationPaths.dashboard} 
                        className={`${styles['mobile-nav-item']} ${isActiveLink(navigationPaths.dashboard) ? styles['active'] : ''}`}
                    >
                        <span className={styles['mobile-nav-icon']}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9,22 9,12 15,12 15,22"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-nav-label']}>Home</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.subjects} 
                        className={`${styles['mobile-nav-item']} ${isActiveLink(navigationPaths.subjects) ? styles['active'] : ''}`}
                    >
                        <span className={styles['mobile-nav-icon']}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-nav-label']}>Subjects</span>
                    </Link>
                    
                    <Link 
                        href={navigationPaths.askAi} 
                        className={`${styles['mobile-nav-item']} ${isActiveLink(navigationPaths.askAi) ? styles['active'] : ''}`}
                    >
                        <span className={styles['mobile-nav-icon']}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
                                <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
                                <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
                                <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
                                <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
                                <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
                                <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
                                <path d="M6 18a4 4 0 0 1-1.967-.516"/>
                                <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
                            </svg>
                        </span>
                        <span className={styles['mobile-nav-label']}>AI Tutor</span>
                    </Link>
                    
                    {/* Dynamic fourth button based on current page */}
                    {isActiveLink(navigationPaths.profile) ? (
                        <Link 
                            href={navigationPaths.profile} 
                            className={`${styles['mobile-nav-item']} ${styles['active']}`}
                        >
                            <span className={styles['mobile-nav-icon']}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                            </span>
                            <span className={styles['mobile-nav-label']}>Settings</span>
                        </Link>
                    ) : isActiveLink(navigationPaths.smartCoach) ? (
                        <Link 
                            href={navigationPaths.smartCoach} 
                            className={`${styles['mobile-nav-item']} ${styles['active']}`}
                        >
                            <span className={styles['mobile-nav-icon']}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10"/>
                                    <circle cx="12" cy="12" r="6"/>
                                    <circle cx="12" cy="12" r="2"/>
                                </svg>
                            </span>
                            <span className={styles['mobile-nav-label']}>Smart Coach</span>
                        </Link>
                    ) : isActiveLink(navigationPaths.schedule) ? (
                        <Link 
                            href={navigationPaths.schedule} 
                            className={`${styles['mobile-nav-item']} ${styles['active']}`}
                        >
                            <span className={styles['mobile-nav-icon']}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M8 2v4"/>
                                    <path d="M16 2v4"/>
                                    <rect width="18" height="18" x="3" y="4" rx="2"/>
                                    <path d="M3 10h18"/>
                                </svg>
                            </span>
                            <span className={styles['mobile-nav-label']}>Schedule</span>
                        </Link>
                    ) : (
                        <Link 
                            href={navigationPaths.examPrep} 
                            className={`${styles['mobile-nav-item']} ${isActiveLink(navigationPaths.examPrep) ? styles['active'] : ''}`}
                        >
                            <span className={styles['mobile-nav-icon']}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/>
                                    <path d="M22 10v6"/>
                                    <path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>
                                </svg>
                            </span>
                            <span className={styles['mobile-nav-label']}>Important Questions</span>
                        </Link>
                    )}
                </div>
            )}
        </>
    );
});

export default Navbar;

