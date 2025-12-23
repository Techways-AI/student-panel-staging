import React from 'react';
import styles from './VideoModal.module.css';

// Function to extract Vimeo video ID and privacy hash from various URL formats
const extractVimeoId = (url) => {
  if (!url) return null;
  
  // Handle various Vimeo URL formats:
  // https://vimeo.com/1104979405/f7bd4f2c7a (unlisted with hash)
  // https://vimeo.com/1104979405 (standard)
  // https://player.vimeo.com/video/1104979405 (player URL)
  // https://player.vimeo.com/video/1104979405?h=f7bd4f2c7a (player URL with hash)
  // vimeo.com/1104979405 (short format)
  // Full iframe embed code
  
  // First, check if it's a full iframe embed code
  if (url.includes('<iframe')) {
    // Match iframe with privacy hash
    const iframeMatch = url.match(/src="https:\/\/player\.vimeo\.com\/video\/(\d+)\?h=([a-zA-Z0-9]+)"/);
    if (iframeMatch) {
      const videoId = iframeMatch[1];
      const privacyHash = iframeMatch[2];

      return { videoId, privacyHash };
    }
    
    // Match iframe without privacy hash
    const iframeMatchNoHash = url.match(/src="https:\/\/player\.vimeo\.com\/video\/(\d+)"/);
    if (iframeMatchNoHash) {
      const videoId = iframeMatchNoHash[1];

      return { videoId, privacyHash: null };
    }
  }
  
  // Handle player.vimeo.com URLs with privacy hash
  const playerWithHashPattern = /player\.vimeo\.com\/video\/(\d+)\?h=([a-zA-Z0-9]+)/;
  const playerWithHashMatch = url.match(playerWithHashPattern);
  if (playerWithHashMatch) {
    const videoId = playerWithHashMatch[1];
    const privacyHash = playerWithHashMatch[2];

    return { videoId, privacyHash };
  }
  
  // Handle player.vimeo.com URLs without privacy hash
  const playerPattern = /player\.vimeo\.com\/video\/(\d+)/;
  const playerMatch = url.match(playerPattern);
  if (playerMatch) {
    const videoId = playerMatch[1];

    return { videoId, privacyHash: null };
  }
  
  // Handle unlisted videos with privacy hash in URL
  const unlistedPattern = /vimeo\.com\/(\d+)\/([a-zA-Z0-9]+)/;
  const unlistedMatch = url.match(unlistedPattern);
  if (unlistedMatch) {
    const videoId = unlistedMatch[1];
    const privacyHash = unlistedMatch[2];

    return { videoId, privacyHash };
  }
  
  // Handle standard Vimeo URLs
  const patterns = [
    /vimeo\.com\/(\d+)/,  // Standard Vimeo URL
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {

      return { videoId: match[1], privacyHash: null };
    }
  }
  
  console.error('❌ Could not extract Vimeo ID from URL:', url);
  return null;
};

export default function VideoModal({ vimeoId, onClose, videoRef }) {
  if (!vimeoId) return null;
  
  // Extract video ID and hash if a full URL was passed
  const videoData = extractVimeoId(vimeoId) || { videoId: vimeoId, privacyHash: null };
  
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <iframe
          ref={videoRef}
          src={`https://player.vimeo.com/video/${videoData.videoId}${videoData.privacyHash ? `?h=${videoData.privacyHash}` : ''}`}
          width="640"
          height="360"
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          title="Vimeo Video"
        />
        <button className={styles.closeBtn} onClick={onClose}>×</button>
      </div>
    </div>
  );
} 

