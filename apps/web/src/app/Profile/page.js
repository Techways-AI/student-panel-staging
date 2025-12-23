"use client";
import MyProfile from '../../components/Profile';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useEffect } from 'react';

export default function ProfilePage() {
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
        // Add class to body for Profile page styling
        document.body.classList.add('profile-page');
        
        // Cleanup function to remove class when component unmounts
        return () => {
            document.body.classList.remove('profile-page');
        };
    }, []);

    return (
        <ProtectedRoute>
            <MyProfile />
        </ProtectedRoute>
    );
}

