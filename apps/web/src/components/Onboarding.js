    "use client";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import styles from './Onboarding.module.css';
import { performanceAPI, studyPlanAPI } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { API_CONFIG } from '../config/api';

function WelcomeScreen({ onContinue, currentStep = 0, onBack, showBackButton = false }) {
    const { user } = useAuth();
    const [isVisible, setIsVisible] = useState(false);
    const [internalStep, setInternalStep] = useState(0);
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedSemester, setSelectedSemester] = useState('');
    const [showPersonalInfo, setShowPersonalInfo] = useState(false);
    const [isSavingYearSemester, setIsSavingYearSemester] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        gender: '',
        collegeName: '',
        university: '',
        examDate: ''
    });
    const UNIVERSITY_OPTIONS = ['PCI', 'JNTHU', 'OU'];
    const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);
    const [showSuccessMessage, setShowSuccessMessage] = useState(false);
    const [validationErrors, setValidationErrors] = useState({});
    const [showValidationErrors, setShowValidationErrors] = useState(false);
    const [isGeneratingStudyPlan, setIsGeneratingStudyPlan] = useState(false);
    const [studyPlanError, setStudyPlanError] = useState(null);
    const [showActivationTour, setShowActivationTour] = useState(false);
    const [tourStep, setTourStep] = useState(0);
    const tourTimerRef = useRef(null);
    const [hasTourShownForStep, setHasTourShownForStep] = useState({});
    const [isTourOverlayVisible, setIsTourOverlayVisible] = useState(false);
    const [hasYearSemesterTourBeenShown, setHasYearSemesterTourBeenShown] = useState(false);
    const [hasStudyPreferencesTourShown, setHasStudyPreferencesTourShown] = useState(false);
    const [hasInteractedWithExamDate, setHasInteractedWithExamDate] = useState(false);
    const examDateInputRef = useRef(null);
    const examDateAutoOpenAttempted = useRef(false);
    const [isCompactTourViewport, setIsCompactTourViewport] = useState(false);

    const buildDeviceHeaders = () => {
        const headers = {};
        if (typeof window === 'undefined') {
            return headers;
        }
        try {
            if (window.deviceManager && typeof window.deviceManager.getDeviceInfo === 'function') {
                const deviceInfo = window.deviceManager.getDeviceInfo();
                if (deviceInfo?.deviceUuid) {
                    headers['X-Device-UUID'] = deviceInfo.deviceUuid;
                }
                if (deviceInfo?.deviceType) {
                    headers['X-Device-Type'] = deviceInfo.deviceType;
                }
                if (deviceInfo?.fingerprint) {
                    headers['X-Device-Fingerprint'] = JSON.stringify(deviceInfo.fingerprint);
                }
            }
        } catch (error) {
            console.error('Failed to build device headers for profile update:', error);
        }
        return headers;
    };

    const callProfileUpdateWithDevice = async (body) => {
        if (typeof window === 'undefined') {
            throw new Error('Window is not available');
        }

        const token = localStorage.getItem('token');
        if (!token) {
            throw new Error('No authentication token found. Please login again.');
        }

        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            ...buildDeviceHeaders(),
        };

        const response = await fetch(
            `${API_CONFIG.BASE_URL}${API_CONFIG.ENDPOINTS.PROFILE.UPDATE}`,
            {
                method: 'PUT',
                headers,
                body: JSON.stringify(body),
            },
        );

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            throw new Error(`Profile update failed with status ${response.status}: ${text || response.statusText}`);
        }

        return response.json();
    };

    const renderLoadingContent = (label) => (
        <span className={styles.buttonLoadingContent}>
            <span className={styles.buttonLoader}></span>
            <span>{label}</span>
        </span>
    );

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            setIsCompactTourViewport(window.innerWidth <= 480);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        // Trigger fade-in animation
        const timer = setTimeout(() => setIsVisible(true), 100);
        return () => clearTimeout(timer);
    }, []);

    // Fetch existing exam date from MySchedule when user is available
    useEffect(() => {
        const fetchExistingExamDate = async () => {
            if (!user) return;
            
            try {
                console.log('🔍 Checking for existing study plan...');
                const planStatus = await studyPlanAPI.hasPlan();
                
                if (planStatus.has_active_plan) {
                    console.log('✅ Found existing study plan, loading exam date...');
                    const currentPlan = await studyPlanAPI.getCurrent();
                    setFormData(prev => ({
                        ...prev,
                        examDate: currentPlan.exam_date
                    }));
                    console.log('📅 Loaded existing exam date:', currentPlan.exam_date);
                } else if (planStatus.current_exam_date) {
                    console.log('📅 Found exam date from previous plan:', planStatus.current_exam_date);
                    setFormData(prev => ({
                        ...prev,
                        examDate: planStatus.current_exam_date
                    }));
                } else {
                    console.log('ℹ️ No existing study plan found');
                }
            } catch (error) {
                console.log('ℹ️ No existing study plan or error fetching:', error.message);
                // This is expected for new users, so we don't show error
            }
        };

        fetchExistingExamDate();
    }, [user]);

    useEffect(() => {
        setInternalStep(currentStep);
    }, [currentStep]);

    useEffect(() => {
        if (internalStep === 3) {
            setShowPersonalInfo(true);
        }
        if (internalStep < 3 || internalStep === 4) {
            setShowPersonalInfo(false);
        }
    }, [internalStep]);

    // Auto-populate mobile number from localStorage when component mounts
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const storedMobile = localStorage.getItem('mobile');
            if (storedMobile) {
                setFormData(prev => ({
                    ...prev,
                    phone: storedMobile
                }));
                console.log('📱 Auto-populated mobile number from login:', storedMobile);
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const hasSeenTour = localStorage.getItem('onboardingActivationTourSeen');

        if (tourTimerRef.current) {
            clearTimeout(tourTimerRef.current);
            tourTimerRef.current = null;
        }

        const isStudyPreferencesStep = internalStep === 4;

        if (internalStep <= 1) {
            setShowActivationTour(false);
            setIsTourOverlayVisible(false);

            tourTimerRef.current = setTimeout(() => {
                setHasTourShownForStep(prev => ({
                    ...prev,
                    [internalStep]: true
                }));
                setShowActivationTour(true);
                setIsTourOverlayVisible(true);
                tourTimerRef.current = null;
            }, 2000);
        } else if (internalStep === 2) {
            setShowActivationTour(false);
            setIsTourOverlayVisible(false);
        } else if (isStudyPreferencesStep && !hasStudyPreferencesTourShown) {
            setShowActivationTour(false);
            setIsTourOverlayVisible(false);
            tourTimerRef.current = setTimeout(() => {
                setTourStep(5);
                setShowActivationTour(true);
                setIsTourOverlayVisible(true);
                setHasStudyPreferencesTourShown(true);
                tourTimerRef.current = null;
            }, 2000);
        } else {
            setShowActivationTour(false);
            if (hasSeenTour) {
                setIsTourOverlayVisible(false);
            } else {
                localStorage.setItem('onboardingActivationTourSeen', 'true');
            }
        }

        return () => {
            if (tourTimerRef.current) {
                clearTimeout(tourTimerRef.current);
                tourTimerRef.current = null;
            }
        };
    }, [internalStep, hasStudyPreferencesTourShown]);

    useEffect(() => {
        if (internalStep !== 4) {
            setHasStudyPreferencesTourShown(false);
        }
    }, [internalStep]);

    useEffect(() => {
        if (!showActivationTour) return;
        const isStudyPreferencesStep = internalStep === 4;
        if (internalStep <= 2) {
            setTourStep(internalStep);
        } else if (isStudyPreferencesStep) {
            setTourStep(5);
        } else {
            setShowActivationTour(false);
            if (typeof window !== 'undefined') {
                localStorage.setItem('onboardingActivationTourSeen', 'true');
            }
        }
    }, [internalStep, showActivationTour]);

    useEffect(() => {
        if (internalStep !== 2) {
            setHasYearSemesterTourBeenShown(false);
            return;
        }

        if (!selectedYear || !selectedSemester) {
            setShowActivationTour(false);
            setIsTourOverlayVisible(false);
            setHasYearSemesterTourBeenShown(false);
            return;
        }

        if (hasYearSemesterTourBeenShown) {
            return;
        }

        const timer = setTimeout(() => {
            setTourStep(2);
            setShowActivationTour(true);
            setIsTourOverlayVisible(true);
            setHasYearSemesterTourBeenShown(true);
        }, 2000);

        return () => clearTimeout(timer);
    }, [internalStep, selectedYear, selectedSemester, hasYearSemesterTourBeenShown]);

    // Prevent browser navigation away from onboarding
    useEffect(() => {
        const handlePopState = (event) => {
            // Prevent navigation away from onboarding
            event.preventDefault();
            window.history.pushState(null, '', window.location.pathname);
        };

        // Push current state to prevent back navigation
        window.history.pushState(null, '', window.location.pathname);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    // Timer logic removed - no time limit for assessment

    const progressPercentage = ((internalStep + 1) / 5) * 100;

    const tourSteps = [
        {
            title: 'Start your journey',
            description: 'Click Continue to begin your personalized onboarding experience.'
        },
        {
            title: 'Keep the momentum',
            description: "Tap Continue to see how Durrani's keeps you smarter every day."
        },
        {
            title: 'Tell us about your course',
            description: 'Choose your Year and Semester, then press Continue to save them.'
        }
    ];

    const yearSemesterTourSteps = [
        {
            title: 'Select your current year',
            description: 'Pick the year that matches where you are in your course to unlock the right subjects.'
        },
        {
            title: 'Select your semester',
            description: 'Choose the semester you are studying right now so we can tailor the content.'
        },
        {
            title: 'Ready when you are',
            description: 'Hit Continue to save your selections and move to the next step.'
        }
    ];

    const handleSkipTour = () => {
        setShowActivationTour(false);
        setHasTourShownForStep(prev => ({
            ...prev,
            [tourStep]: true
        }));
        setIsTourOverlayVisible(false);
        if (tourTimerRef.current) {
            clearTimeout(tourTimerRef.current);
            tourTimerRef.current = null;
        }
        if (typeof window !== 'undefined') {
            localStorage.setItem('onboardingActivationTourSeen', 'true');
        }
    };

    const isYearSemesterStep = internalStep === 2;
    const allowYearSemesterTour = isYearSemesterStep && selectedYear && selectedSemester && hasYearSemesterTourBeenShown;
    const highlightYearGrid = isYearSemesterStep && !selectedYear;
    const highlightSemesterContainer = isYearSemesterStep && selectedYear && !selectedSemester;
    const highlightContinueButton = isYearSemesterStep && selectedYear && selectedSemester;
    const yearSemesterTourIndex = highlightYearGrid ? 0 : highlightSemesterContainer ? 1 : highlightContinueButton ? 2 : null;

    const isStudyPreferencesTourStep = internalStep === 4;
    const baseTour = (internalStep <= 2 && (!isYearSemesterStep || allowYearSemesterTour))
        ? tourSteps[Math.min(tourStep, tourSteps.length - 1)]
        : null;
    const studyPreferencesTour = {
        title: 'Set your exam date',
        description: 'Enter your exam date so we can build a tailored study plan around it.'
    };
    const studyPreferencesButtonTour = {
        title: 'Complete your setup',
        description: 'Great! Now click Complete Setup to generate your personalized study plan.'
    };
    const activeTour = yearSemesterTourIndex !== null
        ? yearSemesterTourSteps[yearSemesterTourIndex]
        : (isStudyPreferencesTourStep
            ? (hasInteractedWithExamDate ? studyPreferencesButtonTour : studyPreferencesTour)
            : baseTour);
    const overlayVisible = yearSemesterTourIndex !== null || isTourOverlayVisible || isStudyPreferencesTourStep;
    const guidedFocusActive = yearSemesterTourIndex !== null;
    const shouldShowTour = Boolean(activeTour) && (yearSemesterTourIndex !== null || showActivationTour || isStudyPreferencesTourStep);
    const tourPositionClass = isYearSemesterStep
        ? (yearSemesterTourIndex === 0
            ? styles.tourContentYear
            : yearSemesterTourIndex === 1
                ? styles.tourContentSemester
                : styles.tourContentContinue)
        : (isStudyPreferencesTourStep
            ? (hasInteractedWithExamDate ? styles.tourContentContinue : styles.tourContentStudyPreferences)
            : styles.tourContentContinue);

    const tourArrowPath = (() => {
        if (yearSemesterTourIndex === 0) {
            return 'M168 24 C 156 60, 142 96, 126 128 C 116 150, 108 158, 96 154';
        }

        if (yearSemesterTourIndex === 1) {
            return isCompactTourViewport
                ? 'M88 18 C 88 38, 92 54, 94 72 C 96 82, 96 90, 96 102'
                : 'M126 14 C 114 56, 106 100, 112 134 C 116 150, 110 164, 96 168';
        }

        if (yearSemesterTourIndex === 2) {
            return 'M58 10 C 94 42, 70 90, 110 120 S 140 150, 150 168';
        }

        if (isStudyPreferencesTourStep) {
            if (hasInteractedWithExamDate) {
                return isCompactTourViewport
                    ? 'M78 16 C 78 28, 80 42, 84 58 C 86 68, 88 78, 88 88'
                    : 'M58 10 C 90 34, 38 60, 74 92 S 114 132, 130 156';
            }

            return isCompactTourViewport
                ? 'M86 18 C 86 32, 88 46, 92 60 C 94 70, 96 78, 96 88'
                : 'M86 18 C 84 32, 82 50, 82 66 C 82 74, 86 82, 90 88';
        }

        return 'M58 10 C 90 34, 38 60, 74 92 S 114 132, 130 156';
    })();
    const tourDashPattern = yearSemesterTourIndex === 0
        ? '14 10'
        : yearSemesterTourIndex === 1
            ? (isCompactTourViewport ? '4 8' : '8 8')
        : (isStudyPreferencesTourStep ? (hasInteractedWithExamDate ? '4 10' : '4 12') : '4 10');
    const tourDashOffset = yearSemesterTourIndex === 1
        ? (isCompactTourViewport ? 2 : 4)
        : yearSemesterTourIndex === 2
            ? 2
            : isStudyPreferencesTourStep
                ? (hasInteractedWithExamDate ? 0 : 1)
                : 0;

    const highlightExamDateContainer = isStudyPreferencesTourStep && !hasInteractedWithExamDate;
    const highlightStudyPreferencesButton = isStudyPreferencesTourStep && hasInteractedWithExamDate && Boolean(formData.examDate);
    const shouldHighlightContinueButton = highlightContinueButton || (!isYearSemesterStep && shouldShowTour && !isStudyPreferencesTourStep) || highlightStudyPreferencesButton;

    const handleContinue = async () => {
        // If user is on step 2 (year/semester selection), store the data in database
        if (internalStep === 2 && selectedYear && selectedSemester) {
            setHasYearSemesterTourBeenShown(true);
            setIsSavingYearSemester(true);
            try {
                // Convert year selection to numeric format
                const yearMap = {
                    'I Year': 1,
                    'II Year': 2,
                    'III Year': 3,
                    'IV Year': 4
                };
                
                const semesterMap = {
                    'Semester 1': 1,
                    'Semester 2': 2
                };
                
                const year = yearMap[selectedYear];
                const semester = semesterMap[selectedSemester];
                
                console.log('Storing user year and semester:', { year, semester });
                
                // Call the profile update API to store year and semester
                const response = await callProfileUpdateWithDevice({
                    year: year,
                    semester: semester
                });
                
                console.log('Successfully stored year and semester in database');
                console.log('Profile update response:', response);
                
                // Clear cache to ensure fresh data is fetched
                performanceAPI.clearCache('/api/profile/');
                performanceAPI.clearCache('/api/dashboard-');
                performanceAPI.clearCache('/api/current-course');
                
                // Store in localStorage as well for immediate access
                if (typeof window !== 'undefined') {
                    localStorage.setItem('userYear', year.toString());
                    localStorage.setItem('userSemester', semester.toString());
                    localStorage.setItem('userYearSem', `${year}-${semester}`);
                    
                    // Also store the full user data if available
                    if (response && response.user) {
                        localStorage.setItem('userData', JSON.stringify({
                            year: response.user.year,
                            semester: response.user.semester,
                            name: response.user.name,
                            email: response.user.email,
                            college_name: response.user.college_name,
                            university: response.user.university
                        }));
                    }
                }
                
            } catch (error) {
                console.error('Failed to store year and semester:', error);
                // Continue with onboarding even if API call fails
            } finally {
                setIsSavingYearSemester(false);
            }
        }
        
        if (internalStep === 2) {
            setShowActivationTour(false);
            setIsTourOverlayVisible(false);
            setShowPersonalInfo(true);
            setInternalStep(3);
            return;
        }

        if (internalStep < 4) {
            setInternalStep(internalStep + 1);
        } else {
            onContinue();
        }
    };

    const handleBack = () => {
        if (showActivationTour && tourStep > 0) {
            setTourStep(tourStep - 1);
        }
        if (internalStep === 4) {
            // Special case: Going back from Study Preferences to Personal Info
            handleStudyPreferencesBack();
        } else if (internalStep === 3) {
            setShowPersonalInfo(false);
            setInternalStep(2);
        } else if (internalStep > 0) {
            setInternalStep(internalStep - 1);
        } else {
            // Prevent going back from first step - user must complete onboarding
            if (confirm('Are you sure you want to go back to login? You will need to complete your profile to access the app.')) {
                onBack();
            }
        }
    };

    const handleYearSelect = (year) => {
        setSelectedYear(year);
        setSelectedSemester(''); // Reset semester when year changes
        if (tourTimerRef.current) {
            clearTimeout(tourTimerRef.current);
            tourTimerRef.current = null;
        }
        setShowActivationTour(false);
        setIsTourOverlayVisible(false);
    };

    const handleSemesterSelect = (semester) => {
        setSelectedSemester(semester);
        if (tourTimerRef.current) {
            clearTimeout(tourTimerRef.current);
            tourTimerRef.current = null;
        }
        setShowActivationTour(false);
        setIsTourOverlayVisible(false);
    };

    const triggerExamDatePicker = useCallback(() => {
        const input = examDateInputRef.current;
        if (!input) return;

        if (typeof input.focus === 'function') {
            input.focus({ preventScroll: true });
        }

        if (typeof input.showPicker === 'function') {
            try {
                input.showPicker();
                return;
            } catch (err) {
                console.log('showPicker not supported:', err?.message);
            }
        }

        if (typeof input.click === 'function') {
            input.click();
        }
    }, []);

    const handleFormChange = (field, value) => {
        console.log(`📝 Form change: ${field} = "${value}"`);
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        if (field === 'examDate') {
            setHasInteractedWithExamDate(Boolean(value));
        }
        
        // Clear validation error for this field when user starts typing
        if (validationErrors[field]) {
            console.log(`🧹 Clearing validation error for ${field}`);
            setValidationErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const validateForm = () => {
        const errors = {};
        
        if (!formData.firstName.trim()) {
            errors.firstName = 'First name is required';
        }
        
        if (!formData.lastName.trim()) {
            errors.lastName = 'Last name is required';
        }
        
        if (!formData.email.trim()) {
            errors.email = 'Email address is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            errors.email = 'Please enter a valid email address';
        }
        
        // Phone number validation removed - it's auto-populated and read-only
        // if (!formData.phone.trim()) {
        //     errors.phone = 'Phone number is required';
        // } else if (!/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
        //     errors.phone = 'Please enter a valid 10-digit phone number';
        // }
        
        if (!formData.gender) {
            errors.gender = 'Please select your gender';
        }
        
        if (!formData.collegeName.trim()) {
            errors.collegeName = 'College name is required';
        }
        
        if (!formData.university.trim() || !UNIVERSITY_OPTIONS.includes(formData.university)) {
            errors.university = 'Please select a university';
        }
        
        return errors;
    };

    const handleStudyPreferencesBack = () => {
        console.log('🔙 Going back from Study Preferences to Personal Info');
        setInternalStep(3); // Go back to personal info step
        setShowPersonalInfo(true); // Show personal info form
        setHasInteractedWithExamDate(false);
        examDateAutoOpenAttempted.current = false;
    };

    useEffect(() => {
        if (internalStep === 4 && !hasInteractedWithExamDate && !examDateAutoOpenAttempted.current) {
            examDateAutoOpenAttempted.current = true;
            const timer = setTimeout(() => {
                triggerExamDatePicker();
            }, 350);

            return () => clearTimeout(timer);
        }

        if (internalStep !== 4) {
            examDateAutoOpenAttempted.current = false;
        }
    }, [internalStep, hasInteractedWithExamDate, triggerExamDatePicker]);

    const handleStudyPreferencesContinue = async () => {
        console.log('🚀 handleStudyPreferencesContinue called');
        
        // Validate study preferences
        const errors = {};
        
        if (!formData.examDate.trim()) {
            errors.examDate = 'Exam date is required';
        }
        
        if (Object.keys(errors).length > 0) {
            setValidationErrors(errors);
            setShowValidationErrors(true);
            return;
        }
        
        // Clear validation errors
        setValidationErrors({});
        setShowValidationErrors(false);
        setStudyPlanError(null);
        
        // Generate study plan and goals using MySchedule API
        setIsGeneratingStudyPlan(true);
        
        try {
            console.log('🎯 Generating study plan with exam date:', formData.examDate);
            console.log('👤 User year/semester:', user?.year, user?.semester);
            
            // Generate study plan using the same API as MySchedule
            const studyPlan = await studyPlanAPI.generate({
                examDate: formData.examDate,
                year: user?.year,
                semester: user?.semester
            });
            
            console.log('✅ Study plan generated successfully:', {
                examDate: studyPlan.exam_date,
                daysRemaining: studyPlan.days_remaining,
                totalTasks: studyPlan.daily?.length || 0
            });
            
            // Store study preferences in localStorage
            if (typeof window !== 'undefined') {
                localStorage.setItem('examDate', formData.examDate);
                localStorage.setItem('studyPreferencesComplete', 'true');
                localStorage.setItem('studyPlanGenerated', 'true');
            }
            
            // Notify other components that study plan has been generated
            window.dispatchEvent(new CustomEvent('study-plan-updated', {
                detail: { 
                    action: 'plan-generated', 
                    examDate: formData.examDate,
                    timestamp: new Date().toISOString()
                }
            }));
            
            console.log('🎉 Study plan and goals generated successfully!');
            
            // Set flag to show tours when user arrives at dashboard (first time after onboarding)
            if (typeof window !== 'undefined') {
                localStorage.setItem('onboarding-just-completed', 'true');
                localStorage.setItem('show-dashboard-tour', 'true');
                localStorage.setItem('show-smart-coach-tour', 'true');
                console.log('✅ Onboarding completion flags set for tours');
            }
            
            // Complete onboarding and go to dashboard
            onContinue();
            
        } catch (error) {
            console.error('❌ Failed to generate study plan:', error);
            setStudyPlanError(error.message || 'Failed to generate study plan. Please try again.');
            setIsGeneratingStudyPlan(false);
        }
    };

    const handlePersonalInfoContinue = async () => {
        console.log('🚀 handlePersonalInfoContinue called');
        console.log('📝 Form data:', formData);
        
        // Validate form
        const errors = validateForm();
        console.log('🔍 Validation errors:', errors);
        console.log('🔍 Number of errors:', Object.keys(errors).length);
        
        if (Object.keys(errors).length > 0) {
            console.log('❌ Form validation failed:', errors);
            setValidationErrors(errors);
            setShowValidationErrors(true);
            console.log('🚨 Validation errors set, should show red borders and error messages');
            return;
        }
        
        // Clear any previous validation errors
        setValidationErrors({});
        setShowValidationErrors(false);
        
        console.log('✅ Form validation passed');
        setIsSubmittingProfile(true);
        
        try {
            // Store personal information in database
            const fullName = `${formData.firstName} ${formData.lastName}`;
            
            console.log('📊 Storing personal information:', {
                name: fullName,
                email: formData.email,
                gender: formData.gender,
                college_name: formData.collegeName,
                university: formData.university
            });
            
            // Check if we have a valid token
            const token = localStorage.getItem('token');
            console.log('🔑 Token from localStorage:', token ? `${token.substring(0, 20)}...` : 'NO TOKEN FOUND');
            
            if (!token) {
                throw new Error('No authentication token found. Please login again.');
            }
            
            console.log('🌐 Making API call to /api/profile/update with device info...');
            const response = await callProfileUpdateWithDevice({
                name: fullName,
                email: formData.email,
                gender: formData.gender,
                college_name: formData.collegeName,
                university: formData.university
            });
            
            console.log('✅ Successfully stored personal information in database');
            console.log('📦 Profile update response:', response);
            
            // Clear cache to ensure fresh data is fetched
            console.log('🧹 Clearing cache...');
            performanceAPI.clearCache('/api/profile/');
            performanceAPI.clearCache('/api/dashboard-');
            performanceAPI.clearCache('/api/current-course');
            
            // Store in localStorage as well
            if (typeof window !== 'undefined') {
                const userDataToStore = {
                    name: fullName,
                    email: formData.email,
                    gender: formData.gender,
                    college_name: formData.collegeName,
                    university: formData.university,
                    year: response?.user?.year,
                    semester: response?.user?.semester
                };
                console.log('💾 Storing in localStorage:', userDataToStore);
                localStorage.setItem('userData', JSON.stringify(userDataToStore));
            }
            
        } catch (error) {
            console.error('❌ Failed to store personal information:', error);
            console.error('🔍 Error details:', {
                message: error.message,
                status: error.status,
                response: error.response,
                stack: error.stack
            });
            alert(`Failed to save your information: ${error.message || 'Unknown error'}. Please try again.`);
            setIsSubmittingProfile(false);
            return;
        } finally {
            setIsSubmittingProfile(false);
        }
        
        // Go to Study Preferences step after profile completion
        console.log('✅ Profile data saved successfully, going to study preferences step...');
        setShowPersonalInfo(false); // Hide personal info form
        setInternalStep(4); // Step 5 (0-indexed)
    };


    return (
        <div className={`${styles.welcomeContainer} ${isVisible ? styles.fadeIn : ''}`}>
            <div className={styles.progressBarContainer}>
                <div className={styles.progressBar}>
                    <div 
                        className={styles.progressFill}
                        style={{ width: `${progressPercentage}%` }}
                    />
                </div>
            </div>

            <div className={styles.horizontalLine}></div>

            <div className={styles.header}>
                <div className={styles.headerLeft}>
                    {(internalStep > 0 || showBackButton) && (
                        <button 
                            className={styles.backButton}
                            onClick={handleBack}
                            aria-label="Go back"
                        >
                        <svg className="lucide lucide-chevron-left h-4" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m15 18-6-6 6-6"/>
                        </svg>
                            Back
                        </button>
                    )}
                </div>
                
                <div className={styles.stepIndicator}>
                    Step {internalStep + 1} of 5
                </div>
            </div>
            
            {/* Main content */}
            <div className={`${styles.mainContent} ${showPersonalInfo ? styles.personalInfoScreen : ''} ${internalStep === 4 ? styles.studyPreferencesScreen : ''} ${guidedFocusActive ? styles.guidedFocusActive : ''}`}>
                {showPersonalInfo ? (
                    // Personal Information Screen
                    <>
                        {/* Personal Information Icon */}
                        <div className={styles.iconContainer}>
                            <div className={styles.personalInfoIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                            </div>
                        </div>

                        {/* Title and Subtitle */}
                        <h1 className={styles.mainTitle}>Personal Information</h1>
                        <p className={styles.subtitle}>Let's get to know you better</p>

                        {/* Form Fields */}
                        <div className={styles.formContainer}>
                            {/* First Row - Two Columns */}
                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>First Name *</label>
                                    <input 
                                        type="text" 
                                        className={`${styles.formInput} ${validationErrors.firstName ? styles.formInputError : ''}`}
                                        placeholder="First name"
                                        value={formData.firstName}
                                        onChange={(e) => handleFormChange('firstName', e.target.value)}
                                    />
                                    {validationErrors.firstName && (
                                        <div className={styles.errorMessage}>{validationErrors.firstName}</div>
                                    )}
                                </div>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>Last Name *</label>
                                    <input 
                                        type="text" 
                                        className={`${styles.formInput} ${validationErrors.lastName ? styles.formInputError : ''}`}
                                        placeholder="Last name"
                                        value={formData.lastName}
                                        onChange={(e) => handleFormChange('lastName', e.target.value)}
                                    />
                                    {validationErrors.lastName && (
                                        <div className={styles.errorMessage}>{validationErrors.lastName}</div>
                                    )}
                                </div>
                            </div>

                            {/* Email and Phone Fields - Side by Side */}
                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>Email Address *</label>
                                    <div className={styles.inputWithIcon}>
                                        <svg className={styles.inputIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                            <polyline points="22,6 12,13 2,6"/>
                                        </svg>
                                        <input 
                                            type="email" 
                                            className={`${styles.formInput} ${validationErrors.email ? styles.formInputError : ''}`}
                                            placeholder="your.email@example.com"
                                            value={formData.email}
                                            onChange={(e) => handleFormChange('email', e.target.value)}
                                            style={{ textAlign: 'left', textIndent: '0', direction: 'ltr' }}
                                        />
                                    </div>
                                    {validationErrors.email && (
                                        <div className={styles.errorMessage}>{validationErrors.email}</div>
                                    )}
                                </div>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>
                                        Phone Number *
                                    </label>
                                    <div className={styles.phoneNumberContainer}>
                                        <input 
                                            type="tel" 
                                            className={`${styles.formInput} ${styles.readonlyField} ${validationErrors.phone ? styles.formInputError : ''}`}
                                            placeholder="Phone number cannot be changed"
                                            value={formData.phone}
                                            readOnly={true}
                                            title="Phone number cannot be edited for security reasons"
                                            style={{ textAlign: 'left', textIndent: '0', direction: 'ltr' }}
                                        />
                                        <div className={styles.lockIcon} title="Phone number is locked and cannot be changed">
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6z" fill="currentColor"/>
                                            </svg>
                                        </div>
                                    </div>
                                    {validationErrors.phone && (
                                        <div className={styles.errorMessage}>{validationErrors.phone}</div>
                                    )}
                                </div>
                            </div>

                            {/* Gender Selection */}
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Gender *</label>
                                <div className={styles.genderButtons}>
                                    <button 
                                        className={`${styles.genderButton} ${formData.gender === 'male' ? styles.genderSelected : ''} ${validationErrors.gender ? styles.genderButtonError : ''}`}
                                        onClick={() => handleFormChange('gender', 'male')}
                                    >
                                        Male
                                    </button>
                                    <button 
                                        className={`${styles.genderButton} ${formData.gender === 'female' ? styles.genderSelected : ''} ${validationErrors.gender ? styles.genderButtonError : ''}`}
                                        onClick={() => handleFormChange('gender', 'female')}
                                    >
                                        Female
                                    </button>
                                </div>
                                {validationErrors.gender && (
                                    <div className={styles.errorMessage}>{validationErrors.gender}</div>
                                )}
                            </div>

                            {/* College Name and University Fields - Side by Side */}
                            <div className={styles.formRow}>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>College Name *</label>
                                    <input 
                                        type="text" 
                                        className={`${styles.formInput} ${validationErrors.collegeName ? styles.formInputError : ''}`}
                                        placeholder="Your college name"
                                        value={formData.collegeName}
                                        onChange={(e) => handleFormChange('collegeName', e.target.value)}
                                    />
                                    {validationErrors.collegeName && (
                                        <div className={styles.errorMessage}>{validationErrors.collegeName}</div>
                                    )}
                                </div>
                                <div className={styles.formField}>
                                    <label className={styles.fieldLabel}>University *</label>
                                    <select
                                        className={`${styles.formInput} ${validationErrors.university ? styles.formInputError : ''}`}
                                        value={formData.university}
                                        onChange={(e) => handleFormChange('university', e.target.value)}
                                    >
                                        <option value="">Select university</option>
                                        {UNIVERSITY_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {option}
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.university && (
                                        <div className={styles.errorMessage}>{validationErrors.university}</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                ) : internalStep === 4 ? (
                    // Study Preferences Screen (Step 5)
                    <>
                        {/* Study Preferences Icon */}
                        <div className={styles.iconContainer}>
                            <div className={styles.studyPreferencesIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                                    <line x1="16" x2="16" y1="2" y2="6"/>
                                    <line x1="8" x2="8" y1="2" y2="6"/>
                                    <line x1="3" x2="21" y1="10" y2="10"/>
                                </svg>
                            </div>
                        </div>

                        {/* Title and Subtitle */}
                        <h1 className={styles.mainTitle}>Study Preferences</h1>
                        <p className={styles.subtitle}>Help us create your personalized study schedule</p>

                        {/* Form Fields */}
                        <div className={styles.formContainer}>
                            {/* Exam Date Field */}
                            <div className={styles.formField}>
                                <label className={styles.fieldLabel}>Exam Date *</label>
                                <div
                                    className={`${styles.dateInputContainer} ${highlightExamDateContainer ? styles.studyPreferencesHighlight : ''}`}
                                    onClick={triggerExamDatePicker}
                                    onTouchEnd={triggerExamDatePicker}
                                >

                                    <div className={styles.dateInputWrapper}>
                                        <input
                                            ref={examDateInputRef}
                                            type="date"
                                            className={`${styles.dateInput} ${validationErrors.examDate ? styles.formInputError : ''}`}
                                            value={formData.examDate}
                                            onChange={(e) => handleFormChange('examDate', e.target.value)}
                                            onFocus={() => {
                                                examDateAutoOpenAttempted.current = true;
                                            }}
                                        />
                                    </div>
                                </div>
                                <p className={styles.helperText}>We'll create a personalized study schedule based on your exam date</p>
                                {validationErrors.examDate && (
                                    <div className={styles.errorMessage}>{validationErrors.examDate}</div>
                                )}
                            </div>

                        </div>
                        
                        {/* Study Plan Error Message */}
                        {studyPlanError && (
                            <div className={styles.errorMessage} style={{ marginTop: '16px', textAlign: 'center' }}>
                                {studyPlanError}
                            </div>
                        )}
                    </>
                ) : internalStep === 0 ? (
                    // Step 1: Welcome Screen
                    <>
                        {/* Tooltip Bubble */}
                        <div className={styles.tooltipBubble}>
                            Let's build a learning path just for you
                        </div>
                        
                        {/* Graduation Cap Icon */}
                        <div className={styles.iconContainer}>
                            <div className={styles.graduationCapIcon}>
                                <Image 
                                    src="/assets/logo-name.png" 
                                    alt="Logo" 
                                    width={50} 
                                    height={50}
                                    className={styles.logoImage}
                                    onLoad={() => console.log('✅ Logo loaded successfully')}
                                    onError={(e) => console.log('❌ Logo failed to load:', e)}
                                    priority
                                />
                            </div>
                        </div>
                        
                        {/* Main title */}
                        <h1 className={styles.mainTitle}>
                            Welcome to Durrani's
                        </h1>
                        
                        {/* Subtitle */}
                        <p className={styles.subtitle}>
                            Your personalized pharmacy education platform designed to help you excel in your studies
                        </p>
                    </>
                ) : internalStep === 1 ? (
                    // Step 2: Smarter every day
                    <>
                        <div className={styles.tooltipBubble}>
                            See how Durrani's keeps you smarter every day
                        </div>

                        {/* Diamond Icon */}
                        <div className={styles.iconContainer}>
                            <div className={styles.diamondIcon}>
                                <Image 
                                    src="/assets/logo-name.png" 
                                    alt="Logo" 
                                    width={50} 
                                    height={50}
                                    className={styles.logoImage}
                                    onLoad={() => console.log('✅ Logo loaded successfully')}
                                    onError={(e) => console.log('❌ Logo failed to load:', e)}
                                    priority
                                />
                            </div>
                        </div>
                        
                        {/* Main title */}
                        <h1 className={styles.mainTitle}>
                            Smarter every day
                        </h1>
                        
                        {/* Subtitle */}
                        <p className={styles.subtitle}>
                            Durrani's keeps you on track—with lessons, quizzes, and daily motivation designed specifically for pharmacy students
                        </p>
                    </>
                ) : internalStep === 2 ? (
                    // Step 3: Year Selection
                    <>
                        {/* Tooltip Bubble */}
                        <div className={styles.tooltipBubble}>
                            Which year are you in?
                        </div>
                        
                        {/* Graduation Cap Icon */}
                        <div className={styles.iconContainer}>
                            <div className={styles.graduationCapIcon}>
                                <Image 
                                    src="/assets/logo-name.png" 
                                    alt="Logo" 
                                    width={50} 
                                    height={50}
                                    className={styles.logoImage}
                                    onLoad={() => console.log('✅ Logo loaded successfully')}
                                    onError={(e) => console.log('❌ Logo failed to load:', e)}
                                    priority
                                />
                            </div>
                        </div>
                        
                        {/* Main title */}
                        <h1 className={styles.mainTitle}>
                            Select your current year
                        </h1>
                        
                        {/* Year Selection Grid */}
                        <div className={`${styles.yearGrid} ${highlightYearGrid ? styles.tourHighlightBlock : ''}`}>
                            <div 
                                className={`${styles.yearCard} ${selectedYear === 'I Year' ? styles.yearCardSelected : ''}`}
                                onClick={() => handleYearSelect('I Year')}
                                role="button"
                                tabIndex={0}
                            >
                                <h3 className={styles.yearTitle}>I Year</h3>
                                <p className={styles.yearSubtitle}>Foundation courses</p>
                            </div>
                            
                            <div 
                                className={`${styles.yearCard} ${selectedYear === 'II Year' ? styles.yearCardSelected : ''}`}
                                onClick={() => handleYearSelect('II Year')}
                                role="button"
                                tabIndex={0}
                            >
                                <h3 className={styles.yearTitle}>II Year</h3>
                                <p className={styles.yearSubtitle}>Core pharmacy subjects</p>
                            </div>
                            
                            <div 
                                className={`${styles.yearCard} ${selectedYear === 'III Year' ? styles.yearCardSelected : ''}`}
                                onClick={() => handleYearSelect('III Year')}
                                role="button"
                                tabIndex={0}
                            >
                                <h3 className={styles.yearTitle}>III Year</h3>
                                <p className={styles.yearSubtitle}>Advanced pharmacy</p>
                            </div>
                            
                            <div 
                                className={`${styles.yearCard} ${selectedYear === 'IV Year' ? styles.yearCardSelected : ''}`}
                                onClick={() => handleYearSelect('IV Year')}
                                role="button"
                                tabIndex={0}
                            >
                                <h3 className={styles.yearTitle}>IV Year</h3>
                                <p className={styles.yearSubtitle}>Specialization & practice</p>
                            </div>
                        </div>
                        
                        {/* Semester Selection - Only show when year is selected */}
                        {selectedYear && (
                            <>
                                <h3 className={styles.semesterTitle}>Select your semester</h3>
                                <div className={`${styles.semesterContainer} ${highlightSemesterContainer ? styles.tourHighlightBlock : ''}`}>
                                    <div 
                                        className={`${styles.semesterButton} ${selectedSemester === 'Semester 1' ? styles.semesterSelected : ''}`}
                                        onClick={() => handleSemesterSelect('Semester 1')}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        Semester 1
                                    </div>
                                    <div 
                                        className={`${styles.semesterButton} ${selectedSemester === 'Semester 2' ? styles.semesterSelected : ''}`}
                                        onClick={() => handleSemesterSelect('Semester 2')}
                                        role="button"
                                        tabIndex={0}
                                    >
                                        Semester 2
                                    </div>
                                </div>
                            </>
                        )}
                    </>
                ) : null}
            </div>
            
            {shouldShowTour && activeTour && (
                <div className={`${styles.tourOverlay} ${overlayVisible ? styles.tourOverlayVisible : ''}`}>
                    <div className={`${styles.tourBackdrop} ${guidedFocusActive ? styles.tourBackdropDim : ''}`}></div>
                    <div className={`${styles.tourContent} ${tourPositionClass}`}>
                        <div className={styles.tourTooltip}>
                            <div className={styles.tourTitle}>{activeTour.title}</div>
                            <div className={styles.tourDescription}>{activeTour.description}</div>
                            <button type="button" className={styles.tourSkipButton} onClick={handleSkipTour}>
                                Skip tour
                            </button>
                        </div>
                        <svg className={styles.tourArrowSvg} viewBox="0 0 160 170" aria-hidden="true">
                            <defs>
                                <marker
                                    id="tourArrowHead"
                                    markerWidth="7"
                                    markerHeight="6"
                                    refX="1.4"
                                    refY="3"
                                    orient="auto"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                >
                                    <path d="M0.2 0.4 L5.6 3 M0.2 5.6 L5.6 3" />
                                </marker>
                            </defs>
                            <path
                                d={tourArrowPath}
                                stroke="currentColor"
                                strokeWidth="3"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray={tourDashPattern || undefined}
                                strokeDashoffset={tourDashOffset}
                                markerEnd="url(#tourArrowHead)"
                            />
                        </svg>
                    </div>
                </div>
            )}
            <div className={styles.footer}>
                <button 
                    className={`${styles.continueButton} ${((internalStep === 2 && isSavingYearSemester) || (showPersonalInfo && isSubmittingProfile) || (internalStep === 4 && isGeneratingStudyPlan)) ? styles.continueButtonLoading : ''} ${(shouldHighlightContinueButton) ? styles.continueButtonHighlight : ''}`}
                    onClick={() => {
                        console.log('🔘 Button clicked!');
                        console.log('📊 Button state:', {
                            showPersonalInfo,
                            internalStep,
                            isSubmittingProfile
                        });
                        if (internalStep === 4) {
                            console.log('📚 Calling handleStudyPreferencesContinue');
                            handleStudyPreferencesContinue();
                        } else if (showPersonalInfo) {
                            console.log('👤 Calling handlePersonalInfoContinue');
                            handlePersonalInfoContinue();
                        } else {
                            console.log('➡️ Calling handleContinue');
                            handleContinue();
                        }
                    }}
                    disabled={(internalStep === 2 && (!selectedYear || !selectedSemester)) || (internalStep === 2 && isSavingYearSemester) || (showPersonalInfo && isSubmittingProfile) || (internalStep === 4 && isGeneratingStudyPlan)}
                >
                    {((internalStep === 2 && isSavingYearSemester) || (showPersonalInfo && isSubmittingProfile) || (internalStep === 4 && isGeneratingStudyPlan))
                        ? renderLoadingContent(internalStep === 4 ? 'Generating Study Plan...' : showPersonalInfo ? 'Saving...' : 'Please wait...')
                        : (internalStep === 4 ? 'Complete Setup' : 'Continue')}
                </button>
            </div>
        </div>
    );
}

export default WelcomeScreen;

