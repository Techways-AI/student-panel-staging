'use client';

import React, { useState, useMemo, useEffect, useRef, memo } from 'react';
import { Calendar, Trophy, Flame, Check, X, Zap, Crown, PlaySquare, Info, BookOpen, Brain, FileText, Target, Clock, Grid3x3, TrendingUp, GraduationCap, ChevronDown } from 'lucide-react';
// Removed: subjects.js - using curriculum API instead
import subscriptionService from '../services/simpleSubscriptionService';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';
import styles from './Upgrade.module.css';
import { useLayout } from '../context/LayoutContext';
import PaymentConfirmationModal from './PaymentConfirmationModal';

const Upgrade = () => {
      const { setShowUpgrade } = useLayout();
  const [tab, setTab] = useState('semester'); // 'subject' | 'semester' | 'yearly'
  const [year, setYear] = useState('1st Year');
  const [semester, setSemester] = useState('Semester 1');
  const [year2, setYear2] = useState('2nd Year');
  const [semester2, setSemester2] = useState('Semester 1');
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [showBottomPromo, setShowBottomPromo] = useState(false);
  const subjectSectionRef = useRef(null);
  const containerRef = useRef(null);
  const plansRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [expandedFeature, setExpandedFeature] = useState(null);
  const [visibleFeatures, setVisibleFeatures] = useState([]);
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const includedSectionRef = useRef(null);
  const rotationTimeoutRef = useRef(null);
  const currentIndexRef = useRef(0);
  const faqs = [
    { question: "Is Durrani's a replacement for my regular classes?", answer: "No, we're a complement to your classroom learning. Think of us as your personal 24/7 tutor who helps you understand difficult concepts, prepare for exams, and fill in knowledge gaps you might have missed in class." },
    { question: "How accurate is the AI tutor's information?", answer: "Our AI tutor draws information from verified academic sources, trusted textbooks, and expert-reviewed content specifically aligned with the JNTUH & OU B.Pharmacy curriculum. The content is regularly reviewed by pharmacy educators to ensure accuracy." },
    { question: "Will this really help me with my internals and externals?", answer: "Absolutely! We've designed our platform with JNTUH & OU exams in mind. We highlight important topics that frequently appear in both internal and external assessments, provide practice questions similar to exam patterns, and offer targeted revision materials to boost your scores." },
    { question: "I'm failing some subjects. Can Durrani's help me pass?", answer: "Yes! Many of our students were struggling before they found us. Our AI identifies your weak areas and creates a personalized study plan focusing on concepts you're struggling with. The interactive quizzes ensure you're not just reading but actually understanding and retaining the information." },
    { question: "How is this different from just watching YouTube videos?", answer: "Unlike random YouTube videos, our content is structured, comprehensive, and specifically aligned with your JNTUH & OU B.Pharmacy syllabus. Plus, you get an AI tutor that answers your specific questions, personalized learning paths, interactive quizzes to test your knowledge, lecture notes for revision, and focused exam preparation – all in one place." },
    { question: "Do I need special equipment or a powerful smartphone?", answer: "Nope! Durrani's works on any basic smartphone with an internet connection. Our platform is optimized to work even on slower connections." },
    { question: "What if I don't understand something even after watching the videos?", answer: "That's where our AI tutor shines! Just ask your specific question, and the AI will explain it differently, provide additional examples, or break it down further until you understand. It's like having a patient tutor who never gets tired of your questions." },
    { question: "When will you add Hindi/Telugu support?", answer: "We're currently developing regional language support and expect to roll it out within the next 3 months." }
  ];
  const [subjectPlans, setSubjectPlans] = useState([]);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [subjectsError, setSubjectsError] = useState(null);
  const [subscriptionInfo, setSubscriptionInfo] = useState(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState(null);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState(null);
  const [couponInfo, setCouponInfo] = useState(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const yearNumber = useMemo(()=>{
    const match = year.match(/^(\d)/);
    return match ? parseInt(match[1], 10) : 1;
  }, [year]);
  const semesterNumber = useMemo(()=>{
    const match = semester.match(/(\d)$/);
    return match ? parseInt(match[1], 10) : 1;
  }, [semester]);
  const yearNumber2 = useMemo(()=>{
    const match = year2.match(/^(\d)/);
    return match ? parseInt(match[1], 10) : 1;
  }, [year2]);
  const semesterNumber2 = useMemo(()=>{
    const match = semester2.match(/(\d)$/);
    return match ? parseInt(match[1], 10) : 1;
  }, [semester2]);
  // Removed: ALL_SUBJECTS - using curriculum API instead
  const subjectNames = useMemo(()=>{
    // Return empty array - subjects should come from curriculum API
    return [];
  }, [yearNumber, semesterNumber]);

  useEffect(()=>{ setSelectedSubjects([]); }, [yearNumber, semesterNumber]);

  useEffect(() => {
    const hasWindow = typeof window !== 'undefined';
    if (!hasWindow) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    let isCancelled = false;
    const fetchProfileYearSemester = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) return;
        const data = await response.json();
        if (isCancelled) return;
        if (data.year) {
          const mapYear = {
            1: '1st Year',
            2: '2nd Year',
            3: '3rd Year',
            4: '4th Year',
          };
          const mappedYear = mapYear[data.year];
          if (mappedYear) {
            setYear(mappedYear);
          }
        }
        if (data.semester) {
          const mappedSemester = data.semester === 1 ? 'Semester 1' : 'Semester 2';
          setSemester(mappedSemester);
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to prefill year/semester from profile', error);
        }
      }
    };
    fetchProfileYearSemester();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Show bottom promo only when Subject section is out of view (user scrolled past it)
  useEffect(()=>{
    if (tab !== 'subject') { setShowBottomPromo(false); return; }
    const el = subjectSectionRef.current;
    const rootEl = containerRef.current || null;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries)=>{
      entries.forEach(entry => {
        setShowBottomPromo(!entry.isIntersecting);
      });
    }, { root: rootEl, threshold: 0.25, rootMargin: '0px 0px -25% 0px' });
    observer.observe(el);
    return ()=> observer.disconnect();
  }, [tab]);

  // Fallback: explicit scroll listener within the upgrade container
  useEffect(()=>{
    if (tab !== 'subject') return;
    const container = containerRef.current;
    const section = subjectSectionRef.current;
    if (!container || !section) return;

    let ticking = false;
    const runCheck = () => {
      const threshold = section.offsetTop + section.offsetHeight - 80;
      const crossed = container.scrollTop >= threshold;
      setShowBottomPromo(crossed);
      ticking = false;
    };
    const checkVisibility = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(runCheck);
      }
    };

    checkVisibility();
    container.addEventListener('scroll', checkVisibility, { passive: true });
    window.addEventListener('resize', checkVisibility, { passive: true });
    return () => {
      container.removeEventListener('scroll', checkVisibility);
      window.removeEventListener('resize', checkVisibility);
    };
  }, [tab]);

  // Fetch current subscription status to decide whether to show promo (free users only)
  useEffect(()=>{
    (async ()=>{
      try {
        const info = await subscriptionService.getSubscriptionStatus();
        setSubscriptionInfo(info);
      } catch (e) {
        setSubscriptionInfo(null);
      }
    })();
  }, []);

  // Auto-animate features appearing one by one when section comes into view
  useEffect(() => {
    const section = includedSectionRef.current;
    if (!section) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Reset and animate items one by one
            setVisibleFeatures([]);
            const features = [
              'pci-syllabus',
              'ai-tutor',
              'video-notes',
              'study-plans',
              'practice-mcqs',
              'previous-year',
              'smart-coach',
              'progress-tracking'
            ];
            
            features.forEach((featureId, index) => {
              setTimeout(() => {
                setVisibleFeatures((prev) => [...prev, featureId]);
              }, index * 100); // 100ms delay between each item
            });
          } else {
            // Reset when section is out of view
            setVisibleFeatures([]);
            setExpandedFeature(null);
            currentIndexRef.current = 0;
            setIsAutoRotating(true);
          }
        });
      },
      { threshold: 0.2 }
    );

    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  // Auto-rotate through features: expand one by one, show description, then close and move to next
  useEffect(() => {
    if (visibleFeatures.length === 0 || !isAutoRotating) {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current);
        rotationTimeoutRef.current = null;
      }
      return;
    }

    const features = [
      'pci-syllabus',
      'ai-tutor',
      'video-notes',
      'study-plans',
      'practice-mcqs',
      'previous-year',
      'smart-coach',
      'progress-tracking'
    ];

    // Check if all features are visible
    const allVisible = features.every(f => visibleFeatures.includes(f));
    if (!allVisible) return;

    const rotateFeatures = () => {
      if (!isAutoRotating) return;
      
      // Expand current feature
      setExpandedFeature(features[currentIndexRef.current]);
      
      // After 3 seconds, close current and move to next
      rotationTimeoutRef.current = setTimeout(() => {
        if (!isAutoRotating) return;
        
        setExpandedFeature(null);
        currentIndexRef.current = (currentIndexRef.current + 1) % features.length;
        
        // Small delay before expanding next
        rotationTimeoutRef.current = setTimeout(() => {
          if (isAutoRotating) {
            rotateFeatures();
          }
        }, 500);
      }, 3000); // Show each feature for 3 seconds
    };

    // Start rotation after all items are visible (wait for last item animation)
    const startDelay = 800; // Wait for all animations to complete
    rotationTimeoutRef.current = setTimeout(() => {
      if (isAutoRotating) {
        rotateFeatures();
      }
    }, startDelay);

    return () => {
      if (rotationTimeoutRef.current) {
        clearTimeout(rotationTimeoutRef.current);
        rotationTimeoutRef.current = null;
      }
    };
  }, [visibleFeatures, isAutoRotating]);

  // Manual toggle (pause auto-rotation when user clicks)
  const handleFeatureToggle = (featureId) => {
    setIsAutoRotating(false); // Pause auto-rotation
    setExpandedFeature(expandedFeature === featureId ? null : featureId);
    
    // Resume auto-rotation after 5 seconds of no interaction
    setTimeout(() => {
      setIsAutoRotating(true);
    }, 5000);
  };

  const isYearlyPlan = !!(subscriptionInfo && (
    subscriptionInfo.plan_type === 'yearly' ||
    subscriptionInfo.interval === 'yearly' ||
    (subscriptionInfo.plan && subscriptionInfo.plan.interval === 'yearly')
  ));
  const isSubjectPlan = !!(subscriptionInfo && (
    subscriptionInfo.plan_type === 'subject-based' ||
    subscriptionInfo.interval === 'subject' ||
    (subscriptionInfo.plan && subscriptionInfo.plan.interval === 'subject') ||
    (subscriptionInfo.features && (subscriptionInfo.features.access_type === 'subject_based'))
  ));
  // Show banner when on Subject tab and scrolled past section.
  // If subscription info is unavailable, show by default; otherwise show for subject-plan users and hide for yearly.
  const shouldShowBottomPromo = tab === 'subject' && showBottomPromo && (!subscriptionInfo || isSubjectPlan) && !isYearlyPlan;

  // Fetch subject plans with codes and prices from API
  useEffect(()=>{
    if (tab !== 'subject') return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const fetchPlans = async () => {
      try {
        setLoadingSubjects(true);
        setSubjectsError(null);
        const url = `${API_BASE_URL}/api/subject-subscriptions/subject-based?year=${yearNumber}&semester=${semesterNumber}`;
        const resp = await fetch(url, { headers: token ? { 'Authorization': `Bearer ${token}` } : {} });
        if (!resp.ok) throw new Error('Failed to fetch subjects');
        const data = await resp.json();
        const plans = (data?.plans || []).map(p => ({
          id: p.id,
          amount: p.amount || 999,
          subject_code: p.features?.subject_code,
          subject_name: p.features?.subject_name || p.name,
        }));
        setSubjectPlans(plans);
      } catch (e) {
        setSubjectsError(e.message);
        setSubjectPlans([]);
      } finally {
        setLoadingSubjects(false);
      }
    };
    fetchPlans();
  }, [tab, yearNumber, semesterNumber]);

  const selectedPlanCodes = useMemo(()=> new Set(selectedSubjects), [selectedSubjects]);
  const selectedPlans = useMemo(()=> {
    // Primary path: use plans loaded from backend API
    if (subjectPlans.length > 0) {
      return subjectPlans.filter(p => selectedPlanCodes.has(p.subject_name));
    }

    // Fallback path: if API failed or returned no plans, infer plans from selected subject titles
    if (selectedSubjects.length === 0) return [];

    return selectedSubjects.map(name => {
      const [codePart, ...rest] = name.split(':');
      const subject_code = (codePart || '').trim();
      const subject_name = (rest.join(':') || codePart || '').trim() || name;

      return {
        id: subject_code ? `subject_${subject_code}` : `subject_${name}`,
        amount: 999,
        subject_code,
        subject_name,
      };
    });
  }, [subjectPlans, selectedPlanCodes, selectedSubjects]);
  const totalAmount = useMemo(()=> selectedPlans.reduce((sum, p)=> sum + (p.amount||0), 0), [selectedPlans]);
 
  const getUserDataForPayment = async () => {
    const hasWindow = typeof window !== 'undefined';
    const token = hasWindow ? localStorage.getItem('token') : null;
    const mobile = hasWindow ? localStorage.getItem('mobile') : null;
    let userInfo = {};

    if (hasWindow) {
      try {
        userInfo = JSON.parse(localStorage.getItem('userInfo') || '{}');
      } catch {
        userInfo = {};
      }
    }

    if (!userInfo.id && hasWindow) {
      try {
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        if (userData && userData.id) {
          userInfo = userData;
        }
      } catch {
        // ignore
      }
    }

    if (!userInfo.id && token) {
      try {
        const response = await fetch(`${API_BASE_URL}/api/profile/me`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (response.ok) {
          const profileData = await response.json();
          userInfo = {
            id: profileData.id,
            name: profileData.name,
            email: profileData.email,
            mobile: profileData.mobile,
          };
          if (hasWindow) {
            localStorage.setItem('userInfo', JSON.stringify(userInfo));
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to fetch user profile:', error);
        }
      }
    }

    if (!token) {
      throw new Error('User not authenticated. Please login again.');
    }

    if (!userInfo.id) {
      throw new Error('User information not available. Please login again.');
    }

    return {
      id: userInfo.id,
      name: userInfo.name || mobile,
      email: userInfo.email || '',
      mobile: userInfo.mobile || mobile || '',
    };
  };

  const updateUserYearSemester = async () => {
    const hasWindow = typeof window !== 'undefined';
    if (!hasWindow) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      const payload = {
        year: yearNumber,
        semester: semesterNumber,
      };
      const response = await fetch(`${API_BASE_URL}/api/profile/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok && process.env.NODE_ENV !== 'production') {
        console.warn('Failed to update profile year/semester for upgrade');
      }
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Error updating profile year/semester for upgrade', error);
      }
    }
  };

  const handleProceedSubjects = () => {
    if (selectedPlans.length === 0 || isProcessingPayment) return;

    const baseAmount = Math.max(1, Math.round(totalAmount));
    const name =
      selectedPlans.length === 1
        ? `Subject: ${selectedPlans[0].subject_name}`
        : `Subject Pack (${selectedPlans.length} subjects)`;
    const description =
      selectedPlans.length === 1
        ? `Get full access to ${selectedPlans[0].subject_name} for 1 month.`
        : `Get full access to ${selectedPlans.length} selected subjects for 1 month.`;

    const subjectsForPlan = selectedPlans.map(p => ({
      subject_code: p.subject_code,
      subject_name: p.subject_name,
      amount: p.amount || 999,
    }));

    setCheckoutPlan({
      id: 'subject_multi',
      name,
      price: baseAmount,
      originalPrice: baseAmount,
      period: 'for 1 month',
      description,
      features: [
        'Full video lectures for selected subjects',
        'Notes and MCQs for each subject',
        'AI Tutor for purchased subjects',
      ],
      which: 'subject',
      effectiveTab: 'subject',
      planType: 'subject-based',
      subjects: subjectsForPlan,
    });
    setPaymentError(null);
    setCouponInfo(null);
    setIsCheckoutOpen(true);
  };

  const handleSubjectCheckout = async () => {
    if (!checkoutPlan || !checkoutPlan.subjects || checkoutPlan.subjects.length === 0) return;
    if (isProcessingPayment) return;

    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      const userData = await getUserDataForPayment();
      const amount = Math.max(1, Math.round(checkoutPlan.price));

      const planData = {
        id: checkoutPlan.id || 'subject_multi',
        name: checkoutPlan.name || 'Subject-Based',
        planType: 'subject-based',
        duration: 1,
        amount,
        subjects: checkoutPlan.subjects.map(s => ({
          subject_code: s.subject_code,
          subject_name: s.subject_name,
        })),
      };

      if (couponInfo && couponInfo.code) {
        planData.couponCode = couponInfo.code;
        planData.originalAmount = couponInfo.originalAmount || checkoutPlan.originalPrice || amount;
        planData.discountedAmount = amount;
      }

      await subscriptionService.processDirectPayment(planData, userData);

      alert(`Payment successful! You now have access to ${checkoutPlan.subjects.length} subject${checkoutPlan.subjects.length > 1 ? 's' : ''}.`);

      try {
        const updatedSubscription = await subscriptionService.getSubscriptionStatus();
        setSubscriptionInfo(updatedSubscription);
      } catch (statusError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to refresh subscription status:', statusError);
        }
      }
    } catch (e) {
      console.error('Payment failed', e);
      const message = e && e.message ? e.message : 'Payment failed. Please try again.';
      setPaymentError(message);
      if (!message.toLowerCase().includes('cancelled')) {
        alert(`Payment failed: ${message}`);
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handlePlanPurchase = async (which, forcedTab, overrideAmount) => {
    if (isProcessingPayment) return;

    const effectiveTab = forcedTab || tab;
    const baseAmount = effectiveTab === 'semester' ? (which === 'plus' ? 3599 : 5999) : (which === 'plus' ? 6199 : 10999);
    const amount = typeof overrideAmount === 'number' ? overrideAmount : baseAmount;
    let allowedSemesters;
    if (effectiveTab === 'yearly') {
      const primary = `${yearNumber}-${semesterNumber}`;
      const secondary = `${yearNumber2}-${semesterNumber2}`;
      allowedSemesters = secondary && secondary !== primary ? [primary, secondary] : [primary];
    }
    const planData = {
      id: `${which}_${effectiveTab}`,
      name: `Pharma ${which === 'pro' ? 'PRO' : 'PLUS'} ${effectiveTab === 'semester' ? 'Semester' : 'Yearly'}`,
      planType: effectiveTab,
      duration: effectiveTab === 'semester' ? 6 : 12,
      amount,
      allowedSemesters,
    };

    if (couponInfo && couponInfo.code) {
      planData.couponCode = couponInfo.code;
      planData.originalAmount = couponInfo.originalAmount || baseAmount;
      planData.discountedAmount = amount;
    }

    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      await updateUserYearSemester();

      const userData = await getUserDataForPayment();
      const result = await subscriptionService.processDirectPayment(planData, userData);

      if (process.env.NODE_ENV !== 'production') {
        console.log('Subscription successful:', result);
      }

      alert(`Payment successful! Welcome to ${planData.name}. You now have access to all premium features.`);

      try {
        const updatedSubscription = await subscriptionService.getSubscriptionStatus();
        setSubscriptionInfo(updatedSubscription);
      } catch (statusError) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn('Failed to refresh subscription status:', statusError);
        }
      }
    } catch (e) {
      console.error('Payment failed', e);
      const message = e && e.message ? e.message : 'Payment failed. Please try again.';
      setPaymentError(message);
      if (!message.toLowerCase().includes('cancelled')) {
        alert(`Payment failed: ${message}`);
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  const handleStartJourney = () => {
    if (tab !== 'semester') setTab('semester');
    setTimeout(()=>{
      if (plansRef.current) {
        plansRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
  };

  const toggleSubject = (name) => {
    setSelectedSubjects(prev => prev.includes(name)
      ? prev.filter(n => n !== name)
      : [...prev, name]
    );
  };
  // tier toggle removed

  const getPrice = (which) => {
    if (tab === 'semester') return which === 'plus' ? 3599 : 5999;
    if (tab === 'yearly') return which === 'plus' ? 6199 : 10999;
    return 0;
  };

  const getOriginalPrice = (which) => {
    if (tab === 'semester') return which === 'plus' ? 6000 : 10000;
    if (tab === 'yearly') return null; // no design provided
    return null;
  };

  const period = tab === 'semester' ? 'per semester' : tab === 'yearly' ? 'per year' : '';

  const plusFeatures = [
    'All subjects for current semester',
    'Complete video lectures',
    'Notes mapped to your curriculum',
    'Easy to read notes',
    'MCQs and practice tests',
    'Daily planner',
    'Leadership board'
  ];

  const proExtra = [
    'AI Tutor – unlimited questions',
    'Previous years questions',
    'Smart Coach analytics',
    'Streak tracking'
  ];

  const openPlanCheckout = (which, forcedTab) => {
    const effectiveTab = forcedTab || tab;
    const amount = effectiveTab === 'semester'
      ? (which === 'plus' ? 3599 : 5999)
      : (which === 'plus' ? 6199 : 10999);

    const name = `Pharma ${which === 'pro' ? 'PRO' : 'PLUS'} ${effectiveTab === 'semester' ? 'Semester' : 'Yearly'}`;
    const periodLabel = effectiveTab === 'semester' ? 'per semester' : 'per year';
    const description = effectiveTab === 'semester'
      ? "Get complete access to Durrani's for this semester (6 months)."
      : "Get complete access to Durrani's for the full academic year (12 months).";

    const features = which === 'pro' ? plusFeatures.concat(proExtra) : plusFeatures;

    setCheckoutPlan({
      id: `${which}_${effectiveTab}`,
      name,
      price: amount,
      originalPrice: amount,
      period: periodLabel,
      description,
      features,
      which,
      effectiveTab,
      planType: effectiveTab,
    });
    setPaymentError(null);
    setCouponInfo(null);
    setIsCheckoutOpen(true);
  };

  const handleApplyCoupon = async (code) => {
    if (!checkoutPlan) return;
    try {
      setIsApplyingCoupon(true);
      setPaymentError(null);

      const isSubjectBased = (checkoutPlan.planType === 'subject-based' || checkoutPlan.effectiveTab === 'subject');
      const duration = isSubjectBased
        ? 1
        : (checkoutPlan.effectiveTab === 'semester' ? 6 : 12);

      const planData = {
        id: checkoutPlan.id,
        name: checkoutPlan.name,
        planType: checkoutPlan.planType || checkoutPlan.effectiveTab,
        duration,
        amount: checkoutPlan.originalPrice || checkoutPlan.price,
      };

      const result = await subscriptionService.applyCoupon(planData, code);

      if (!result || result.ok === false) {
        const message = (result && result.error) || 'Failed to apply coupon. Please try again.';
        setPaymentError(message);
        setCouponInfo(null);
        return;
      }

      const couponData = result.data || {};

      setCheckoutPlan(prev => prev ? { ...prev, price: couponData.discounted_amount } : prev);
      setCouponInfo({
        code: couponData.code,
        message: couponData.message,
        originalAmount: couponData.original_amount,
        discountedAmount: couponData.discounted_amount,
        discountAmount: couponData.discount_amount,
      });
    } catch (e) {
      console.error('Failed to apply coupon', e);
      const message = e && e.message ? e.message : 'Failed to apply coupon. Please try again.';
      setPaymentError(message);
      setCouponInfo(null);
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleConfirmCheckout = async () => {
    if (!checkoutPlan) return;
    if (checkoutPlan.planType === 'subject-based' || checkoutPlan.effectiveTab === 'subject' || checkoutPlan.which === 'subject') {
      await handleSubjectCheckout();
    } else {
      await handlePlanPurchase(checkoutPlan.which, checkoutPlan.effectiveTab, checkoutPlan.price);
    }
    setIsCheckoutOpen(false);
  };

  return (
    <div className={styles.upgradePage} ref={containerRef}>
      <PaymentConfirmationModal
        isOpen={isCheckoutOpen && !!checkoutPlan}
        onClose={() => {
          if (!isProcessingPayment) {
            setIsCheckoutOpen(false);
          }
        }}
        onConfirm={handleConfirmCheckout}
        plan={checkoutPlan || { name: '', price: 0, period: '', description: '', features: [] }}
        loading={isProcessingPayment || isApplyingCoupon}
        error={paymentError}
        onApplyCoupon={handleApplyCoupon}
        coupon={couponInfo}
        year={year}
        semester={semester}
        year2={year2}
        semester2={semester2}
        onYearChange={setYear}
        onSemesterChange={setSemester}
        onYear2Change={setYear2}
        onSemester2Change={setSemester2}
      />
      {/* Close button removed as requested */}

      <header className={styles.hero}>
        <div className={styles.heroIcon}><Crown size={40} /></div>
        <h2 className={styles.heroTitle}>Top External Exams</h2>
        <p className={styles.heroSub}>with your Personal AI Mentor</p>
        
        <div className={styles.heroStats}>
          <span>💼 Become Job-ready</span>
          <span>💰 Get high paying job</span>
          <span>🛡️ Money back guarantee</span>
              </div>
        <div className={styles.tabs} role="tablist" aria-label="Plan Type">
          <button className={`${styles.tab} ${tab === 'subject' ? styles.activeTab : ''}`} onClick={() => setTab('subject')} role="tab" aria-selected={tab==='subject'}>Subject Plan</button>
          <button className={`${styles.tab} ${tab === 'semester' ? styles.activeTab : ''}`} onClick={() => setTab('semester')} role="tab" aria-selected={tab==='semester'}>Semester Plan</button>
          <button className={`${styles.tab} ${tab === 'yearly' ? styles.activeTab : ''}`} onClick={() => setTab('yearly')} role="tab" aria-selected={tab==='yearly'}>Yearly Plan</button>
              </div>
        {/* Plus/Pro toggle removed as requested */}
      </header>

      {tab === 'subject' ? (
        <section className={styles.subjectWrap} ref={subjectSectionRef}>
          <div className={styles.subjectCard} role="dialog" aria-label="Select Your Subject">
            <div className={styles.subjectHeader}>Select Your Subject {selectedSubjects.length>0 && <span className={styles.badge}>{selectedSubjects.length}</span>}</div>
            <div className={styles.subjectHelp}>Choose the subject you want to master. You'll get access to all videos, notes, and practice materials for this subject.</div>
            <div className={styles.filtersRow}>
              <label className={styles.filterCol}>
                <span className={styles.filterLabel}>Select Year</span>
                <select className={styles.select} value={year} onChange={(e)=>setYear(e.target.value)}>
                  {['1st Year','2nd Year','3rd Year','4th Year'].map(y=> (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>
              <label className={styles.filterCol}>
                <span className={styles.filterLabel}>Select Semester</span>
                <select className={styles.select} value={semester} onChange={(e)=>setSemester(e.target.value)}>
                  {['Semester 1','Semester 2'].map(s=> (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className={styles.subjectList} role="listbox" aria-multiselectable="true" aria-label="Available Subjects">
              {loadingSubjects && <div className={styles.comingSoon}>Loading subjects...</div>}
              {subjectsError && <div className={styles.comingSoon}>Failed to load subjects</div>}
              {!loadingSubjects && !subjectsError && (subjectPlans.length>0 ? subjectPlans.map(p=>p.subject_name) : subjectNames).map((name)=> {
                const isSelected = selectedSubjects.includes(name);
                return (
                <button key={name} className={`${styles.subjectItem} ${isSelected?styles.subjectActive:''}`} onClick={()=>toggleSubject(name)} role="option" aria-selected={isSelected}>
                  <span className={styles.subjectRadio} aria-hidden="true"><span className={styles.radioDot}></span></span>
                  <span className={styles.subjectText}>
                    <span className={styles.subjectTitle}>{name}</span>
                    <span className={styles.subjectSub}>{`${year} · ${semester}`}</span>
                  </span>
                  <span className={styles.subjectRight}>
                    <PlaySquare size={18} />
                  </span>
                </button>
              );})}
            </div>

            <div className={styles.subjectFooter}>
              <button className={styles.ghostBtn} onClick={()=> setTab('semester')}>Cancel</button>
              <button
                onClick={handleProceedSubjects}
                className={`${styles.accentBtn} ${(selectedSubjects.length===0 || isProcessingPayment)?styles.btnDisabled:''}`}
                disabled={selectedSubjects.length===0 || isProcessingPayment}
              >
                {isProcessingPayment ? 'Processing...' : `Proceed to Payment${selectedSubjects.length>0?` (${selectedSubjects.length})`:''}`}
              </button>
            </div>
          </div>
        </section>
      ) : (
        <section className={styles.pricingGrid} ref={plansRef}>
          {/* Plus card */}
          <article className={`${styles.planBox} ${styles.highlight}`}>
            <h3 className={styles.planTitle}>{tab === 'semester' ? 'Semester Plus' : 'Yearly Plus'}</h3>
            <div className={styles.priceRow}>
              <div className={styles.priceMain}><span className={styles.currency}>₹</span>{getPrice('plus').toLocaleString('en-IN')}</div>
              <div className={styles.priceAside}>
                <span className={styles.period}>{period}</span>
                {tab==='semester' && (
                  <div className={styles.strikePrice}>₹{getOriginalPrice('plus')?.toLocaleString('en-IN')}</div>
                )}
              </div>
            </div>
            {tab==='semester' && (
              <div className={styles.saveTag}>Save ₹{(getOriginalPrice('plus')-getPrice('plus')).toLocaleString('en-IN')}</div>
            )}
            <ul className={styles.featureList}>
              {plusFeatures.map(f => (
                <li key={f}><span className={`${styles.bullet} ${styles.check}`}><Check size={14} strokeWidth={3} /></span>{f}</li>
              ))}
              {proExtra.map(f => (
                <li key={`x-${f}`} className={styles.unavailable}><span className={`${styles.bullet} ${styles.cross}`}><X size={12} strokeWidth={3} /></span>{f}</li>
              ))}
                      </ul>
            <button
              className={styles.primaryBtn}
              onClick={()=>openPlanCheckout('plus')}
              disabled={isProcessingPayment}
            >
              <span className={styles.btnIcon}><Zap size={20} /></span>
              {isProcessingPayment ? 'Processing...' : 'Get Started'}
            </button>
          </article>

          {/* Pro card */}
          <article className={`${styles.planBox} ${styles.recommended} ${styles.highlight}`}>
            <div className={styles.recoBadge}>Recommended</div>
            <h3 className={styles.planTitle}>{tab === 'semester' ? 'Semester Pro' : 'Yearly Pro'}</h3>
            <div className={styles.priceRow}>
              <div className={styles.priceMain}><span className={styles.currency}>₹</span>{getPrice('pro').toLocaleString('en-IN')}</div>
              <div className={styles.priceAside}>
                <span className={styles.period}>{period}</span>
                {tab==='semester' && (
                  <div className={styles.strikePrice}>₹{getOriginalPrice('pro')?.toLocaleString('en-IN')}</div>
                )}
              </div>
            </div>
            {tab==='semester' && (
              <div className={styles.saveTag}>Save ₹{(getOriginalPrice('pro')-getPrice('pro')).toLocaleString('en-IN')}</div>
            )}
            <ul className={styles.featureList}>
              {plusFeatures.concat(proExtra).map(f => (
                <li key={f}><span className={`${styles.bullet} ${styles.check}`}><Check size={14} strokeWidth={3} /></span>{f}</li>
              ))}
            </ul>
            <button
              className={styles.accentBtn}
              onClick={()=>openPlanCheckout('pro')}
              disabled={isProcessingPayment}
            >
              <span className={styles.btnIcon}><Crown size={20} /></span>
              {isProcessingPayment ? 'Processing...' : 'Get Pro Access'}
            </button>
          </article>
        </section>
      )}

      {/* Bottom upgrade promo – only for Subject Plan view */}
      {shouldShowBottomPromo && (
        <div className={styles.bottomPromo} role="region" aria-label="Upgrade to Semester Pro">
          <div className={styles.bottomPromoInner}>
            <div className={styles.bottomPromoLeft}>
              <div className={styles.bottomPromoTitle}>Upgrade to Yearly Pro</div>
              <div className={styles.bottomPromoPrice}>₹10,999 <span className={styles.bottomPromoBadge}>Best Value</span></div>
            </div>
            <button
              className={styles.bottomPromoBtn}
              onClick={()=>openPlanCheckout('pro','yearly')}
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? 'Processing...' : 'Upgrade Now'}
            </button>
          </div>
        </div>
      )}

      

      {/* Why Durrani's section placed immediately after plan cards */}
      <section className={styles.whyBlock} id="why-durranis">
        <h3 className={styles.sectionTitle}>Why Durrani's Stands Out</h3>
        <div className={styles.whyTable} role="table" aria-label="Comparison table">
          <div className={styles.whyHeader} role="row">
            <div className={styles.featureCol} role="columnheader">Feature</div>
            <div className={styles.col} role="columnheader"><span className={`${styles.hLogo} ${styles.logoYouTube}`} aria-hidden="true"></span><span>YouTube</span></div>
            <div className={styles.col} role="columnheader"><span className={`${styles.hLogo} ${styles.logoChatGPT}`} aria-hidden="true"></span><span>ChatGPT</span></div>
            <div className={styles.col} role="columnheader"><span className={`${styles.hLogo} ${styles.logoTutor}`} aria-hidden="true"></span><span>Private Tuitions</span></div>
            <div className={`${styles.col} ${styles.brandCol}`} role="columnheader"><span className={`${styles.hLogo} ${styles.logoBrand}`} aria-hidden="true"></span><span>Durrani's</span></div>
          </div>
          {[
            {icon:'🧠', label:'Smart Coach (AI‑Powered Analytics)', yt:'cross', gpt:'cross', tut:'cross', dur:'check', sub:'Analyzes weaknesses, improvement areas, insights & peer comparison'},
            {icon:'🤖', label:'AI Tutor (24/7 PCI )', yt:'cross', gpt:'cross', tut:'cross', dur:'check'},
            {icon:'📜', label:'Previous Years Questions ', yt:'cross', gpt:'cross', tut:'limited', dur:'check'},
            {icon:'📚', label:'Notes, Videos mapped to your curriculum', yt:'scattered', gpt:'scattered', tut:'limited', dur:'check'},
            {icon:'🗓️', label:'Personalized Study Plans & Daily Planner', yt:'cross', gpt:'cross', tut:'cross', dur:'check'},
            {icon:'🧩', label:'PCI Syllabus', yt:'scattered', gpt:'cross', tut:'cross', dur:'check'},
            {icon:'🧪', label:'MCQs & Practice Tests', yt:'cross', gpt:'limited', tut:'cross', dur:'check'},
            {icon:'📈', label:'Progress Tracking & Gamification', yt:'cross', gpt:'cross', tut:'cross', dur:'check'},
          ].map((row)=> (
            <div className={styles.whyRow} role="row" key={row.label}>
              <div className={styles.featureCol} role="cell">
                <span className={styles.fIcon}>{row.icon}</span>
                <span className={styles.fText}>{row.label}</span>
                {row.sub && <div className={styles.subNote}>{row.sub}</div>}
              </div>
              {['yt','gpt','tut','dur'].map((k, i)=> (
                <div className={`${styles.col} ${i===3?styles.brandCol:''}`} role="cell" key={k}>
                  {row[k]==='check' && <span className={`${styles.bullet} ${styles.check}`}>✓</span>}
                  {row[k]==='cross' && <span className={`${styles.bullet} ${styles.cross}`}>✕</span>}
                  {row[k]==='limited' && <span className={styles.limited}>Limited</span>}
                  {row[k]==='scattered' && <span className={styles.scattered}>Scattered</span>}
                </div>
              ))}
            </div>
          ))}

          <div className={`${styles.whyRow} ${styles.costRow}`} role="row">
            <div className={styles.featureCol} role="cell">Cost for 6 Months (1 Semester)</div>
            {/* YouTube */}
            <div className={styles.col} role="cell">
              <div className={styles.costCell}>
                <div className={styles.costPrice}>₹0</div>
                <div className={styles.costLabel}>YouTube</div>
                <div className={styles.costNote}>+ Time wasted</div>
              </div>
            </div>
            {/* ChatGPT */}
            <div className={styles.col} role="cell">
              <div className={styles.costCell}>
                <div className={styles.costPrice}>₹9,900</div>
                <div className={styles.costLabel}>ChatGPT</div>
              </div>
            </div>
            {/* Private Tuitions */}
            <div className={styles.col} role="cell">
              <div className={styles.costCell}>
                <div className={styles.costPrice}>₹48,000</div>
                <div className={styles.costLabel}>Private Tuitions</div>
              </div>
            </div>
            <div className={`${styles.col} ${styles.brandCol}`} role="cell">
              <div className={styles.priceMain}><span className={styles.currency}>₹</span>3,599</div>
              <div className={styles.periodSmall}>onwards</div>
            </div>
          </div>
        </div>

        <div className={styles.savingsBlock}>
          <div className={styles.savingsTitle}><span className={styles.coin}>💰</span> Your Savings with Durrani's Semester Pro</div>
          <div className={styles.savingsGrid}>
            <div className={styles.saveItem}>
              <div className={styles.saveSubtitle}>vs ChatGPT Pro</div>
              <div className={styles.saveBig}>Save ₹3,901</div>
              <div className={styles.saveSmall}>(₹9,900 - ₹5,999)</div>
            </div>
            <div className={styles.saveItem}>
              <div className={styles.saveSubtitle}>vs Private Tuitions</div>
              <div className={styles.saveBig}>Save ₹42,001</div>
              <div className={styles.saveSmall}>(₹48,000 - ₹5,999)</div>
            </div>
          </div>
          <p className={styles.savingsNote}>Get comprehensive pharmacy education with AI tutor, previous years questions, and personalized study plans – all at a fraction of the cost!</p>
        </div>

        <div className={styles.centerCTA}>
          <button className={styles.accentBtn} onClick={handleStartJourney}>Start Your Journey</button>
        </div>
      </section>

      <section ref={includedSectionRef} className={styles.includedSection}>
        <h3 className={styles.sectionTitle} style={{textAlign:'center', marginBottom: '32px'}}>Included in Every Plan</h3>
        <div className={styles.includedFeaturesWrapper}>
          <div className={styles.includedFeaturesList}>
          {[
            { id: 'pci-syllabus', icon: BookOpen, title: 'Complete PCI Syllabus', desc: 'Comprehensive coverage of all PCI curriculum topics and subjects' },
            { id: 'ai-tutor', icon: Brain, title: 'AI Tutor (24/7 Support)', desc: 'Get instant answers to your questions anytime, anywhere' },
            { id: 'video-notes', icon: FileText, title: 'Video Lessons & Notes', desc: 'Structured video content and comprehensive notes mapped to your curriculum' },
            { id: 'study-plans', icon: Target, title: 'Personalized Study Plans', desc: 'AI-generated daily study schedules tailored to your learning pace' },
            { id: 'practice-mcqs', icon: Grid3x3, title: 'Practice MCQs', desc: 'Subject and topic-wise MCQs to practice and test your knowledge' },
            { id: 'previous-year', icon: FileText, title: 'Previous Year Questions', desc: 'Access past exam papers and questions for thorough preparation' },
            { id: 'smart-coach', icon: TrendingUp, title: 'Smart Coach Analytics', desc: 'AI-powered insights to track progress and identify improvement areas' },
            { id: 'progress-tracking', icon: GraduationCap, title: 'Progress Tracking', desc: 'Monitor your learning journey with streaks, XP, and leaderboard rankings' }
          ].map((feature, index) => {
            const IconComponent = feature.icon;
            const isVisible = visibleFeatures.includes(feature.id);
            const isExpanded = expandedFeature === feature.id;
            
            return (
              <div
                key={feature.id}
                className={`${styles.includedFeatureItem} ${isVisible ? styles.visible : ''} ${isExpanded ? styles.expanded : ''}`}
                onClick={() => handleFeatureToggle(feature.id)}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className={styles.includedFeatureIcon}>
                  <IconComponent size={24} strokeWidth={2.5} />
                </div>
                <div className={styles.includedFeatureContent}>
                  <div className={styles.includedFeatureTitle}>{feature.title}</div>
                  <div className={`${styles.includedFeatureDesc} ${isExpanded ? styles.expandedDesc : ''}`}>
                    {feature.desc}
                  </div>
                </div>
                <div className={`${styles.includedFeatureChevron} ${isExpanded ? styles.chevronExpanded : ''}`}>
                  <ChevronDown size={20} strokeWidth={2.5} />
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </section>

      <section className={styles.testimonialsBlock}>
        <h3 className={styles.sectionTitle}>What Our Students Say</h3>
        <div className={styles.testiGrid}>
          <div className={styles.testiCard}>
            <div className={styles.stars}>⭐⭐⭐⭐⭐</div>
            <p>AI tutor helped me understand complex concepts. My grades improved!</p>
            <span className={styles.author}>Priya Sharma</span>
          </div>
          <div className={styles.testiCard}>
            <div className={styles.stars}>⭐⭐⭐⭐⭐</div>
            <p>Exam prep materials are comprehensive and saved me months.</p>
            <span className={styles.author}>Rahul Patel</span>
              </div>
          <div className={styles.testiCard}>
            <div className={styles.stars}>⭐⭐⭐⭐⭐</div>
            <p>The study schedule planner keeps me organized. I never miss important topics now.</p>
            <span className={styles.author}>Anjali Singh</span>
          </div>
            </div>
      </section>

      {/* FAQ Section - placed below reviews */}
      <section className={styles.faqBlock}>
        <h3 className={styles.sectionTitle}>Frequently Asked Questions</h3>
        <div className={styles.faqList}>
          {faqs.map((item, idx)=> (
            <div key={item.question} className={styles.faqItem}>
              <button className={styles.faqQ} onClick={()=> setOpenFaq(openFaq===idx?null:idx)} aria-expanded={openFaq===idx}>
                <span>{item.question}</span>
                <span className={styles.faqIcon}>{openFaq===idx?'-':'+'}</span>
              </button>
              {openFaq===idx && (
                <div className={styles.faqA}>{item.answer}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      <footer className={styles.footerCTA}>
        <h3 className={styles.sectionTitle}>Ready to Excel in Your Pharmacy Studies?</h3>
            <div className={styles.ctaButtons}>
          <button className={styles.accentBtn}>Get Started Now</button>
          <button className={styles.ghostBtn}>Compare Plans</button>
            </div>
      </footer>
      </div>
  );
};

export default memo(Upgrade);

