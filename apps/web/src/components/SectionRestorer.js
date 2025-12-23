"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import PageLoader from './PageLoader';

/**
 * Component that automatically redirects users to their last viewed section
 * This component should be used in the main layout or dashboard
 */
export default function SectionRestorer({ children }) {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [isCheckingSavedSection, setIsCheckingSavedSection] = useState(true);
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Only check for saved section if user is authenticated and not loading
    if (!loading && isAuthenticated && !hasRedirected) {
      const checkSavedSection = () => {
        if (typeof window === 'undefined') return;

        const savedSection = localStorage.getItem("current_section_id");
        const savedVideo = localStorage.getItem("current_video_id");
        const currentPath = window.location.pathname;
        
        // Don't redirect if we're already on the target page
        if (savedSection) {
          console.log('🔄 Found saved section:', savedSection);
          console.log('📍 Current path:', currentPath);
          
          let shouldRedirect = false;
          let targetPath = '';
          
          // Check if we should redirect based on saved section
          if (savedSection.startsWith('course-')) {
            // Navigate to main course page instead of direct subject URL
            targetPath = '/course';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('revision-')) {
            targetPath = '/important-questions';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('quiz-')) {
            targetPath = '/simple-test';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('ask-ai-')) {
            targetPath = '/Ask-ai';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('settings-')) {
            targetPath = '/settings';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('timetable-')) {
            targetPath = '/schedule';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('schedule-')) {
            targetPath = '/schedule';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('profile-')) {
            targetPath = '/Profile';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('adaptive-')) {
            targetPath = '/smart-coach';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('smart-coach-')) {
            targetPath = '/smart-coach';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('time-')) {
            targetPath = '/Time';
            shouldRedirect = currentPath !== targetPath;
          } else if (savedSection.startsWith('upgrade-')) {
            targetPath = '/upgrade';
            shouldRedirect = currentPath !== targetPath;
          }
          
          if (shouldRedirect) {
            console.log('🔄 Redirecting to:', targetPath);
            router.push(targetPath);
            setHasRedirected(true);
          } else {
            console.log('✅ Already on correct page, no redirect needed');
          }
        }
        
        setIsCheckingSavedSection(false);
      };

      // Small delay to ensure router is ready
      setTimeout(checkSavedSection, 100);
    } else if (!loading) {
      setIsCheckingSavedSection(false);
    }
  }, [isAuthenticated, loading, router, hasRedirected]);

  // Show loading while checking saved section
  if (isCheckingSavedSection) {
    return <PageLoader message="Restoring your last session..." size="large" fullScreen delayMs={350} showLogo />;
  }

  return children;
}

/**
 * Hook to get saved section information
 */
export function useSavedSection() {
  const [savedSection, setSavedSection] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getSavedSection = () => {
      const sectionId = localStorage.getItem("current_section_id");
      const videoId = localStorage.getItem("current_video_id");
      const playbackTime = localStorage.getItem("current_playback_time");
      const videoDuration = localStorage.getItem("current_video_duration");

      if (sectionId) {
        setSavedSection({
          sectionId,
          videoId,
          playbackTime: playbackTime ? parseFloat(playbackTime) : null,
          videoDuration: videoDuration ? parseFloat(videoDuration) : null
        });
      }
    };

    getSavedSection();
  }, []);

  return savedSection;
} 

