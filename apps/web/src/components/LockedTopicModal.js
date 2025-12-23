import React, { useEffect } from 'react';

const LockedTopicModal = ({ isOpen, onClose }) => {
  useEffect(() => {
    // Add CSS keyframes for the animation only once
    if (!document.getElementById('locked-modal-animation-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'locked-modal-animation-styles';
      styleSheet.type = 'text/css';
      styleSheet.innerText = `
        @keyframes modalSlideIn {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(-20px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        
        @keyframes lockBounce {
          0%, 20%, 50%, 80%, 100% {
            transform: translateY(0);
          }
          40% {
            transform: translateY(-10px);
          }
          60% {
            transform: translateY(-5px);
          }
        }
        
        @keyframes textFadeIn {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `;
      document.head.appendChild(styleSheet);
    }
  }, []);

  if (!isOpen) return null;

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.lockIcon}>
          <span style={styles.lockEmoji}>🔒</span>
        </div>
        <div style={styles.title}>Topic Locked</div>
        <div style={styles.message}>
          Please complete the previous topics first before accessing this content.
        </div>
        <div style={styles.subMessage}>
          Follow the learning path to unlock new topics and build your knowledge step by step.
        </div>
        <button style={styles.closeBtn} onClick={onClose}>
          Got it!
        </button>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    animation: 'modalSlideIn 0.3s ease-out',
  },
  modal: {
    background: '#fff',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    padding: '40px 32px 32px 32px',
    minWidth: '320px',
    maxWidth: '90vw',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    animation: 'modalSlideIn 0.3s ease-out',
  },
  lockIcon: {
    marginBottom: '20px',
    animation: 'lockBounce 1s ease-in-out',
  },
  lockEmoji: {
    fontSize: '4rem',
    display: 'block',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#2c3e50',
    marginBottom: '16px',
    animation: 'textFadeIn 0.5s ease-out 0.2s both',
  },
  message: {
    fontSize: '1.1rem',
    color: '#34495e',
    marginBottom: '12px',
    lineHeight: '1.5',
    animation: 'textFadeIn 0.5s ease-out 0.4s both',
  },
  subMessage: {
    fontSize: '0.95rem',
    color: '#7f8c8d',
    marginBottom: '24px',
    lineHeight: '1.4',
    animation: 'textFadeIn 0.5s ease-out 0.6s both',
  },
  closeBtn: {
    background: '#ff4747',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 32px',
    fontSize: '1.1rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0, 168, 232, 0.3)',
    transition: 'all 0.2s ease',
    animation: 'textFadeIn 0.5s ease-out 0.8s both',
  },
};

export default LockedTopicModal; 

