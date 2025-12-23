"use client";

import { useState, useEffect } from 'react';

/**
 * Custom hook to safely handle client-side hydration
 * Prevents hydration mismatches by ensuring components only render
 * client-specific content after hydration is complete
 */
export function useHydration() {
    const [isHydrated, setIsHydrated] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
            setIsHydrated(true);
        });
    }, []);

    return { isHydrated, isClient };
}

/**
 * Hook to safely access localStorage after hydration
 * Returns null during SSR and initial hydration
 */
export function useLocalStorage(key, defaultValue = null) {
    const { isHydrated } = useHydration();
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isHydrated && typeof window !== 'undefined') {
            const storedValue = localStorage.getItem(key);
            if (storedValue !== null) {
                try {
                    setValue(JSON.parse(storedValue));
                } catch {
                    setValue(storedValue);
                }
            }
        }
    }, [isHydrated, key]);

    const setStoredValue = (newValue) => {
        setValue(newValue);
        if (isHydrated && typeof window !== 'undefined') {
            if (newValue === null) {
                localStorage.removeItem(key);
            } else {
                localStorage.setItem(key, JSON.stringify(newValue));
            }
        }
    };

    return [value, setStoredValue];
}

/**
 * Hook to safely access window object properties after hydration
 */
export function useWindowProperty(property, defaultValue = null) {
    const { isHydrated } = useHydration();
    const [value, setValue] = useState(defaultValue);

    useEffect(() => {
        if (isHydrated && typeof window !== 'undefined') {
            setValue(window[property]);
        }
    }, [isHydrated, property]);

    return value;
}

