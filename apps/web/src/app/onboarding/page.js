"use client";
import WelcomeScreen from '../../components/Onboarding';
import { useRouter } from 'next/navigation';

export default function OnboardingPage() {
    const router = useRouter();

    const handleContinue = () => {
        // Navigate to dashboard after onboarding completion
        router.push('/dashboard');
    };

    const handleBack = () => {
        // Navigate back to login if needed
        router.push('/');
    };

    return (
        <WelcomeScreen 
            onContinue={handleContinue}
            onBack={handleBack}
            showBackButton={false}
        />
    );
}

