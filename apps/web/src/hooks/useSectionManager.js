import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for managing section and video progress persistence
 * @param {string} sectionId - Current section/course ID
 * @param {string} videoId - Current video ID (optional)
 * @param {object} videoRef - Reference to video element (optional)
 * @param {boolean} enabled - Whether to enable section management
 */
export function useSectionManager(sectionId, videoId = null, videoRef = null, enabled = true) {
  const [isRestored, setIsRestored] = useState(false);
  const saveIntervalRef = useRef(null);

  // Save current section and video progress
  useEffect(() => {
    if (!enabled || !sectionId) return;

    // Save current section
    localStorage.setItem("current_section_id", sectionId);
    
    // Save current video if provided
    if (videoId) {
      localStorage.setItem("current_video_id", videoId);
    }

    // Set up interval to save video progress
    if (videoRef && videoRef.current) {
      saveIntervalRef.current = setInterval(() => {
        if (videoRef.current && !videoRef.current.paused) {
          localStorage.setItem("current_playback_time", videoRef.current.currentTime.toString());
          localStorage.setItem("current_video_duration", videoRef.current.duration.toString());
        }
      }, 1000); // Update every 1 second
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
      }
    };
  }, [sectionId, videoId, videoRef, enabled]);

  // Restore video progress on mount
  useEffect(() => {
    if (!enabled || !videoRef || !videoRef.current) return;

    const savedTime = localStorage.getItem("current_playback_time");
    const savedVideoId = localStorage.getItem("current_video_id");
    
    // Only restore if we're on the same video
    if (savedTime && savedVideoId === videoId) {
      const restoreTime = () => {
        if (videoRef.current && videoRef.current.readyState >= 2) {
          videoRef.current.currentTime = parseFloat(savedTime);
          setIsRestored(true);
        } else {
          // Video not ready yet, try again
          setTimeout(restoreTime, 100);
        }
      };
      
      // Wait a bit for video to load
      setTimeout(restoreTime, 500);
    }
  }, [videoId, videoRef, enabled]);

  // Get saved section info
  const getSavedSection = () => {
    if (typeof window === 'undefined') return null;
    
    return {
      sectionId: localStorage.getItem("current_section_id"),
      videoId: localStorage.getItem("current_video_id"),
      playbackTime: localStorage.getItem("current_playback_time"),
      videoDuration: localStorage.getItem("current_video_duration")
    };
  };

  // Clear saved progress
  const clearSavedProgress = () => {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem("current_section_id");
    localStorage.removeItem("current_video_id");
    localStorage.removeItem("current_playback_time");
    localStorage.removeItem("current_video_duration");
  };

  return {
    isRestored,
    getSavedSection,
    clearSavedProgress
  };
} 

