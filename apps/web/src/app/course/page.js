"use client";
import { useEffect } from 'react';
import Course from '../../components/Course';
import ProtectedRoute from '../../components/ProtectedRoute';

export default function CoursePage() {
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

  // Add subjects-page class to enable scrolling (same as /subjects route)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('subjects-page');
      document.documentElement.classList.add('subjects-page');
      
      return () => {
        document.body.classList.remove('subjects-page');
        document.documentElement.classList.remove('subjects-page');
      };
    }
  }, []);

  return (
    <ProtectedRoute requireCompleteProfile={true}>
      <Course />
    </ProtectedRoute>
  );
}

