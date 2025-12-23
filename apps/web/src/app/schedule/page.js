"use client";
import React, { memo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '../../components/ProtectedRoute';
import PageLoader from '../../components/PageLoader';

// Lazy load the MySchedule component to improve initial page load
const MySchedule = dynamic(() => import('../../components/MySchedule'), {
  ssr: false,
  loading: () => <PageLoader message="Loading schedule..." size="large" fullScreen delayMs={0} showLogo />
});

const SchedulePage = memo(() => {
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
        // Add class to body for My Schedule page styling
        document.body.classList.add('my-schedule-page');
        
        // Cleanup function to remove class when component unmounts
        return () => {
            document.body.classList.remove('my-schedule-page');
        };
    }, []);

    // Always render the schedule page immediately - no more loading delays
    // MySchedule component will handle user data through useAuth hook
    return (
        <>
            <ProtectedRoute>
                <MySchedule />
            </ProtectedRoute>
        </>
    );
});

SchedulePage.displayName = 'SchedulePage';

export default SchedulePage;

