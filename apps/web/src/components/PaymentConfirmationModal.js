"use client";

import React, { useState, useEffect } from 'react';
import styles from './PaymentConfirmationModal.module.css';
import simpleSubscriptionService from '../services/simpleSubscriptionService';

const PaymentConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  plan, 
  loading = false,
  error = null,
  onApplyCoupon,
  coupon = null,
  year,
  semester,
  year2,
  semester2,
  onYearChange,
  onSemesterChange,
  onYear2Change,
  onSemester2Change,
}) => {
  if (!isOpen) return null;

  const [showCoupon, setShowCoupon] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [availableOffers, setAvailableOffers] = useState([]);
  const [loadingOffers, setLoadingOffers] = useState(false);
  const [expandedOffer, setExpandedOffer] = useState(null);
  const [isYearSemesterExpanded, setIsYearSemesterExpanded] = useState(true);
  const [hasSelectedYearSemester, setHasSelectedYearSemester] = useState(false);
  const [hasConfirmedYearSemester, setHasConfirmedYearSemester] = useState(false);
  const [duplicateSelectionWarning, setDuplicateSelectionWarning] = useState(false);

  const testimonials = [
    {
      name: 'Diksha',
      since: "Student since May '24",
      avatar: 'D',
      textPrefix: "I'm ",
      highlight: 'improving myself with frequent MCQs',
      textSuffix: ' because of this amazing platform.',
    },
    {
      name: 'Rahul',
      since: "Student since Jan '24",
      avatar: 'R',
      textPrefix: 'The ',
      highlight: 'short, to-the-point video explanations',
      textSuffix: ' helped me revise quickly before sessionals.',
    },
    {
      name: 'Fatima',
      since: "Student since Aug '23",
      avatar: 'F',
      textPrefix: 'The ',
      highlight: 'daily quiz reminders',
      textSuffix: ' keep me consistent with my preparation.',
    },
    {
      name: 'Arjun',
      since: "Student since Nov '23",
      avatar: 'A',
      textPrefix: 'I cleared my backlog subjects by following the ',
      highlight: 'structured study plan',
      textSuffix: ' inside the app.',
    },
  ];
  const [activeTestimonialIndex, setActiveTestimonialIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setShowCoupon(false);
      setCouponCode('');
      setDuplicateSelectionWarning(false);
      setIsYearSemesterExpanded(true);
      setHasSelectedYearSemester(false);
      setHasConfirmedYearSemester(false);
      fetchAvailableOffers();
    }
  }, [isOpen, plan?.id]);

  // Check for duplicate year/semester selection
  useEffect(() => {
    if (plan?.planType === 'yearly' && year && semester && year2 && semester2) {
      const isDuplicate = year === year2 && semester === semester2;
      setDuplicateSelectionWarning(isDuplicate);
    } else {
      setDuplicateSelectionWarning(false);
    }
  }, [year, semester, year2, semester2, plan?.planType]);

  useEffect(() => {
    if (!isOpen) {
      setActiveTestimonialIndex(0);
      return;
    }

    setActiveTestimonialIndex(0);

    if (testimonials.length <= 1) {
      return;
    }

    const intervalId = setInterval(() => {
      setActiveTestimonialIndex((prev) => (prev + 1) % testimonials.length);
    }, 5000);

    return () => clearInterval(intervalId);
  }, [isOpen]);

  const fetchAvailableOffers = async () => {
    if (!plan) return;
    
    console.log('🔍 Fetching offers for plan:', {
      id: plan.id,
      name: plan.name,
      planType: plan.planType
    });
    
    setLoadingOffers(true);
    try {
      const result = await simpleSubscriptionService.getAvailableOffers(plan);
      console.log('🔍 Offers result:', result);
      if (result.ok) {
        setAvailableOffers(result.offers || []);
        console.log('🔍 Available offers set:', result.offers);
      }
    } catch (error) {
      console.error('Error fetching offers:', error);
    } finally {
      setLoadingOffers(false);
    }
  };

  const formatPrice = (price) => {
    if (typeof price === 'string') return price;
    return `₹${price.toLocaleString()}`;
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const handleApplyCouponClick = async () => {
    if (!couponCode.trim() || !onApplyCoupon) return;
    await onApplyCoupon(couponCode.trim().toUpperCase());
  };

  const handleApplyOfferCode = async (offerCode) => {
    if (!onApplyCoupon) return;
    setCouponCode(offerCode);
    await onApplyCoupon(offerCode);
  };

  const toggleOfferExpansion = (offerCode) => {
    setExpandedOffer(expandedOffer === offerCode ? null : offerCode);
  };

  const formatOfferValue = (offer) => {
    if (offer.type === 'percentage') {
      return `${offer.value}% off`;
    }
    return `₹${offer.value} off`;
  };

  const currentTestimonial =
    testimonials[activeTestimonialIndex] || testimonials[0];

  const requiresYearSemesterSelection =
    plan?.planType === 'semester' || plan?.planType === 'yearly';

  const canShowOffersAndReviews =
    !requiresYearSemesterSelection || hasConfirmedYearSemester;

  return (
    <div className={styles.modalOverlay} onClick={handleClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>Join {plan.name} Plan</h2>
          <button 
            className={styles.closeButton} 
            onClick={handleClose}
            disabled={loading}
            aria-label="Close modal"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.modalBody}>
          <div className={styles.planSummary}>
            <div className={styles.planIcon}>
              {plan.name === 'Free' && '🎯'}
              {plan.name === 'Semester' && '📚'}
              {plan.name === 'Yearly' && '⭐'}
              {plan.name === 'Pro' && '💻'}
              {plan.name === 'Elite' && '🏆'}
            </div>
            <div className={styles.planDetails}>
              <h3 className={styles.planName}>{plan.name} Plan</h3>
              <div className={styles.planPrice}>
                <div>
                  {coupon?.originalAmount && coupon.originalAmount !== plan.price && (
                    <span className={styles.originalPrice}>{formatPrice(coupon.originalAmount)}</span>
                  )}
                  <span className={styles.price}>{formatPrice(plan.price)}</span>
                </div>
                <span className={styles.period}>{plan.period}</span>
              </div>
              <p className={styles.planDescription}>{plan.description}</p>
            </div>
          </div>

          {/* Year/Semester Selection - Only for Semester and Yearly plans */}
          {(plan.planType === 'semester' || plan.planType === 'yearly') && (
            <div className={styles.yearSemesterSection}>
              <button
                type="button"
                className={styles.yearSemesterToggle}
                onClick={() => setIsYearSemesterExpanded(!isYearSemesterExpanded)}
                disabled={loading}
              >
                <div className={styles.yearSemesterToggleLeft}>
                  <span className={styles.yearSemesterIcon}>📚</span>
                  <span>
                    {hasSelectedYearSemester && !isYearSemesterExpanded
                      ? `${year} · ${semester}${plan.planType === 'yearly' && year2 ? ` & ${year2} · ${semester2}` : ''}`
                      : 'Select Your Year & Semester'}
                  </span>
                </div>
                <span className={`${styles.yearSemesterChevron} ${isYearSemesterExpanded ? styles.yearSemesterChevronOpen : ''}`}>
                  {isYearSemesterExpanded ? '▴' : '▾'}
                </span>
              </button>

              {isYearSemesterExpanded && (
                <div className={styles.yearSemesterForm}>
                  <div className={styles.yearSemesterRow}>
                    <label className={styles.yearSemesterLabel}>
                      <span className={styles.labelText}>Select Year</span>
                      <select 
                        className={styles.yearSemesterSelect} 
                        value={year} 
                        onChange={(e) => {
                          onYearChange(e.target.value);
                          setHasSelectedYearSemester(true);
                        }}
                        disabled={loading}
                      >
                        {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.yearSemesterLabel}>
                      <span className={styles.labelText}>Select Semester</span>
                      <select 
                        className={styles.yearSemesterSelect} 
                        value={semester} 
                        onChange={(e) => {
                          onSemesterChange(e.target.value);
                          setHasSelectedYearSemester(true);
                        }}
                        disabled={loading}
                      >
                        {['Semester 1', 'Semester 2'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {plan.planType === 'yearly' && (
                    <div className={styles.yearSemesterRow}>
                      <label className={styles.yearSemesterLabel}>
                        <span className={styles.labelText}>Select Second Year</span>
                        <select 
                          className={styles.yearSemesterSelect} 
                          value={year2} 
                          onChange={(e) => {
                            onYear2Change(e.target.value);
                            setHasSelectedYearSemester(true);
                          }}
                          disabled={loading}
                        >
                          {['1st Year', '2nd Year', '3rd Year', '4th Year'].map(y => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </label>
                      <label className={styles.yearSemesterLabel}>
                        <span className={styles.labelText}>Select Second Semester</span>
                        <select 
                          className={styles.yearSemesterSelect} 
                          value={semester2} 
                          onChange={(e) => {
                            onSemester2Change(e.target.value);
                            setHasSelectedYearSemester(true);
                          }}
                          disabled={loading}
                        >
                          {['Semester 1', 'Semester 2'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )}

                  {duplicateSelectionWarning && (
                    <div className={styles.duplicateWarning}>
                      <span className={styles.warningIcon}>⚠️</span>
                      You cannot select the same year and semester twice. Please choose different semesters.
                    </div>
                  )}

                  {hasSelectedYearSemester && (
                    <button
                      type="button"
                      className={styles.yearSemesterConfirmBtn}
                      onClick={() => {
                        setIsYearSemesterExpanded(false);
                        setHasConfirmedYearSemester(true);
                      }}
                      disabled={duplicateSelectionWarning}
                    >
                      Confirm Selection
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {canShowOffersAndReviews && (
            <div className={styles.couponSection}>
              <button
                type="button"
                className={styles.couponToggle}
                onClick={() => setShowCoupon(!showCoupon)}
                disabled={loading}
              >
                <div className={styles.couponToggleLeft}>
                  <span className={styles.couponIcon}>/</span>
                  <span>Have a coupon code?</span>
                </div>
                <span className={`${styles.couponChevron} ${showCoupon ? styles.couponChevronOpen : ''}`}>
                  {showCoupon ? '▴' : '▾'}
                </span>
              </button>

              {showCoupon && (
                <div className={styles.couponForm}>
                  <input
                    type="text"
                    className={styles.couponInput}
                    placeholder="Enter Coupon Code"
                    value={couponCode}
                    onChange={(e) => setCouponCode(e.target.value)}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className={styles.couponApplyButton}
                    onClick={handleApplyCouponClick}
                    disabled={loading || !couponCode.trim()}
                  >
                    APPLY
                  </button>
                </div>
              )}

              {coupon && (
                <div className={styles.couponApplied}>
                  {coupon.message || `Coupon ${coupon.code} applied!`}
                </div>
              )}
            </div>
          )}

          {canShowOffersAndReviews && availableOffers.length > 0 && (
            <div className={styles.availableOffersSection}>
              <h3 className={styles.availableOffersTitle}>Available Coupons</h3>
              <div className={styles.offersList}>
                {availableOffers.map((offer) => (
                  <div key={offer.code} className={styles.offerCard}>
                    <div className={styles.offerHeader}>
                      <div className={styles.offerLeft}>
                        <div className={styles.offerCodeBadge}>{offer.code}</div>
                        <div className={styles.offerTitle}>{offer.title}</div>
                      </div>
                      <button
                        type="button"
                        className={styles.offerApplyButton}
                        onClick={() => handleApplyOfferCode(offer.code)}
                        disabled={loading}
                      >
                        APPLY
                      </button>
                    </div>
                    
                    <div className={styles.offerValue}>
                      {formatOfferValue(offer)}
                    </div>

                    {offer.description && (
                      <>
                        <div className={styles.offerDescription}>
                          {expandedOffer === offer.code ? (
                            offer.description
                          ) : (
                            offer.description.length > 80 
                              ? `${offer.description.substring(0, 80)}...` 
                              : offer.description
                          )}
                        </div>
                        {offer.description.length > 80 && (
                          <button
                            type="button"
                            className={styles.offerMoreButton}
                            onClick={() => toggleOfferExpansion(offer.code)}
                          >
                            {expandedOffer === offer.code ? '- LESS' : '+ MORE'}
                          </button>
                        )}
                      </>
                    )}

                    {offer.min_purchase && (
                      <div className={styles.offerMinPurchase}>
                        Minimum purchase: ₹{offer.min_purchase}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {canShowOffersAndReviews && (
            <div className={styles.testimonialSection}>
              <div className={styles.testimonialHeading}>
                <span>Students love</span>
                <span className={styles.testimonialTitleAccent}>Durrani's</span>
              </div>
              <div className={styles.testimonialCard}>
                <div className={styles.testimonialAvatar}>
                  {(currentTestimonial && currentTestimonial.avatar) || 'S'}
                </div>
                <div className={styles.testimonialBody}>
                  <div className={styles.testimonialNameLine}>
                    <span className={styles.testimonialName}>
                      {currentTestimonial?.name || 'Student'}
                    </span>
                    <span className={styles.testimonialSince}>
                      {currentTestimonial?.since || "Student since '24"}
                    </span>
                  </div>
                  <div className={styles.testimonialText}>
                    {currentTestimonial?.textPrefix}
                    {currentTestimonial?.highlight && (
                      <span className={styles.testimonialTextHighlight}>
                        {currentTestimonial.highlight}
                      </span>
                    )}
                    {currentTestimonial?.textSuffix}
                  </div>
                  <div className={styles.testimonialStars}>★★★★★</div>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className={styles.errorMessage}>
              <span className={styles.errorIcon}>⚠️</span>
              {error}
            </div>
          )}
        </div>

        {canShowOffersAndReviews && (
          <div className={styles.modalFooter}>
            <button 
              className={styles.confirmButton} 
              onClick={handleConfirm}
              disabled={loading}
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
        )}
      </div>
    </div>
  );
};

export default PaymentConfirmationModal; 

