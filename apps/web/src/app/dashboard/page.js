"use client";
import React, { useState, useEffect, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '../../components/ProtectedRoute';
import PageLoader from '../../components/PageLoader';

// Lazy load the Overview component to improve initial page load
const Overview = dynamic(() => import('../../components/Overview'), {
  ssr: false,
  loading: () => <PageLoader message="Loading dashboard..." size="large" fullScreen delayMs={0} showLogo />
});

const DashboardPage = memo(() => {
    const [userId, setUserId] = useState(null);
    const [isClient, setIsClient] = useState(false);

    // Dispatch skeleton-start immediately on mount to prevent white screen
    useEffect(() => {
        try {
            if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('page-skeleton-start'));
            }
        } catch {}
        return () => {
            try {
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new Event('page-skeleton-end'));
                }
            } catch {}
        };
    }, []);

    useEffect(() => {
        setIsClient(true);
        
        // Add class to body for dashboard page styling
        document.body.classList.add('dashboard-page');
        
        // Cleanup function to remove class when component unmounts
        return () => {
            document.body.classList.remove('dashboard-page');
        };
    }, []);

    // Get user ID safely
    const getUserId = () => {
      if (isClient && typeof window !== 'undefined') {
        return localStorage.getItem('mobile');
      }
      return null;
    };

    // User loading logic - get userId immediately
    useEffect(() => {
        if (isClient) {
            const id = getUserId();
            setUserId(id);
        }
    }, [isClient]);

    // Always render immediately - components will handle their own loading states

    // Always render the dashboard immediately - no loading delays!
    // Overview component will handle skeleton display while data loads
    return (
        <ProtectedRoute requireCompleteProfile={true}>
            <Overview userId={userId} />
        </ProtectedRoute>
    );
});

DashboardPage.displayName = 'DashboardPage';

export default DashboardPage; 

