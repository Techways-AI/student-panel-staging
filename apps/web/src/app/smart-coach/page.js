"use client";
import React, { memo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '../../components/ProtectedRoute';
import PageLoader from '../../components/PageLoader';

// Lazy load the Adaptive component to improve initial page load
const Adaptive = dynamic(() => import('../../components/Adaptive'), {
  ssr: false,
  loading: () => <PageLoader message="Loading smart coach..." size="large" fullScreen delayMs={0} showLogo />
});

const SmartCoachPage = memo(() => {
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
        // Add class to body for Smart Coach page styling
        document.body.classList.add('smart-coach-page');
        
        // Cleanup function to remove class when component unmounts
        return () => {
            document.body.classList.remove('smart-coach-page');
        };
    }, []);

    // Always render the smart coach page immediately - no more loading delays
    // Adaptive component will handle user data through useAuth hook
    return (
        <>
            <ProtectedRoute requireCompleteProfile={true}>
                <Adaptive />
            </ProtectedRoute>
        </>
    );
});

SmartCoachPage.displayName = 'SmartCoachPage';

export default SmartCoachPage;

