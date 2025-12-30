"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Login from '../components/Login';
import { useAuth } from '../context/AuthContext';
import PageLoader from '../components/PageLoader';
import { checkProfileCompletionFromAPI } from '../utils/profileUtils';
 
export default function HomePage() {
    const authContext = useAuth();
    const { isAuthenticated, loading, token, isTokenValid, isHydrated } = authContext || { 
        isAuthenticated: false, 
        loading: true, 
        token: null, 
        isTokenValid: () => false, 
        isHydrated: false 
    };
    const router = useRouter();
    const [isClient, setIsClient] = useState(false);
 
    useEffect(() => {
        setIsClient(true);
    }, []);
 
    useEffect(() => {
        if (isClient && isHydrated && !loading && isAuthenticated && token) {
            const isValid = isTokenValid && typeof isTokenValid === 'function' ? isTokenValid() : false;
            if (isValid) {
                // Check if user has complete profile before redirecting
                const checkProfileAndRedirect = async () => {
                    try {
                        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/'}/api/auth/profile-completion-status`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            }
                        });
                       
                        if (response.ok) {
                            const data = await response.json();
                            console.log('🔍 Profile completion check on homepage:', data.is_profile_complete);
                           
                            if (data.is_profile_complete) {
                                router.replace('/dashboard');
                            } else {
                                router.replace('/onboarding');
                            }
                        } else {
                            // Fallback to dashboard if API fails
                            router.replace('/dashboard');
                        }
                    } catch (error) {
                        console.error('Error checking profile completion:', error);
                        // Fallback to dashboard if API fails
                        router.replace('/dashboard');
                    }
                };
               
                checkProfileAndRedirect();
            }
        }
    }, [isClient, isHydrated, isAuthenticated, loading, token, isTokenValid, router]);
 
    // Show loading only during initial hydration - not during redirection
    if (!isClient || !isHydrated || loading) {
        return null; // Remove spinner, show nothing during loading
    }
 
    // If authenticated, redirect immediately without showing loader
    if (isAuthenticated && token) {
        const isValid = isTokenValid && typeof isTokenValid === 'function' ? isTokenValid() : false;
        if (isValid) {
            // For immediate redirect, we'll go to dashboard and let it handle profile check
            // This prevents loading delays while still ensuring proper routing
            router.replace('/dashboard');
            return null; // Return null during redirect to avoid flash
        }
    }
 
    // If not authenticated, show login page
    return (
        <main>
            <Login />
        </main>
    );
}
 
 

