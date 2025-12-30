"use client";
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
import styles from './Login.module.css';
import { useAuth } from '../context/AuthContext';
import { checkProfileCompletionFromAPI } from '../utils/profileUtils';

// Base URL for backend API
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://student-panel-staging-production.up.railway.app/';
const RESEND_COOLDOWN_SECONDS = 15;

// Persistent UUID generation function - generates same UUID for same browser
const generateFallbackUUID = () => {
  // Check if we already have a persistent UUID
  let persistentUuid = null;
  try {
    persistentUuid = localStorage.getItem('persistent_device_uuid');
  } catch (e) {
    // ignore
  }
  if (!persistentUuid) {
    // Generate a new persistent UUID and store it
    persistentUuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    try {
      // Store it persistently
      localStorage.setItem('persistent_device_uuid', persistentUuid);
      console.log('🔧 Generated new persistent device UUID:', persistentUuid);
    } catch (e) {
      // ignore storage failures
    }
  }
  return persistentUuid;
};

const Login = () => {
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [showOtpAnimation, setShowOtpAnimation] = useState(false);
  const [otpStatus, setOtpStatus] = useState(null);
  const [otpExpiryTime, setOtpExpiryTime] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallCta, setShowInstallCta] = useState(false);
  const [uiReady, setUiReady] = useState(false);
  const [reqId, setReqId] = useState(null);

  
  const router = useRouter();
  const { login, token } = useAuth();

  // Ensure mobile layout does not reserve space for a navbar on the login page
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.body.classList.add('login-page');
    }
    // Defer UI entrance to next frame to avoid jank on first paint
    if (typeof window !== 'undefined') {
      const raf = requestAnimationFrame(() => setUiReady(true));
      return () => {
        cancelAnimationFrame(raf);
        if (typeof document !== 'undefined') {
          document.body.classList.remove('login-page');
        }
      };
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('login-page');
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      if (!isStandalone) setShowInstallCta(true);
    };
    const onInstalled = () => {
      setShowInstallCta(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    if (!isStandalone && (process.env.NEXT_PUBLIC_ANDROID_APP_URL || process.env.NEXT_PUBLIC_IOS_APP_URL)) {
      setShowInstallCta(true);
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    try {
      const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone;
      if (isStandalone) {
        setShowInstallCta(false);
        return;
      }
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome !== 'accepted') return;
        setDeferredPrompt(null);
        setShowInstallCta(false);
        return;
      }
      const ua = navigator.userAgent || navigator.vendor || '';
      const isAndroid = /Android/i.test(ua);
      const isiOS = /iPad|iPhone|iPod/i.test(ua);
      const androidUrl = process.env.NEXT_PUBLIC_ANDROID_APP_URL;
      const iosUrl = process.env.NEXT_PUBLIC_IOS_APP_URL;
      if (isAndroid && androidUrl) {
        window.location.href = androidUrl;
        return;
      }
      if (isiOS && iosUrl) {
        window.location.href = iosUrl;
        return;
      }
      if (androidUrl) {
        window.location.href = androidUrl;
      } else if (iosUrl) {
        window.location.href = iosUrl;
      }
    } catch (e) {
      // ignore
    }
  }, [deferredPrompt]);

  // Memoize validation checks to prevent unnecessary re-renders
  const isValidNumber = useMemo(() => mobileNumber.length === 10, [mobileNumber]);
  const isValidOtp = useMemo(() => otp.every(digit => digit !== ''), [otp]);

  // Show OTP animation when OTP is sent
  useEffect(() => {
    if (isOtpSent) {
      setShowOtpAnimation(true);
      // Focus on first OTP input after animation
      const timer = setTimeout(() => {
        const firstOtpInput = document.getElementById('otp-0');
        if (firstOtpInput) {
          firstOtpInput.focus();
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOtpSent]);

  // OTP countdown timer (kept for UI compatibility, but not driven by backend now)
  useEffect(() => {
    if (otpExpiryTime && otpExpiryTime > 0) {
      const timer = setInterval(() => {
        setOtpExpiryTime(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
    }
  }, [otpExpiryTime]);

  useEffect(() => {
    if (!resendCooldown || resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  // Optimized OTP change handler with useCallback
  const handleOtpChange = useCallback((index, value) => {
    if (value.length > 1) value = value[0];
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError('');

    // Auto-focus next input
    if (value && index < 3) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      if (nextInput) nextInput.focus();
    }
  }, [otp]);

  // Optimized key down handler
  const handleKeyDown = useCallback((index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      if (prevInput) prevInput.focus();
    }
  }, [otp]);

  // Optimized paste handler
  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text');
    const pastedOtp = pastedData.slice(0, 4).split('').map(char => /\d/.test(char) ? char : '');
    if (pastedOtp.length > 0) {
      const newOtp = [...otp];
      pastedOtp.forEach((digit, index) => {
        if (index < 4) newOtp[index] = digit;
      });
      setOtp(newOtp);
      setOtpError('');
    }
  }, [otp]);

  // Optimized send OTP handler using MSG91 widget
  const handleSendOtp = useCallback((e) => {
    e.preventDefault();
    if (mobileNumber.length !== 10) {
      setOtpError('Please enter a valid 10-digit mobile number');
      return;
    }

    if (typeof window === 'undefined' || !window.sendOtp) {
      setOtpError('OTP service not available. Please refresh and try again.');
      return;
    }

    const identifier = `91${mobileNumber}`;
    setIsVerifying(true);
    setOtpError('');

    window.sendOtp(
      identifier,
      (data) => {
        setIsOtpSent(true);
        // reqId may be returned by widget
        if (data && data.reqId) {
          setReqId(data.reqId);
        }
        // Approximate expiry UI if needed
        setOtpExpiryTime(5 * 60);
        setResendCooldown(RESEND_COOLDOWN_SECONDS);
        setIsVerifying(false);
      },
      (err) => {
        console.error('sendOtp error', err);
        setOtpError('Failed to send OTP. Please try again.');
        setIsVerifying(false);
      }
    );
  }, [mobileNumber]);

  // Fallback device type detection when device manager is not available
  const detectDeviceTypeFallback = useCallback(() => {
    try {
      const userAgent = navigator.userAgent;
      
      // More specific mobile patterns to avoid false positives
      const mobilePatterns = [
        /Android\s+\d+/,  // Android with version number
        /iPhone\s+OS\s+\d+/,  // iPhone with OS version
        /iPad.*OS\s+\d+/,  // iPad with OS version
        /Windows Phone\s+\d+/,  // Windows Phone with version
        /BlackBerry\s+\d+/,  // BlackBerry with version
        /Opera Mini/,  // Opera Mini browser
        /IEMobile/,  // Internet Explorer Mobile
        /webOS/,  // webOS
        /Symbian/,  // Symbian
        /Kindle/,  // Kindle
        /Silk/,  // Silk browser
      ];
      
      // Check for specific mobile patterns first
      for (const pattern of mobilePatterns) {
        if (pattern.test(userAgent)) {
          console.log(`🔍 Fallback detection: Device detected as mobile due to pattern: ${pattern}`);
          console.log(`🔍 Fallback detection: User Agent: ${userAgent}`);
          return 'mobile';
        }
      }
      
      // Additional checks for generic mobile indicators
      if (/Mobile.*Safari/.test(userAgent)) {
        console.log(`🔍 Fallback detection: Device detected as mobile due to Mobile Safari`);
        return 'mobile';
      }
      
      // Check for tablet patterns
      if (/iPad|Android.*Tablet|Kindle.*Fire/.test(userAgent)) {
        console.log(`🔍 Fallback detection: Device detected as mobile due to tablet pattern`);
        return 'mobile';
      }
      
      console.log(`🔍 Fallback detection: Device detected as desktop`);
      return 'desktop';
    } catch (error) {
      console.error('Fallback device detection failed:', error);
      return 'desktop'; // Default to desktop on error
    }
  }, []);

  // Optimized verify OTP handler using MSG91 widget + backend token verification
  const handleVerifyOtp = useCallback(async (e) => {
    e.preventDefault();
    const otpString = otp.join('');

    if (otpString.length !== 4) {
      setOtpError('Please enter a valid 4-digit OTP');
      return;
    }

    try {
      setIsVerifying(true);
      setOtpError('');
     
      // Get device information with fallback
      let deviceInfo = {};
      
      if (window.deviceManager) {
        try {
          // Ensure device manager is initialized
          if (!window.deviceManager.deviceUuid) {
            console.log('🔄 Device Manager not initialized, initializing now...');
            await window.deviceManager.init();
          }
          deviceInfo = window.deviceManager.getDeviceInfo();
          console.log('Device Manager Available:', true);
          console.log('Device Info:', deviceInfo);
        } catch (error) {
          console.warn('Device Manager initialization failed, using fallback:', error);
          deviceInfo = {
            deviceUuid: generateFallbackUUID(),
            deviceType: detectDeviceTypeFallback(),
            fingerprint: {
              platform: navigator.platform || 'unknown',
              screen: `${screen.width}x${screen.height}`,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
              language: navigator.language || 'unknown'
            }
          };
        }
      } else {
        console.log('Device Manager Not Available - using fallback');
        // Fallback: generate basic device info with proper device detection
        deviceInfo = {
          deviceUuid: generateFallbackUUID(),
          deviceType: detectDeviceTypeFallback(), // Proper device detection
          fingerprint: {
            platform: navigator.platform || 'unknown',
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
            language: navigator.language || 'unknown'
          }
        };
        console.log('Fallback Device Info:', deviceInfo);
      }

      if (typeof window === 'undefined' || !window.verifyOtp) {
        setOtpError('OTP service not available. Please refresh and try again.');
        setIsVerifying(false);
        return;
      }

      window.verifyOtp(
        otpString,
        async (widgetData) => {
          const msg91Token = widgetData && (widgetData.accessToken || widgetData.message);
          if (!msg91Token) {
            setOtpError('Verification failed. Please try again.');
            setIsVerifying(false);
            return;
          }

          try {
            const response = await fetch(`${API_BASE_URL}/api/auth/verify-msg91-token`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                accessToken: msg91Token,
                mobile: mobileNumber,
                device_uuid: deviceInfo.deviceUuid,
                device_type: deviceInfo.deviceType,
                fingerprint: deviceInfo.fingerprint
              })
            });
            const data = await response.json();

            if (response.ok) {
              // Use AuthContext login function with error handling
              if (login && typeof login === 'function') {
                const userData = data.user_info || { mobile: data.mobile || mobileNumber };
                console.log('🔐 Login (MSG91 widget): API returned user data:', userData);
                login(userData, data.access_token, data.refresh_token);
              } else if (typeof window !== 'undefined') {
                const userData = data.user_info || { mobile: data.mobile || mobileNumber };
                localStorage.setItem('token', data.access_token);
                localStorage.setItem('mobile', userData.mobile);
                localStorage.setItem('isIdentified', 'true');
                localStorage.setItem('userInfo', JSON.stringify(userData));
              }

              // Immediate redirect for instant navigation
              const isProfileComplete = checkProfileCompletionFromAPI(data);
              console.log('🔍 Profile completion check:', isProfileComplete);
              console.log('🔍 User data from API:', data.user_info);
              
              if (isProfileComplete) {
                console.log('✅ Profile complete - redirecting to dashboard');
                router.replace('/dashboard');
              } else {
                console.log('⚠️ Profile incomplete - redirecting to onboarding');
                router.replace('/onboarding');
              }
            } else {
              const errorMessage = data.detail || data.message || 'Invalid OTP. Please try again.';
              setOtpError(errorMessage);
            }
          } catch (error) {
            console.error('OTP verification error (MSG91 widget):', error);
            if (error.message && (error.message.includes('Failed to fetch') || error.message.includes('NetworkError'))) {
              setOtpError('Network error. Please check your connection and try again.');
            } else {
              setOtpError('An error occurred. Please try again.');
            }
          } finally {
            setIsVerifying(false);
          }
        },
        (err) => {
          console.error('verifyOtp error', err);
          if (err && (err.code === 703 || err.message === 'otp already verifed')) {
            // OTP already verified according to MSG91 - prevent further attempts
            setIsVerifying(false);

            // If we already have an auth token, user should be able to access dashboard
            if (token) {
              router.replace('/dashboard');
              return;
            }

            // Otherwise, reset OTP flow so user must request a fresh OTP
            setOtpError('OTP already used. Please request a new OTP to continue.');
            setIsOtpSent(false);
            setOtp(['', '', '', '']);
            setResendCooldown(0);
            setReqId(null);
            return;
          }
          setOtpError('Invalid OTP. Please try again.');
          setIsVerifying(false);
        },
        reqId
      );
    } catch (error) {
      console.error('OTP verification error (outer):', error);
      setOtpError('An error occurred. Please try again.');
      setIsVerifying(false);
    }
  }, [otp, mobileNumber, login, router, isExistingUser, reqId, detectDeviceTypeFallback]);

  // Optimized mobile number change handler
  const handleMobileChange = useCallback((e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(value);
    setOtpError();
  }, []);

  // Optimized change number handler
  const handleChangeNumber = useCallback(() => {
    setIsOtpSent(false);
    setOtp(['', '', '', '']);
    setOtpError('');
    setShowOtpAnimation(false);
    setOtpStatus(null);
    setOtpExpiryTime(null);
    setResendCooldown(0);
  }, []);

  // Resend OTP using MSG91 widget
  const handleResendOtp = useCallback(() => {
    if (resendCooldown > 0) {
      setOtpError(`Please wait ${resendCooldown} seconds before resending OTP`);
      return;
    }
    if (typeof window === 'undefined' || !window.retryOtp) {
      setOtpError('OTP service not available. Please refresh and try again.');
      return;
    }

    setResendCooldown(RESEND_COOLDOWN_SECONDS);

    window.retryOtp(
      '11',
      () => {},
      (err) => {
        console.error('retryOtp error', err);
        setOtpError('Could not resend OTP. Please try again.');
      },
      reqId
    );
  }, [reqId, resendCooldown]);

  // Memoized OTP input fields to prevent unnecessary re-renders
  const otpInputs = useMemo(() => {
    return otp.map((digit, index) => (
      <input
        key={index}
        id={`otp-${index}`}
        type="number"
        inputMode="numeric"
        pattern="[0-9]*"
        min="0"
        max="9"
        maxLength={1}
        value={digit}
        onChange={(e) => handleOtpChange(index, e.target.value)}
        onKeyDown={(e) => handleKeyDown(index, e)}
        onPaste={handlePaste}
        autoComplete="off"
        className={`${styles.otpInput} ${showOtpAnimation ? styles.otpInputBlink : ''}`}
      />
    ));
  }, [otp, handleOtpChange, handleKeyDown, handlePaste, showOtpAnimation]);

  return (
    <div className={`${styles.authBg} ${uiReady ? styles.ready : styles.preload}`}>
      {/* MSG91 OTP widget loader - exposes window.sendOtp/verifyOtp/retryOtp */}
      <Script
        id="msg91-otp-provider"
        src="https://verify.msg91.com/otp-provider.js"
        strategy="afterInteractive"
        onLoad={() => {
          try {
            if (typeof window === 'undefined' || typeof window.initSendOTP !== 'function') {
              return;
            }
            (async () => {
              try {
                const response = await fetch('/api/msg91-config');
                if (!response.ok) {
                  console.error('Failed to load MSG91 config', response.status);
                  return;
                }
                const config = await response.json();
                console.log('MSG91 widget config presence', {
                  hasWidgetId: !!config.widgetId,
                  hasTokenAuth: !!config.tokenAuth,
                });
                if (!config.widgetId || !config.tokenAuth) {
                  console.error('MSG91 widget config missing');
                  return;
                }
                const configuration = {
                  widgetId: config.widgetId,
                  tokenAuth: config.tokenAuth,
                  exposeMethods: true,
                  success: (data) => {
                    console.log('MSG91 widget success', data);
                  },
                  failure: (error) => {
                    console.error('MSG91 widget failure', error);
                  }
                };
                window.initSendOTP(configuration);
              } catch (e) {
                console.error('Failed to initialize MSG91 OTP widget', e);
              }
            })();
          } catch (e) {
            console.error('Failed to initialize MSG91 OTP widget', e);
          }
        }}
      />
      {showInstallCta && (
        <div className={styles.installCta}>
          <button onClick={handleInstallClick} className={styles.installBtn}>Install app</button>
        </div>
      )}
      <div className={styles.authLogo}>
        <img src="/assets/logo-name.png" alt="Logo" className={styles.logoIcon} width={150} height={48} />
      </div>
      
      <div className={`${styles.authCard} ${isOtpSent ? styles.verifyMode : ''}`}>
        {!isOtpSent ? (
          <>
            <h1>Sign In / Sign Up</h1>
            <p className={styles.subtitle}>Enter your mobile number to continue</p>
            <form onSubmit={handleSendOtp} className={styles.loginForm}>
              <div className={styles.loginFormContent}>
                <div className={styles.formGroup}>
                  <div className={styles.authInputGroup}>
                    <select className={styles.authCountry}>
                      <option value="+91">+91</option>
                    </select>
                    <input
                      id="mobile"
                      type="tel"
                      className={styles.authInput}
                      placeholder="Enter mobile number"
                      maxLength={10}
                      value={mobileNumber}
                      onChange={handleMobileChange}
                    />
                  </div>
                  {otpError && <p className={styles.errorMessage}>{otpError}</p>}
                </div>
              </div>
              <div className={styles.loginButtonContainer}>
                <button
                  className={`${styles.authBtn} ${isValidNumber ? styles.authBtnActive : ''} ${isVerifying ? styles.authBtnLoading : ''}`}
                  type="submit"
                  disabled={!isValidNumber || isVerifying}
                >
                  {isVerifying && (
                    <span className={styles.btnSpinner} aria-label="Loading"></span>
                  )}
                  <span className={styles.authBtnText}>
                    {isVerifying ? 'SENDING...' : 'SEND OTP'}
                  </span>
                  {!isVerifying && (
                    <span className={styles.authBtnArrow}>→</span>
                  )}
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <h1>Enter OTP</h1>
            <p className={styles.subtitle}>
              OTP sent to +91 {mobileNumber}
            </p>
            {otpExpiryTime && (
              <p className={styles.otpExpiry}>
                OTP expires in {Math.floor(otpExpiryTime / 60)}:{(otpExpiryTime % 60).toString().padStart(2, '0')}
              </p>
            )}
            <button
              onClick={handleChangeNumber}
              className={styles.changeNumber}
            >
              Change number
            </button>
            <form onSubmit={handleVerifyOtp} className={styles.loginForm}>
              <div className={styles.otpInputGroup}>
                {otpInputs}
              </div>
              {otpError && <p className={styles.errorMessage}>{otpError}</p>}
              <div className={styles.loginButtonContainer}>
                <button
                  className={`${styles.authBtn} ${isValidOtp ? styles.authBtnActive : ''} ${isVerifying ? styles.authBtnLoading : ''}`}
                  type="submit"
                  disabled={!isValidOtp || isVerifying}
                >
                  {isVerifying && (
                    <span className={styles.btnSpinner} aria-label="Loading"></span>
                  )}
                  <span className={styles.authBtnText}>
                    {isVerifying ? 'VERIFYING...' : 'VERIFY OTP'}
                  </span>
                  {!isVerifying && (
                    <span className={styles.authBtnArrow}>→</span>
                  )}
                </button>
              </div>
            </form>
            <button
              onClick={handleResendOtp}
              className={styles.resendOtp}
              disabled={isVerifying || resendCooldown > 0}
            >
              {resendCooldown > 0
                ? `Resend OTP in ${resendCooldown}s`
                : "Didn't receive OTP? Resend OTP"}
            </button>
          </>
        )}
        <p className={styles.authTerms}>
          By signing in you agree to our <span className={styles.termsLink} onClick={() => setShowTerms(true)}>terms and conditions</span>
        </p>
      </div>
      
      <p className={styles.authFooter}>
        Don&apos;t have an account? No worries! <span className={styles.createLink}>We&apos;ll create one for you automatically.</span>
      </p>

      {/* Terms and Conditions Popup */}
      {showTerms && (
        <div className={styles.termsOverlay} onClick={() => setShowTerms(false)}>
          <div className={styles.termsPopup} onClick={(e) => e.stopPropagation()}>
            <div className={styles.termsHeader}>
              <h2>TERMS AND CONDITIONS</h2>
              <button 
                className={styles.termsCloseBtn}
                onClick={() => setShowTerms(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.termsContent}>
              <h3>Durranis - AI-Based Learning Platform for Students</h3>
              <p><strong>Last Updated: July 20, 2025</strong></p>
              
              <h4>1. ACCEPTANCE OF TERMS</h4>
              <p>These Terms and Conditions ("Terms") constitute a legally binding agreement between you ("User," "Student," "you," or "your") and Techways AI Technologies Pvt Ltd ("Company," "we," "us," or "our"), a company incorporated under the Companies Act, 2013, regarding your use of the Durranis platform ("Platform," "Service," or "Application").</p>
              <p>By accessing, downloading, installing, or using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms. If you do not agree to these Terms, you must not access or use the Platform.</p>
              <p>These Terms comply with the Information Technology Act, 2000, Consumer Protection Act, 2019, Indian Contract Act, 1872, and other applicable Indian laws.</p>

              <h4>2. DESCRIPTION OF SERVICE</h4>
              <h5>2.1 Platform Overview</h5>
              <p>Durranis is an AI-powered educational platform designed for students across various disciplines, offering:</p>
              <ul>
                <li>AI Tutor: Personalized artificial intelligence-based tutoring and guidance</li>
                <li>Adaptive Learning: Customized learning paths based on individual progress and performance</li>
                <li>Gamification: Interactive learning experiences with rewards, badges, and progress tracking</li>
                <li>Video Content: Educational videos, lectures, and multimedia learning materials</li>
                <li>Exam Preparation: Comprehensive tools for entrance exams, board exams, competitive exams, and professional certifications</li>
                <li>Progress Analytics: Detailed performance tracking and learning insights across all subjects</li>
                <li>Interactive Assessments: Quizzes, mock tests, and practice examinations for various disciplines</li>
                <li>Study Materials: Curated content for multiple educational fields and professional courses</li>
              </ul>

              <h5>2.2 Target Audience</h5>
              <p>This Platform is designed for:</p>
              <ul>
                <li>Students pursuing undergraduate and postgraduate courses across various disciplines</li>
                <li>Students preparing for entrance exams and competitive examinations</li>
                <li>Professional course aspirants (medical, engineering, pharmacy, law, management, etc.)</li>
                <li>Working professionals seeking continuing education and skill development</li>
                <li>Educators and academic professionals</li>
              </ul>

              <h4>3. ELIGIBILITY AND REGISTRATION</h4>
              <h5>3.1 Eligibility Criteria</h5>
              <p>To use this Platform, you must:</p>
              <ul>
                <li>Be at least 13 years of age (users under 16 require parental consent)</li>
                <li>Have legal capacity to enter into binding contracts under Indian law</li>
                <li>Provide accurate and complete registration information</li>
                <li>Comply with all applicable laws and regulations</li>
              </ul>

              <h4>4. SUBSCRIPTION PLANS AND PAYMENT TERMS</h4>
              <h5>4.1 Subscription Models</h5>
              <p>We offer various subscription plans including:</p>
              <ul>
                <li>Free tier with limited features and trial access</li>
                <li>Monthly premium subscriptions</li>
                <li>Annual premium subscriptions</li>
                <li>Institutional subscriptions</li>
                <li>Custom enterprise plans</li>
              </ul>

              <h5>4.2 Payment Terms and Refund Policy</h5>
              <p><strong>Payment:</strong></p>
              <ul>
                <li>All fees are stated in Indian Rupees (INR) and include applicable taxes</li>
                <li>Subscription fees are billed in advance on a recurring basis</li>
                <li>Payment processing is handled by authorized third-party payment processors</li>
                <li>We reserve the right to modify pricing with reasonable notice</li>
              </ul>
              <p><strong>Refund Policy:</strong></p>
              <ul>
                <li>No Refunds: Once you gain access to premium content, all fees are non-refundable</li>
                <li>Free Trial Protection: We provide free trials to help you evaluate the platform before purchase</li>
                <li>Technical Refunds Only: Refunds may be provided solely for technical issues preventing platform access, subject to our investigation</li>
                <li>No Change of Mind Refunds: Refunds are not provided for change of preference, course completion, or similar personal reasons</li>
                <li>Consumer Rights: This policy is subject to mandatory consumer protection rights under Indian law</li>
              </ul>

              <h4>5. PLATFORM USAGE RULES</h4>
              <h5>5.1 Permitted Use</h5>
              <p>You may use the Platform to:</p>
              <ul>
                <li>Access educational content and learning materials across various subjects</li>
                <li>Participate in interactive learning activities for multiple disciplines</li>
                <li>Track your educational progress across different courses</li>
                <li>Prepare for various entrance exams and competitive examinations</li>
                <li>Engage with AI tutoring features for personalized learning</li>
              </ul>

              <h5>5.2 Prohibited Activities</h5>
              <p>You must not:</p>
              <ul>
                <li>Violate any applicable laws or regulations</li>
                <li>Share your account credentials with others</li>
                <li>Attempt to reverse engineer, modify, or hack the Platform</li>
                <li>Upload malicious code, viruses, or harmful content</li>
                <li>Engage in cheating or academic dishonesty</li>
                <li>Use automated tools to access the Platform without authorization</li>
                <li>Collect or harvest user information without consent</li>
                <li>Interfere with Platform operations or security</li>
                <li>Violate intellectual property rights</li>
                <li>Use the Platform for unauthorized commercial purposes</li>
                <li>Create fake accounts or impersonate others</li>
              </ul>

              <h4>6. INTELLECTUAL PROPERTY RIGHTS</h4>
              <h5>6.1 Our Content</h5>
              <p>All content on the Platform, including but not limited to:</p>
              <ul>
                <li>Text, graphics, images, videos, and audio content</li>
                <li>Software, algorithms, and AI models</li>
                <li>Course materials and educational content</li>
                <li>Platform design and user interface</li>
                <li>Trademarks, service marks, and logos</li>
              </ul>
              <p>Is owned by or licensed to Techways AI Technologies Pvt Ltd and protected by Indian and international copyright, trademark, and intellectual property laws.</p>

              <h4>7. AI AND ALGORITHMIC SERVICES</h4>
              <h5>7.1 AI Tutor Functionality</h5>
              <ul>
                <li>Our AI tutor provides educational guidance based on machine learning algorithms</li>
                <li>AI responses are generated automatically and may not always be accurate or complete</li>
                <li>AI tutoring supplements but does not replace human instruction and professional guidance</li>
                <li>We continuously improve AI accuracy but cannot guarantee error-free responses</li>
                <li>AI recommendations should be verified through authoritative sources and qualified professionals</li>
              </ul>

              <h4>8. PRIVACY AND DATA PROTECTION</h4>
              <p>Your privacy is important to us. Our collection, use, and protection of your personal information is governed by our Privacy Policy, which is incorporated into these Terms by reference.</p>

              <h4>9. DISCLAIMERS AND LIMITATIONS OF LIABILITY</h4>
              <h5>9.1 Disclaimer of Warranties</h5>
              <p>TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
              <ul>
                <li>The Platform is provided "AS IS" without warranties of any kind</li>
                <li>We disclaim all express and implied warranties</li>
                <li>We do not warrant that the Platform will be error-free or uninterrupted</li>
              </ul>

              <h4>10. CONTACT INFORMATION</h4>
              <p>For questions about these Terms or the Platform:</p>
              <p><strong>Company:</strong> Techways AI Technologies Pvt Ltd<br/>
              <strong>Product:</strong> Durranis AI Learning Platform<br/>
              <strong>Email:</strong> legal@durranis.com<br/>
              <strong>Grievance Officer:</strong> Gaurav Agarwal<br/>
              <strong>Email:</strong> grievance@teachwaysai.com</p>

              <h4>11. ACKNOWLEDGMENT</h4>
              <p>By using the Durranis Platform, you acknowledge that:</p>
              <ul>
                <li>You have read and understood these Terms</li>
                <li>You agree to be legally bound by these Terms</li>
                <li>You have used our free trial to evaluate the platform</li>
                <li>You understand our no-refund policy for accessed content</li>
              </ul>
              <p>These Terms and Conditions are governed by Indian law and are subject to the exclusive jurisdiction of Indian courts.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
 
export default Login;
 

