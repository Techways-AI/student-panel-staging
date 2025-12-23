"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children, requireCompleteProfile = false }) => {
    const { isAuthenticated, loading, token, isTokenValid, checkProfileCompletion } = useAuth();
    const router = useRouter();
    const [isChecking, setIsChecking] = useState(true);

    useEffect(() => {
        const checkAuthAndToken = async () => {
            if (loading) {
                return;
            }

            // Check if user is authenticated and token exists
            const hasToken = !!token;

            if (!isAuthenticated || !hasToken) {
                // Clear any invalid tokens
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    localStorage.removeItem('mobile');
                    localStorage.removeItem('isIdentified');
                }
                // Redirect to login immediately
                router.replace('/login');
                return;
            }

            try {
                const isValid = await isTokenValid();

                if (!isValid) {
                    console.log('🔒 Token validation failed, redirecting to login');
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('token');
                        localStorage.removeItem('mobile');
                        localStorage.removeItem('isIdentified');
                        localStorage.removeItem('refreshToken');
                    }
                    router.replace('/login');
                    return;
                }

                if (requireCompleteProfile) {
                    const isComplete = await checkProfileCompletion();
                    if (!isComplete) {
                        router.replace('/onboarding');
                        return;
                    }
                }

                setIsChecking(false);
            } catch (error) {
                console.error('Error validating token or profile:', error);
                router.replace('/login');
            }
        };

        checkAuthAndToken();
    }, [isAuthenticated, loading, token, isTokenValid, router, requireCompleteProfile, checkProfileCompletion]);

    // Don't show any loader during authentication check - just render children or redirect
    if (loading || isChecking) {
        return null;
    }

    // If not authenticated, don't render children (will redirect)
    if (!isAuthenticated || !token) {
        return null;
    }

    // If authenticated, render the protected content
    return <>{children}</>;
};

export default ProtectedRoute;

