"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './PaymentSuccessModal.module.css';

const PaymentSuccessModal = ({ 
  isOpen, 
  onClose, 
  planData, 
  paymentData,
  autoRedirect = true 
}) => {
  const router = useRouter();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    if (isOpen && autoRedirect) {
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            handleRedirect();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [isOpen, autoRedirect]);

  const handleRedirect = () => {
    // Redirect to dashboard with success message
    router.push('/dashboard?upgrade=success');
    onClose();
  };

  const handleClose = () => {
    onClose();
    if (autoRedirect) {
      handleRedirect();
    }
  };

  if (!isOpen) return null;

  const formatPrice = (price) => {
    if (typeof price === 'string') return price;
    return `₹${price.toLocaleString()}`;
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={styles.modalContent}>
        <div className={styles.successIcon}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
            <circle cx="40" cy="40" r="40" fill="#22c55e"/>
            <path 
              d="M24 40l12 12 20-20" 
              stroke="white" 
              strokeWidth="4" 
              strokeLinecap="round" 
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Payment Successful! 🎉</h2>
          <p className={styles.modalSubtitle}>
            Welcome to your upgraded {planData?.name} plan
          </p>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.paymentDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Plan:</span>
              <span className={styles.detailValue}>{planData?.name} Plan</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Amount:</span>
              <span className={styles.detailValue}>{formatPrice(planData?.price)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Payment ID:</span>
              <span className={styles.detailValue}>
                {paymentData?.razorpay_payment_id?.slice(-8) || 'N/A'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Status:</span>
              <span className={styles.statusSuccess}>✓ Confirmed</span>
            </div>
          </div>

          <div className={styles.whatsNext}>
            <h3>What's Next?</h3>
            <ul>
              <li>
                <span className={styles.bulletIcon}>⚡</span>
                <span>Instant access to all premium features</span>
              </li>
              <li>
                <span className={styles.bulletIcon}>📚</span>
                <span>Unlimited access to course materials</span>
              </li>
              <li>
                <span className={styles.bulletIcon}>🤖</span>
                <span>AI Tutor chatbot assistance</span>
              </li>
              <li>
                <span className={styles.bulletIcon}>🎯</span>
                <span>Personalized learning recommendations</span>
              </li>
            </ul>
          </div>

          {autoRedirect && (
            <div className={styles.redirectNotice}>
              <p>
                Redirecting to your dashboard in <strong>{countdown}</strong> seconds...
              </p>
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button 
            className={styles.primaryButton} 
            onClick={handleClose}
          >
            {autoRedirect ? 'Go to Dashboard Now' : 'Continue'}
          </button>
          
          {!autoRedirect && (
            <button 
              className={styles.secondaryButton} 
              onClick={onClose}
            >
              Stay Here
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessModal; 

