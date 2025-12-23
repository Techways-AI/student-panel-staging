"use client";

import React, { useState } from 'react';
import styles from './PaymentDetailsScreen.module.css';

const PaymentDetailsScreen = ({ 
  plan, 
  onBack, 
  onProceedToPayment,
  purchaseDate = new Date(),
  loading = false 
}) => {
  const [whatsappNotifications, setWhatsappNotifications] = useState(true);
  const [selectedPaymentMode, setSelectedPaymentMode] = useState('card');
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const formatPrice = (price) => {
    if (typeof price === 'string') return price;
    return `₹${price.toLocaleString()}`;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleProceedToPayment = () => {
    if (!agreedToTerms) {
      alert('Please agree to the terms and conditions to proceed.');
      return;
    }

    onProceedToPayment({
      plan,
      whatsappNotifications,
      paymentMode: selectedPaymentMode,
      purchaseDate
    });
  };

  const paymentModes = [
    {
      id: 'card',
      name: 'Credit/Debit Card',
      icon: '💳',
      description: 'Visa, Mastercard, RuPay'
    },
    {
      id: 'upi',
      name: 'UPI',
      icon: '📱',
      description: 'Google Pay, PhonePe, Paytm'
    },
    {
      id: 'netbanking',
      name: 'Net Banking',
      icon: '🏦',
      description: 'All major banks'
    },
    {
      id: 'wallet',
      name: 'Digital Wallet',
      icon: '👛',
      description: 'Paytm, Amazon Pay, Freecharge'
    }
  ];

  return (
    <div className={styles.paymentDetailsContainer}>
      {/* Header */}
      <div className={styles.header}>
        <button 
          className={styles.backButton} 
          onClick={onBack}
          disabled={loading}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back to Plans
        </button>
        <h1 className={styles.title}>Complete Your Purchase</h1>
      </div>

      <div className={styles.content}>
        {/* Plan Summary */}
        <div className={styles.planSummary}>
          <div className={styles.planHeader}>
            <div className={styles.planIcon}>
              {plan.name === 'Free' && '🎯'}
              {plan.name === 'Semester' && '📚'}
              {plan.name === 'Yearly' && '⭐'}
            </div>
            <div className={styles.planInfo}>
              <h2 className={styles.planName}>{plan.name} Plan</h2>
              <p className={styles.planDescription}>{plan.description}</p>
            </div>
            <div className={styles.planPrice}>
              <span className={styles.price}>{formatPrice(plan.price)}</span>
              <span className={styles.period}>{plan.period}</span>
            </div>
          </div>

          <div className={styles.purchaseDetails}>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Purchase Date:</span>
              <span className={styles.detailValue}>{formatDate(purchaseDate)}</span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Access Duration:</span>
              <span className={styles.detailValue}>
                {plan.name === 'Free' && '7 Days'}
                {plan.name === 'Semester' && '6 Months'}
                {plan.name === 'Yearly' && '12 Months'}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Total Amount:</span>
              <span className={styles.totalAmount}>{formatPrice(plan.price)}</span>
            </div>
          </div>
        </div>

        {/* WhatsApp Notifications */}
        <div className={styles.notificationSection}>
          <h3 className={styles.sectionTitle}>Payment Notifications</h3>
          <div className={styles.whatsappOption}>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={whatsappNotifications}
                onChange={(e) => setWhatsappNotifications(e.target.checked)}
                className={styles.checkbox}
              />
              <span className={styles.checkmark}></span>
              <div className={styles.whatsappInfo}>
                <div className={styles.whatsappIcon}>📱</div>
                <div>
                  <div className={styles.whatsappTitle}>Receive payment notifications on WhatsApp</div>
                  <div className={styles.whatsappDescription}>
                    Get instant updates about your payment status, subscription renewal, and important announcements
                  </div>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Payment Mode Selection */}
        <div className={styles.paymentModeSection}>
          <h3 className={styles.sectionTitle}>Select Payment Method</h3>
          <div className={styles.paymentModes}>
            {paymentModes.map((mode) => (
              <label 
                key={mode.id} 
                className={`${styles.paymentMode} ${selectedPaymentMode === mode.id ? styles.selected : ''}`}
              >
                <input
                  type="radio"
                  name="paymentMode"
                  value={mode.id}
                  checked={selectedPaymentMode === mode.id}
                  onChange={(e) => setSelectedPaymentMode(e.target.value)}
                  className={styles.radioInput}
                />
                <div className={styles.modeContent}>
                  <div className={styles.modeIcon}>{mode.icon}</div>
                  <div className={styles.modeInfo}>
                    <div className={styles.modeName}>{mode.name}</div>
                    <div className={styles.modeDescription}>{mode.description}</div>
                  </div>
                  <div className={styles.radioCheckmark}></div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Terms and Conditions */}
        <div className={styles.termsSection}>
          <label className={styles.termsLabel}>
            <input
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className={styles.checkbox}
            />
            <span className={styles.checkmark}></span>
            <span className={styles.termsText}>
              I agree to the{' '}
              <a href="#" className={styles.termsLink}>Terms of Service</a>
              {' '}and{' '}
              <a href="#" className={styles.termsLink}>Privacy Policy</a>
            </span>
          </label>
        </div>

        {/* Action Buttons */}
        <div className={styles.actionButtons}>
          <button 
            className={styles.cancelButton} 
            onClick={onBack}
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            className={styles.proceedButton} 
            onClick={handleProceedToPayment}
            disabled={loading || !agreedToTerms}
          >
            {loading ? (
              <>
                <div className={styles.spinner}></div>
                Processing...
              </>
            ) : (
              <>
                <span className={styles.paymentIcon}>💳</span>
                Pay {formatPrice(plan.price)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentDetailsScreen; 

