// components/VideoPlayer.js
'use client';
import React, { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import styles from './VideoPlayer.module.css';

const VideoPlayer = forwardRef(({ 
  videoUrl, 
  onPlay, 
  onPause, 
  onTimeUpdate, 
  onDurationChange,
  onError,
  onEnded,
  className = '',
  autoplay = false,
  muted = false,
  loop = false,
  controls = true
}, ref) => {
  const videoRef = useRef(null);
  const iframeRef = useRef(null);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [videoType, setVideoType] = useState('direct');

  // Detect video type and validate URL
  const detectVideoType = (url) => {
    if (!url) return { type: 'unknown', isValid: false };
    
    // Check if it's a Vimeo URL
    if (url.includes('vimeo.com') || url.includes('player.vimeo.com')) {
      return { type: 'vimeo', isValid: true };
    }
    
    // Check if it's a YouTube URL
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      return { type: 'youtube', isValid: true };
    }
    
    // Check if it's a direct video file URL
    if (url.startsWith('http') && (
      url.includes('.s3.') || 
      url.includes('.amazonaws.com') || 
      url.match(/\.(mp4|mov|webm|avi|mkv)$/i)
    )) {
      return { type: 'direct', isValid: true };
    }
    
    return { type: 'unknown', isValid: false };
  };

  // Extract Vimeo video ID and privacy hash
  const extractVimeoData = (url) => {
    if (!url) return null;
    
    // Handle iframe embed code
    if (url.includes('<iframe')) {
      const iframeMatch = url.match(/src="https:\/\/player\.vimeo\.com\/video\/(\d+)\?h=([a-zA-Z0-9]+)"/);
      if (iframeMatch) {
        return { videoId: iframeMatch[1], privacyHash: iframeMatch[2] };
      }
      
      const iframeMatchNoHash = url.match(/src="https:\/\/player\.vimeo\.com\/video\/(\d+)"/);
      if (iframeMatchNoHash) {
        return { videoId: iframeMatchNoHash[1], privacyHash: null };
      }
    }
    
    // Handle player URLs with hash
    const playerWithHashPattern = /player\.vimeo\.com\/video\/(\d+)\?h=([a-zA-Z0-9]+)/;
    const playerWithHashMatch = url.match(playerWithHashPattern);
    if (playerWithHashMatch) {
      return { videoId: playerWithHashMatch[1], privacyHash: playerWithHashMatch[2] };
    }
    
    // Handle player URLs without hash
    const playerPattern = /player\.vimeo\.com\/video\/(\d+)/;
    const playerMatch = url.match(playerPattern);
    if (playerMatch) {
      return { videoId: playerMatch[1], privacyHash: null };
    }
    
    // Handle unlisted videos with hash
    const unlistedPattern = /vimeo\.com\/(\d+)\/([a-zA-Z0-9]+)/;
    const unlistedMatch = url.match(unlistedPattern);
    if (unlistedMatch) {
      return { videoId: unlistedMatch[1], privacyHash: unlistedMatch[2] };
    }
    
    // Handle standard Vimeo URLs
    const standardPattern = /vimeo\.com\/(\d+)/;
    const standardMatch = url.match(standardPattern);
    if (standardMatch) {
      return { videoId: standardMatch[1], privacyHash: null };
    }
    
    return null;
  };

  // Extract YouTube video ID
  const extractYouTubeId = (url) => {
    if (!url) return null;
    
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    return null;
  };

  // Initialize Video Player
  useEffect(() => {
    if (!videoUrl) return;

    console.log('🎬 Initializing Video Player with URL:', videoUrl);

    // Detect video type
    const { type, isValid } = detectVideoType(videoUrl);
    setVideoType(type);

    if (!isValid) {
      console.error('❌ Invalid video URL:', videoUrl);
      setError(`Invalid video URL: ${videoUrl}. Please check the Video URL Help for supported formats.`);
      setIsLoading(false);
      return;
    }

    // Reset state
    setIsLoading(true);
    setError(null);
    setAutoplayBlocked(false);
    setIsPlayerReady(false);

    if (type === 'direct') {
      initializeDirectVideo();
    } else if (type === 'vimeo') {
      // Vimeo initializes after iframe render (separate effect)
      setIsLoading(true);
    } else if (type === 'youtube') {
      initializeYouTubeVideo();
    }

  }, [videoUrl, autoplay, muted, loop, controls, volume]);

  // Initialize direct video file
  const initializeDirectVideo = useCallback(() => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      
      // Set video source
      video.src = videoUrl;
      
      // Set initial properties
      video.autoplay = autoplay;
      video.muted = muted;
      video.loop = loop;
      video.controls = controls;
      video.volume = volume;

      // Video loaded event
      const handleLoadedMetadata = () => {
        console.log('✅ Video metadata loaded');
        setIsPlayerReady(true);
        setIsLoading(false);
        setDuration(video.duration);
        if (onDurationChange) onDurationChange(video.duration);
      };

      // Video can play event
      const handleCanPlay = () => {
        console.log('✅ Video can play');
        setIsLoading(false);
      };

      // Play event
      const handlePlay = () => {
        console.log('▶️ Video playing');
        setIsPlaying(true);
        setAutoplayBlocked(false);
        if (onPlay) onPlay();
      };

      // Pause event
      const handlePause = () => {
        console.log('⏸️ Video paused');
        setIsPlaying(false);
        if (onPause) onPause();
      };

      // Time update event
      const handleTimeUpdate = () => {
        setCurrentTime(video.currentTime);
        if (onTimeUpdate) onTimeUpdate(video.currentTime);
      };

      // Volume change event
      const handleVolumeChange = () => {
        setVolume(video.volume);
      };

      // Error event
      const handleError = (e) => {
        console.error('❌ Video Player error:', e);
        const errorMessage = video.error ? 
          `Video error: ${video.error.message || 'Unknown error'}` : 
          'Video playback error';
        
        // Add specific error handling for S3/CORS issues
        if (video.error && video.error.code === 4) {
          console.error('🚫 CORS or network error - video may not be accessible');
          setError('Video cannot be loaded. This may be due to CORS restrictions or network issues.');
        } else {
          setError(errorMessage);
        }
        
        setIsLoading(false);
        if (onError) onError(e);
      };

      // Ended event
      const handleEnded = () => {
        console.log('🏁 Video ended');
        setIsPlaying(false);
        if (onEnded) onEnded();
      };

      // Load start event
      const handleLoadStart = () => {
        console.log('🔄 Video loading started');
        setIsLoading(true);
        setError(null);
      };

      // Add event listeners
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      video.addEventListener('canplay', handleCanPlay);
      video.addEventListener('play', handlePlay);
      video.addEventListener('pause', handlePause);
      video.addEventListener('timeupdate', handleTimeUpdate);
      video.addEventListener('volumechange', handleVolumeChange);
      video.addEventListener('error', handleError);
      video.addEventListener('ended', handleEnded);
      video.addEventListener('loadstart', handleLoadStart);

      // Try to autoplay if enabled
      if (autoplay) {
        console.log('🎬 Attempting autoplay...');
        video.play().catch(err => {
          console.log('⚠️ Autoplay blocked by browser:', err.message);
          setAutoplayBlocked(true);
        });
      }

      // Cleanup function
      return () => {
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('canplay', handleCanPlay);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('timeupdate', handleTimeUpdate);
        video.removeEventListener('volumechange', handleVolumeChange);
        video.removeEventListener('error', handleError);
        video.removeEventListener('ended', handleEnded);
        video.removeEventListener('loadstart', handleLoadStart);
      };

    } catch (err) {
      console.error('❌ Failed to initialize Direct Video Player:', err);
      setError(err.message || 'Failed to initialize video player');
      setIsLoading(false);
    }
  }, [videoUrl, autoplay, muted, loop, controls, volume, onPlay, onPause, onTimeUpdate, onDurationChange, onError, onEnded]);

  // Initialize Vimeo video with Player API
  const initializeVimeoVideo = useCallback(() => {
    const vimeoData = extractVimeoData(videoUrl);
    if (!vimeoData) {
      setError('Could not extract Vimeo video ID from URL');
      setIsLoading(false);
      return;
    }

    console.log('🎬 Initializing Vimeo video with Player API:', vimeoData);
    
    // Load Vimeo Player API if not already loaded
    if (typeof window !== 'undefined' && !window.Vimeo) {
      const script = document.createElement('script');
      script.src = 'https://player.vimeo.com/api/player.js';
      script.onload = () => {
        initializeVimeoPlayer(vimeoData);
      };
      document.head.appendChild(script);
    } else if (window.Vimeo) {
      initializeVimeoPlayer(vimeoData);
    } else {
      // Fallback to iframe without API
      console.log('🎬 Fallback: Using iframe without Vimeo API');
      setIsPlayerReady(true);
      setIsLoading(false);
      
      // Trigger onPlay after a delay
      if (onPlay) {
        setTimeout(() => {
          console.log('🎬 Fallback: Calling onPlay for Vimeo video');
          onPlay();
        }, 2000);
      }
      
      // Set up a fallback completion timer for iframe videos
      // This ensures completion is detected even without the Vimeo API
      if (onEnded) {
        setTimeout(() => {
          console.log('🎬 Fallback: Setting up completion timer for Vimeo video');
          // Set a timer to trigger completion after a reasonable duration
          // This is a fallback in case the video ends but we don't detect it
          setTimeout(() => {
            console.log('🎬 Fallback: Triggering video completion (fallback timer)');
            onEnded();
          }, 30000); // 30 seconds fallback timer
        }, 3000); // Wait 3 seconds for iframe to load
      }
    }
  }, [videoUrl, onPlay, onEnded]);

  // Kick off Vimeo initialization only after iframe is rendered
  useEffect(() => {
    if (videoType !== 'vimeo') return;
    initializeVimeoVideo();
  }, [videoType, initializeVimeoVideo]);

  // Initialize Vimeo player with API
  const initializeVimeoPlayer = useCallback((vimeoData) => {
    try {
      console.log('🎬 Creating Vimeo player with API');
      console.log('🎬 iframeRef.current:', iframeRef.current);
      
      // Ensure iframe is mounted before creating the player
      if (!iframeRef.current) {
        console.log('🎬 iframe not mounted yet, skipping Vimeo player init');
        return;
      }
      
      // Create player instance
      const player = new window.Vimeo.Player(iframeRef.current);
      console.log('🎬 Vimeo player instance created:', player);
      
      // Set up event listeners
      player.ready().then(() => {
        console.log('🎬 Vimeo player ready');
        setIsPlayerReady(true);
        setIsLoading(false);
        
        // Get video duration
        player.getDuration().then(duration => {
          console.log('🎬 Vimeo video duration:', duration);
          setDuration(duration);
          if (onDurationChange) {
            onDurationChange(duration);
          }
        }).catch(err => {
          console.error('❌ Failed to get video duration:', err);
        });
      }).catch(err => {
        console.error('❌ Vimeo player ready failed:', err);
        // Fallback to iframe without API
        setIsPlayerReady(true);
        setIsLoading(false);
        
        if (onPlay) {
          setTimeout(() => {
            console.log('🎬 Fallback: Calling onPlay for Vimeo video');
            onPlay();
          }, 2000);
        }
      });

      // Play event
      player.on('play', () => {
        console.log('🎬 Vimeo video playing');
        setIsPlaying(true);
        if (onPlay) onPlay();
      });

      // Pause event
      player.on('pause', () => {
        console.log('🎬 Vimeo video paused');
        setIsPlaying(false);
        if (onPause) onPause();
      });

      // Time update event
      player.on('timeupdate', (data) => {
        const currentTime = data.seconds;
        setCurrentTime(currentTime);
        if (onTimeUpdate) onTimeUpdate(currentTime);
      });

      // Video ended event
      player.on('ended', () => {
        console.log('🎬 Vimeo video ended - calling onEnded');
        setIsPlaying(false);
        if (onEnded) {
          console.log('🎬 Calling onEnded callback');
          onEnded();
        } else {
          console.log('❌ onEnded callback not provided');
        }
      });

      // Error event
      player.on('error', (error) => {
        console.error('🎬 Vimeo player error:', error);
        setError('Video playback error');
        if (onError) onError(error);
      });

      // Store player reference for controls
      iframeRef.current.vimeoPlayer = player;
      
    } catch (err) {
      console.error('❌ Failed to initialize Vimeo Player API:', err);
      // Fallback to iframe without API
      setIsPlayerReady(true);
      setIsLoading(false);
      
      if (onPlay) {
        setTimeout(() => {
          console.log('🎬 Fallback: Calling onPlay for Vimeo video');
          onPlay();
        }, 2000);
      }
    }
  }, [onPlay, onPause, onTimeUpdate, onDurationChange, onEnded, onError]);

  // Initialize YouTube video
  const initializeYouTubeVideo = useCallback(() => {
    const youtubeId = extractYouTubeId(videoUrl);
    if (!youtubeId) {
      setError('Could not extract YouTube video ID from URL');
      setIsLoading(false);
      return;
    }

    console.log('🎬 Initializing YouTube video:', youtubeId);
    setIsPlayerReady(true);
    setIsLoading(false);
    
    // For YouTube videos, we'll use iframe embedding
    // Since we can't detect play events reliably, we'll trigger onPlay immediately
    // This ensures the completion timer starts
    console.log('🎬 YouTube video loaded - triggering onPlay callback');
    if (onPlay) {
      setTimeout(() => {
        console.log('🎬 Calling onPlay for YouTube video');
        onPlay();
      }, 1000); // Small delay to ensure iframe is ready
    }
  }, [videoUrl, onPlay]);

  // Player control methods
  const play = useCallback(() => {
    if (!isPlayerReady) return;
    // Direct <video>
    if (videoRef.current) {
      videoRef.current.play().catch(err => console.error('Play error:', err));
      return;
    }
    // Vimeo via Player API
    if (iframeRef.current && iframeRef.current.vimeoPlayer && typeof iframeRef.current.vimeoPlayer.play === 'function') {
      try { iframeRef.current.vimeoPlayer.play(); } catch (e) { console.error('Vimeo play error:', e); }
      return;
    }
    // YouTube via postMessage
    if (iframeRef.current && videoType === 'youtube') {
      try {
        iframeRef.current.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      } catch (e) {
        console.error('YouTube play error:', e);
      }
    }
  }, [isPlayerReady, videoType]);

  const pause = useCallback(() => {
    if (videoRef.current && isPlayerReady) {
      videoRef.current.pause();
    }
  }, [isPlayerReady]);

  const togglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const setCurrentTimeTo = useCallback((time) => {
    if (videoRef.current && isPlayerReady) {
      videoRef.current.currentTime = time;
    }
  }, [isPlayerReady]);

  const setVolumeTo = useCallback((vol) => {
    if (videoRef.current && isPlayerReady) {
      videoRef.current.volume = vol;
    }
  }, [isPlayerReady]);

  const toggleMute = useCallback(() => {
    if (videoRef.current && isPlayerReady) {
      videoRef.current.muted = !videoRef.current.muted;
    }
  }, [isPlayerReady]);

  const requestFullscreen = useCallback(() => {
    if (!isPlayerReady) return;
    // Direct <video>
    if (videoRef.current) {
      const el = videoRef.current;
      if (el.requestFullscreen) return el.requestFullscreen();
      if (el.webkitRequestFullscreen) return el.webkitRequestFullscreen();
      if (el.msRequestFullscreen) return el.msRequestFullscreen();
    }
    // Iframe (Vimeo/YouTube)
    if (iframeRef.current) {
      const iframe = iframeRef.current;
      // Vimeo Player API supports requestFullscreen
      if (iframe.vimeoPlayer && typeof iframe.vimeoPlayer.requestFullscreen === 'function') {
        return iframe.vimeoPlayer.requestFullscreen();
      }
      if (iframe.requestFullscreen) return iframe.requestFullscreen();
      if (iframe.webkitRequestFullscreen) return iframe.webkitRequestFullscreen();
      if (iframe.msRequestFullscreen) return iframe.msRequestFullscreen();
    }
  }, [isPlayerReady]);

  // Format time helper
  const formatTime = useCallback((seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Expose player methods to parent component
  useImperativeHandle(ref, () => ({
    play,
    pause,
    togglePlayPause,
    setCurrentTimeTo,
    setVolumeTo,
    toggleMute,
    requestFullscreen,
    isPlaying,
    currentTime,
    duration,
    volume,
    isPlayerReady
  }));

  // Handle video URL changes
  useEffect(() => {
    if (videoUrl && videoRef.current && isPlayerReady) {
      // Validate video URL before attempting to load
      if (!isValidVideoUrl(videoUrl)) {
        console.error('❌ Invalid video URL for new video:', videoUrl);
        setError(`Invalid video URL: ${videoUrl}. URL must be a valid video file.`);
        setIsLoading(false);
        return;
      }

      console.log('🔄 Video URL changed, loading new video:', videoUrl);
      setIsLoading(true);
      setError(null);
      setAutoplayBlocked(false);
      
      videoRef.current.src = videoUrl;
      videoRef.current.load();
    }
  }, [videoUrl, isPlayerReady]);

  if (error) {
    return (
      <div className={`${styles.errorContainer} ${className}`}>
        <div className={styles.errorContent}>
          <div className={styles.errorIcon}>⚠️</div>
          <h3>Video Error</h3>
          <p>{error}</p>
          <button 
            className={styles.retryButton}
            onClick={() => {
              setError(null);
              setIsLoading(true);
              if (videoRef.current && videoUrl) {
                videoRef.current.src = videoUrl;
                videoRef.current.load();
              }
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Generate iframe source URL based on video type
  const getIframeSrc = () => {
    if (videoType === 'vimeo') {
      const vimeoData = extractVimeoData(videoUrl);
      if (!vimeoData) return '';
      
      const baseUrl = `https://player.vimeo.com/video/${vimeoData.videoId}`;
      const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        muted: muted ? '1' : '0',
        loop: loop ? '1' : '0',
        controls: controls ? '1' : '0',
        responsive: '1',
        title: '0',
        portrait: '0',
        byline: '0',
        color: '00adef',
        dnt: '1'
      });
      
      if (vimeoData.privacyHash) {
        params.set('h', vimeoData.privacyHash);
      }
      
      return `${baseUrl}?${params.toString()}`;
    } else if (videoType === 'youtube') {
      const youtubeId = extractYouTubeId(videoUrl);
      if (!youtubeId) return '';
      
      const baseUrl = `https://www.youtube.com/embed/${youtubeId}`;
      const params = new URLSearchParams({
        autoplay: autoplay ? '1' : '0',
        mute: muted ? '1' : '0',
        loop: loop ? '1' : '0',
        controls: controls ? '1' : '0',
        rel: '0',
        modestbranding: '1',
        iv_load_policy: '3'
      });
      
      if (loop) {
        params.set('playlist', youtubeId);
      }
      
      return `${baseUrl}?${params.toString()}`;
    }
    return '';
  };

  return (
    <div className={`${styles.videoPlayerContainer} ${className}`}>
      {isLoading && (
        <div className={styles.loadingOverlay}>
          <div className={styles.loadingSpinner} />
        </div>
      )}
      
      {/* Direct video file */}
      {videoType === 'direct' && (
        <>
          <video
            ref={videoRef}
            className={styles.videoElement}
            preload="metadata"
            playsInline
            webkit-playsinline="true"
          />
          
          {/* Autoplay blocked indicator */}
          {autoplayBlocked && !isPlaying && (
            <div className={styles.autoplayBlockedOverlay}>
              <div className={styles.autoplayBlockedContent}>
                <div className={styles.autoplayBlockedIcon}>🎬</div>
                <h3>Click to Play Video</h3>
                <p>Your browser blocked autoplay. Click the play button to start the video.</p>
                <button 
                  className={styles.playButton}
                  onClick={togglePlayPause}
                  aria-label="Play video"
                >
                  ▶️ Play Video
                </button>
              </div>
            </div>
          )}

          {/* Custom overlay controls (optional) */}
          {!controls && (
            <div className={styles.customControls}>
              <button 
                className={styles.playButton}
                onClick={togglePlayPause}
                aria-label={isPlaying ? 'Pause video' : 'Play video'}
              >
                {isPlaying ? '⏸️' : '▶️'}
              </button>
            </div>
          )}
        </>
      )}
      
      {/* Vimeo or YouTube iframe */}
      {(videoType === 'vimeo' || videoType === 'youtube') && (
        <iframe
          ref={iframeRef}
          src={getIframeSrc()}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title={`${videoType === 'vimeo' ? 'Vimeo' : 'YouTube'} video`}
          className={styles.videoElement}
          style={{ 
            display: error ? 'none' : 'block',
            opacity: isLoading ? 0.3 : 1,
            transition: 'opacity 0.3s ease'
          }}
          loading="eager"
          onLoad={() => {
            console.log(`✅ ${videoType} video loaded`);
            setIsLoading(false);
            setIsPlayerReady(true);
          }}
          onError={() => {
            console.error(`❌ ${videoType} video failed to load`);
            setError(`Failed to load ${videoType} video`);
            setIsLoading(false);
          }}
        />
      )}
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';

export default VideoPlayer;

