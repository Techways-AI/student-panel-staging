import { useEffect, useRef, useState } from 'react';

/**
 * Custom hook for managing Vimeo player section and video progress persistence
 * @param {string} sectionId - Current section/course ID
 * @param {string} videoId - Current Vimeo video ID
 * @param {object} vimeoPlayer - Vimeo player instance
 * @param {boolean} enabled - Whether to enable section management
 */
export function useVimeoSectionManager(sectionId, videoId = null, vimeoPlayer = null, enabled = true) {
  const [isRestored, setIsRestored] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const saveIntervalRef = useRef(null);
  const lastSavedTimeRef = useRef(0);
  const restorationAttemptedRef = useRef(false);
  const playerValidRef = useRef(false);

  // Helper function to get section-specific localStorage keys
  const getStorageKey = (key) => `${sectionId}_${key}`;

  // Helper function to check if player is still valid
  const isPlayerValid = async (player) => {
    if (!player) return false;
    try {
      // Try to get a simple property to test if player is still accessible
      await player.ready();
      // Additional check - try to get duration
      await player.getDuration();
      return true;
    } catch (error) {
      console.warn('Player validation failed:', error.message);
      return false;
    }
  };

  // Reset restoration flag when player changes
  useEffect(() => {
    if (vimeoPlayer) {
      restorationAttemptedRef.current = false;
      console.log('🔄 Player changed, resetting restoration flag');
    }
  }, [vimeoPlayer]);

  // Save current section and video progress
  useEffect(() => {
    if (!enabled || !sectionId) return;

    // Save current section
    localStorage.setItem("current_section_id", sectionId);
    
    // Save current video if provided
    if (videoId) {
      localStorage.setItem(getStorageKey("current_video_id"), videoId);
    }

    // Set up interval to save video progress
    if (vimeoPlayer && videoId) {
      saveIntervalRef.current = setInterval(async () => {
        try {
          // Check if player is still valid before accessing it
          const isValid = await isPlayerValid(vimeoPlayer);
          if (!isValid) {
            console.log('Player no longer valid, stopping save interval');
            if (saveIntervalRef.current) {
              clearInterval(saveIntervalRef.current);
              saveIntervalRef.current = null;
            }
            return;
          }

          // Get current time from Vimeo player
          const time = await vimeoPlayer.getCurrentTime();
          const videoDuration = await vimeoPlayer.getDuration();
          
          if (time && videoDuration) {
            setCurrentTime(time);
            setDuration(videoDuration);
            
            // Only save if time has changed significantly (more than 1 second)
            if (Math.abs(time - lastSavedTimeRef.current) > 1) {
              localStorage.setItem(getStorageKey("current_playback_time"), time.toString());
              localStorage.setItem(getStorageKey("current_video_duration"), videoDuration.toString());
              localStorage.setItem(getStorageKey("current_video_id"), videoId);
              lastSavedTimeRef.current = time;
              
              console.log('💾 Saved Vimeo progress for section:', {
                sectionId,
                time: Math.floor(time),
                duration: Math.floor(videoDuration),
                videoId
              });
            }
          }
        } catch (error) {
          console.warn('Error saving Vimeo progress:', error);
          // Stop the interval if player is no longer accessible
          if (error.message?.includes('Unknown player') || error.message?.includes('unloaded')) {
            console.log('Player unloaded, stopping save interval');
            if (saveIntervalRef.current) {
              clearInterval(saveIntervalRef.current);
              saveIntervalRef.current = null;
            }
          }
        }
      }, 2000); // Update every 2 seconds
    }

    return () => {
      if (saveIntervalRef.current) {
        clearInterval(saveIntervalRef.current);
        saveIntervalRef.current = null;
      }
    };
  }, [sectionId, videoId, vimeoPlayer, enabled]);

  // Cleanup save interval when player becomes invalid
  useEffect(() => {
    const checkPlayerAndCleanup = async () => {
      if (vimeoPlayer && saveIntervalRef.current) {
        const isValid = await isPlayerValid(vimeoPlayer);
        if (!isValid) {
          console.log('Player became invalid, cleaning up save interval');
          if (saveIntervalRef.current) {
            clearInterval(saveIntervalRef.current);
            saveIntervalRef.current = null;
          }
        }
      }
    };

    // Check every 5 seconds
    const cleanupInterval = setInterval(checkPlayerAndCleanup, 5000);
    
    return () => {
      clearInterval(cleanupInterval);
    };
  }, [vimeoPlayer]);

  // Restore video progress on mount
  useEffect(() => {
    if (!enabled || !vimeoPlayer || !videoId || !sectionId) return;

    // Reset restoration flag for new video/section
    restorationAttemptedRef.current = false;
    playerValidRef.current = false;

    const savedTime = localStorage.getItem(getStorageKey("current_playback_time"));
    const savedVideoId = localStorage.getItem(getStorageKey("current_video_id"));
    const savedDuration = localStorage.getItem(getStorageKey("current_video_duration"));
    const savedSectionId = localStorage.getItem("current_section_id");
    
    console.log('🔍 Checking for saved progress:', {
      sectionId,
      savedSectionId,
      videoId,
      savedVideoId,
      savedTime,
      savedDuration
    });
    
    // Only restore if we're on the same section, same video and have saved progress
    if (savedTime && savedVideoId === videoId && savedDuration && savedSectionId === sectionId) {
      const restoreTime = async () => {
        // Prevent multiple restoration attempts
        if (restorationAttemptedRef.current) {
          console.log('🛑 Restoration already attempted, skipping');
          return;
        }

        try {
          // Check if player is still valid
          const isValid = await isPlayerValid(vimeoPlayer);
          if (!isValid) {
            console.log('Player not valid during restoration, marking as attempted');
            restorationAttemptedRef.current = true;
            return;
          }

          playerValidRef.current = true;
          const currentDuration = await vimeoPlayer.getDuration();
          
          // Only restore if duration matches (same video)
          if (Math.abs(currentDuration - parseFloat(savedDuration)) < 1) {
            const timeToRestore = parseFloat(savedTime);
            
            // Don't restore if we're at the end of the video (within 10 seconds)
            if (timeToRestore < currentDuration - 10) {
              await vimeoPlayer.setCurrentTime(timeToRestore);
              // Automatically play the video after restoring position
              await vimeoPlayer.play();
              setIsRestored(true);
              restorationAttemptedRef.current = true;
              
              console.log('🔄 Restored Vimeo progress for section:', {
                sectionId,
                time: Math.floor(timeToRestore),
                duration: Math.floor(currentDuration),
                videoId
              });
            } else {
              console.log('⏭️ Video was near completion, not restoring position');
              restorationAttemptedRef.current = true;
            }
          } else {
            console.log('⏭️ Video duration mismatch, not restoring');
            restorationAttemptedRef.current = true;
          }
        } catch (error) {
          console.warn('Error restoring Vimeo progress:', error);
          // Mark as attempted to prevent retries
          restorationAttemptedRef.current = true;
          
          // Don't retry if player is unloaded
          if (error.message?.includes('Unknown player') || error.message?.includes('unloaded')) {
            console.log('Player unloaded during restoration, stopping retries');
          }
        }
      };
      
      // Wait longer for player to load, especially when switching sections
      setTimeout(restoreTime, 3000);
    } else {
      console.log('❌ No saved progress found for current section/video combination');
      restorationAttemptedRef.current = true;
    }
  }, [videoId, vimeoPlayer, enabled, sectionId]);

  // Get saved section info
  const getSavedSection = () => {
    if (typeof window === 'undefined') return null;
    
    return {
      sectionId: localStorage.getItem("current_section_id"),
      videoId: localStorage.getItem(getStorageKey("current_video_id")),
      playbackTime: localStorage.getItem(getStorageKey("current_playback_time")),
      videoDuration: localStorage.getItem(getStorageKey("current_video_duration"))
    };
  };

  // Clear saved progress for current section
  const clearSavedProgress = () => {
    if (typeof window === 'undefined') return;
    
    localStorage.removeItem("current_section_id");
    localStorage.removeItem(getStorageKey("current_video_id"));
    localStorage.removeItem(getStorageKey("current_playback_time"));
    localStorage.removeItem(getStorageKey("current_video_duration"));
    
    console.log('🗑️ Cleared saved Vimeo progress for section:', sectionId);
  };

  // Clear progress for specific video in current section
  const clearVideoProgress = (specificVideoId = null) => {
    if (typeof window === 'undefined') return;
    
    const savedVideoId = localStorage.getItem(getStorageKey("current_video_id"));
    if (!specificVideoId || savedVideoId === specificVideoId) {
      localStorage.removeItem(getStorageKey("current_video_id"));
      localStorage.removeItem(getStorageKey("current_playback_time"));
      localStorage.removeItem(getStorageKey("current_video_duration"));
      
      console.log('🗑️ Cleared saved progress for video in section:', {
        sectionId,
        videoId: specificVideoId || savedVideoId
      });
    }
  };

  return {
    isRestored,
    currentTime,
    duration,
    getSavedSection,
    clearSavedProgress,
    clearVideoProgress
  };
} 

