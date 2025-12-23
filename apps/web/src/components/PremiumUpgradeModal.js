import React, { useEffect, useState } from 'react';

const PremiumUpgradeModal = ({ reason = 'general', onClose, onUpgrade }) => {
  const [isUpgradeHovered, setIsUpgradeHovered] = useState(false);
  const [isCancelHovered, setIsCancelHovered] = useState(false);

  useEffect(() => {
    // Add CSS keyframes for the animation only once
    if (!document.getElementById('premium-upgrade-animation-styles')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'premium-upgrade-animation-styles';
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
        
        @keyframes crownFloat {
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
            box-shadow: 0 4px 16px rgba(255, 193, 7, 0.3);
          }
          50% {
            box-shadow: 0 6px 24px rgba(255, 193, 7, 0.5);
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
  }, []);

  const getTitle = () => {
    switch (reason) {
      case 'next-topic':
        return 'Unlock Next Topic!';
      case 'next-unit':
        return 'Unlock Next Unit!';
      default:
        return 'Upgrade to Premium!';
    }
  };

  const getMessage = () => {
    switch (reason) {
      case 'next-topic':
        return 'Continue your learning journey with the next topic!';
      case 'next-unit':
        return 'Ready to advance to the next unit?';
      default:
        return 'Unlock unlimited learning content!';
    }
  };

  const getSubMessage = () => {
    switch (reason) {
      case 'next-topic':
        return 'Upgrade to Premium to unlock all topics and continue learning seamlessly.';
      case 'next-unit':
        return 'Upgrade to Premium to unlock all units and topics for unlimited learning.';
      default:
        return 'Get access to all premium features and continue learning without limits.';
    }
  };

  const getBenefits = () => {
    return [
      '✨ Unlimited access to all topics',
      '🚀 Advanced learning features',
      '📊 Detailed progress tracking',
      '🎯 Personalized learning paths',
      '💎 Premium support'
    ];
  };

  return (
    <div style={styles.overlay}>
      {/* Confetti effect */}
      <div style={styles.confettiContainer}>
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            style={{
              ...styles.confetti,
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${2 + Math.random() * 2}s`,
            }}
          >
            {['👑', '💎', '⭐', '✨', '🚀'][Math.floor(Math.random() * 5)]}
          </div>
        ))}
      </div>

      <div style={styles.modal}>
        {/* Sparkle effects */}
        <div style={styles.sparkle1}>✨</div>
        <div style={styles.sparkle2}>💎</div>
        <div style={styles.sparkle3}>⭐</div>
        
        <div style={styles.crownIcon}>
          <span style={styles.crownEmoji}>👑</span>
        </div>
        
        <div style={styles.title}>{getTitle()}</div>
        
        <div style={styles.message}>{getMessage()}</div>
        
        <div style={styles.subMessage}>{getSubMessage()}</div>
        
        <div style={styles.benefitsContainer}>
          {getBenefits().map((benefit, index) => (
            <div key={index} style={styles.benefitItem}>
              {benefit}
            </div>
          ))}
        </div>
        
        <div style={styles.buttonContainer}>
          <button 
            onClick={onUpgrade}
            style={{
              ...styles.upgradeButton,
              transform: isUpgradeHovered ? 'translateY(-2px)' : 'translateY(0)',
              boxShadow: isUpgradeHovered 
                ? '0 6px 20px rgba(255, 193, 7, 0.4)' 
                : '0 4px 16px rgba(255, 193, 7, 0.3)',
            }}
            onMouseEnter={() => setIsUpgradeHovered(true)}
            onMouseLeave={() => setIsUpgradeHovered(false)}
          >
            🚀 Upgrade to Premium
          </button>
          
          <button 
            onClick={onClose}
            style={{
              ...styles.cancelButton,
              background: isCancelHovered ? '#f8f9fa' : 'transparent',
              borderColor: isCancelHovered ? '#999' : '#ddd',
              color: isCancelHovered ? '#333' : '#666',
            }}
            onMouseEnter={() => setIsCancelHovered(true)}
            onMouseLeave={() => setIsCancelHovered(false)}
          >
            Maybe Later
          </button>
        </div>
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
    boxShadow: '0 20px 60px rgba(0,0,0,0.3), 0 0 40px rgba(255, 193, 7, 0.1)',
    padding: '40px 32px 32px 32px',
    minWidth: '400px',
    maxWidth: '90vw',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    position: 'relative',
    animation: 'modalSlideIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
    border: '2px solid rgba(255, 193, 7, 0.2)',
  },
  crownIcon: {
    marginBottom: '20px',
    animation: 'crownFloat 3s ease-in-out infinite',
  },
  crownEmoji: {
    fontSize: '4rem',
    filter: 'drop-shadow(0 4px 8px rgba(255, 193, 7, 0.3))',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#2c3e50',
    marginBottom: '16px',
    animation: 'titleSlideIn 0.8s ease-out 0.3s both',
    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  message: {
    color: '#444',
    fontSize: '1.2rem',
    margin: '12px 0 16px 0',
    animation: 'messageFadeIn 0.8s ease-out 0.5s both',
    lineHeight: '1.5',
    fontWeight: '500',
  },
  subMessage: {
    color: '#666',
    fontSize: '1rem',
    margin: '16px 0 24px 0',
    animation: 'messageFadeIn 0.8s ease-out 0.7s both',
    lineHeight: '1.5',
    maxWidth: '500px',
  },
  benefitsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '24px',
    animation: 'messageFadeIn 0.8s ease-out 0.9s both',
  },
  benefitItem: {
    color: '#2c3e50',
    fontSize: '0.95rem',
    fontWeight: '500',
    padding: '4px 0',
  },
  buttonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    width: '100%',
    animation: 'messageFadeIn 0.8s ease-out 1.1s both',
  },
  upgradeButton: {
    background: 'linear-gradient(135deg, #FFD700, #FFA500)',
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    padding: '16px 32px',
    fontSize: '1.1rem',
    fontWeight: '600',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(255, 193, 7, 0.3)',
    transition: 'all 0.3s ease',
    animation: 'buttonGlow 2s ease-in-out infinite',
    position: 'relative',
    overflow: 'hidden',
  },
  cancelButton: {
    background: 'transparent',
    color: '#666',
    border: '2px solid #ddd',
    borderRadius: '12px',
    padding: '14px 32px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
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

export default PremiumUpgradeModal;

