import React, { useEffect } from 'react';

const LessonCompleteModal = ({ xp = 10, completionType = 'video', onClose }) => {
  useEffect(() => {
    // Add CSS keyframes for the animation only once
    if (!document.getElementById('lesson-complete-animation-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'lesson-complete-animation-styles';
      styleSheet.type = 'text/css';
      styleSheet.innerText = `
        @keyframes modalSlideIn {
          0% {
            opacity: 0;
            transform: scale(0.8) translateY(-30px) rotate(-2deg);
          }
          50% {
            transform: scale(1.05) translateY(-5px) rotate(1deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0) rotate(0deg);
          }
        }
        
        @keyframes xpPulse {
          0% {
            transform: scale(1);
            text-shadow: 0 0 5px rgba(25, 118, 210, 0.3);
          }
          50% {
            transform: scale(1.1);
            text-shadow: 0 0 15px rgba(25, 118, 210, 0.6);
          }
          100% {
            transform: scale(1);
            text-shadow: 0 0 5px rgba(25, 118, 210, 0.3);
          }
        }

        @keyframes trophyFloat {
          0%, 100% {
            transform: translateY(0px) rotate(0deg);
          }
          25% {
            transform: translateY(-8px) rotate(2deg);
          }
          50% {
            transform: translateY(-12px) rotate(0deg);
          }
          75% {
            transform: translateY(-8px) rotate(-2deg);
          }
        }

        @keyframes titleSlideIn {
          0% {
            opacity: 0;
            transform: translateX(-20px);
          }
          100% {
            opacity: 1;
            transform: translateX(0);
          }
        }

        @keyframes messageFadeIn {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes buttonGlow {
          0%, 100% {
            box-shadow: 0 4px 16px rgba(0, 168, 232, 0.3);
          }
          50% {
            box-shadow: 0 6px 24px rgba(0, 168, 232, 0.5);
          }
        }

        @keyframes confetti {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }

        @keyframes sparkle {
          0%, 100% {
            opacity: 0;
            transform: scale(0) rotate(0deg);
          }
          50% {
            opacity: 1;
            transform: scale(1) rotate(180deg);
          }
        }
      `;
      document.head.appendChild(styleSheet);
    }
    // Auto-dismiss after 4 seconds
    if (onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [onClose]);

  const getTitle = () => {
    switch (completionType) {
      case 'notes':
        return 'Notes Complete!';
      case 'quiz':
        return 'Quiz Complete!';
      default:
        return 'Video Complete!';
    }
  };

  return (
    <div style={styles.overlay}>
      {/* Confetti effect */}
      <div style={styles.confettiContainer}>
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.confetti,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            {['🎉', '⭐', '🎊', '✨'][Math.floor(Math.random() * 4)]}
          </div>
        ))}
      </div>

      <div style={styles.modal}>
        {/* Sparkle effects */}
        <div style={styles.sparkle1}>✨</div>
        <div style={styles.sparkle2}>⭐</div>
        <div style={styles.sparkle3}>✨</div>
        
        <div style={styles.trophyIcon}>
          <img src="/assets/cup1.gif" alt="Trophy" style={styles.trophyImage} />
        </div>
        <div style={styles.title}>{getTitle()}</div>
        <div style={styles.xpRow}>
          <span style={styles.xpLabel}>Earned</span>
          <span style={styles.xp}>+{xp} XP</span>
        </div>
        <div style={styles.message}>
          {completionType === 'quiz' 
            ? 'Excellent work! You\'ve mastered this topic.'
            : completionType === 'notes'
            ? 'Great job! You\'ve completed reading the notes.'
            : 'Great job! You\'ve completed watching the video.'
          }
        </div>
        <div style={styles.xpInfo}>
          {completionType === 'video' && 'Videos earn 10 XP each'}
          {completionType === 'notes' && 'Notes reading earns 5 XP each'}
          {completionType === 'quiz' && 'Quizzes earn 2 XP each'}
        </div>
        {/* Close button removed, auto-dismiss only */}
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
    background: 'rgba(0,0,0,0.18)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    animation: 'modalSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  modal: {
    background: 'linear-gradient(135deg, #fff 0%, #f8f9fa 100%)',
    borderRadius: '20px',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(0, 168, 232, 0.1)',
    padding: '40px 32px 32px 32px',
    minWidth: '320px',
    maxWidth: '90vw',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    animation: 'modalSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
    border: '2px solid rgba(0, 168, 232, 0.1)',
  },
  trophyIcon: {
    marginBottom: '20px',
    animation: 'trophyFloat 3s ease-in-out infinite',
  },
  trophyImage: {
    width: '100px',
    height: '74px',
    objectFit: 'contain',
    filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
  },
  title: {
    fontSize: '1.8rem',
    fontWeight: 700,
    color: '#2c3e50',
    marginBottom: '16px',
    animation: 'titleSlideIn 0.8s ease-out 0.3s both',
    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  xpRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    fontSize: '1.15rem',
    fontWeight: 600,
    color: '#1976d2',
    marginBottom: '8px',
    animation: 'messageFadeIn 0.8s ease-out 0.5s both',
  },
  xpLabel: {
    color: '#666',
    fontWeight: 500,
    fontSize: '0.9em',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  xp: {
    color: '#1976d2',
    fontWeight: 700,
    fontSize: '1.3em',
    animation: 'xpPulse 2s ease-in-out infinite',
    display: 'inline-block',
    textShadow: '0 2px 4px rgba(25, 118, 210, 0.3)',
  },
  message: {
    color: '#444',
    fontSize: '1.08rem',
    margin: '12px 0 16px 0',
    animation: 'messageFadeIn 0.8s ease-out 0.7s both',
    lineHeight: '1.5',
  },
  xpInfo: {
    color: '#666',
    fontSize: '0.85rem',
    fontStyle: 'italic',
    margin: '8px 0 0 0',
    animation: 'messageFadeIn 0.8s ease-out 0.9s both',
    opacity: 0.8,
  },
  closeBtn: {
    marginTop: '18px',
    background: 'linear-gradient(135deg, #00A8E8 0%, #007bb8 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '14px 32px',
    fontSize: '1.1rem',
    fontWeight: 600,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0, 168, 232, 0.3)',
    transition: 'all 0.3s ease',
    animation: 'buttonGlow 2s ease-in-out infinite, messageFadeIn 0.8s ease-out 0.9s both',
    position: 'relative',
    overflow: 'hidden',
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
    zIndex: 1,
  },
  confetti: {
    position: 'absolute',
    fontSize: '1.5rem',
    animation: 'confetti 3s linear infinite',
    userSelect: 'none',
  },
  sparkle1: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    fontSize: '1.5rem',
    animation: 'sparkle 2s ease-in-out infinite',
    zIndex: 2,
  },
  sparkle2: {
    position: 'absolute',
    top: '30px',
    right: '30px',
    fontSize: '1.2rem',
    animation: 'sparkle 2s ease-in-out infinite 0.5s',
    zIndex: 2,
  },
  sparkle3: {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '1.3rem',
    animation: 'sparkle 2s ease-in-out infinite 1s',
    zIndex: 2,
  },
};

export default LessonCompleteModal; 

