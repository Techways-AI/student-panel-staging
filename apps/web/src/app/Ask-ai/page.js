"use client";
import AskAI from '../../components/AskAI';
import ProtectedRoute from '../../components/ProtectedRoute';
import { useEffect } from 'react';

export default function AskAIPage() {
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
        // Add class to body for ASK AI page styling
        document.body.classList.add('ask-ai-page');
        
        // Cleanup function to remove class when component unmounts
        return () => {
            document.body.classList.remove('ask-ai-page');
        };
    }, []);

    return (
        <ProtectedRoute requireCompleteProfile={true}>
            <AskAI />
        </ProtectedRoute>
    );
} 

