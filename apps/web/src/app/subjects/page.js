"use client";
import React, { useState, useEffect, useMemo, memo } from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '../../components/ProtectedRoute';
import PageLoader from '../../components/PageLoader';

// Lazy load the Course component to improve initial page load
const Course = dynamic(() => import('../../components/Course'), {
  ssr: false,
  loading: () => <PageLoader message="Loading subjects..." size="large" fullScreen delayMs={0} showLogo />
});

const SubjectsPage = memo(() => {
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
        
        // Add class to body for subjects page styling
        document.body.classList.add('subjects-page');
        
        // Cleanup function to remove class when component unmounts
        return () => {
            document.body.classList.remove('subjects-page');
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

    // Always render the subjects page immediately - no more loading delays
    // Course component will handle fallback data if userId is not ready
    return (
        <>
            <ProtectedRoute requireCompleteProfile={true}>
                <Course userId={userId} />
            </ProtectedRoute>
        </>
    );
});

SubjectsPage.displayName = 'SubjectsPage';

export default SubjectsPage;

