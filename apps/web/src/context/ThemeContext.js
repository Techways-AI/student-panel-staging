"use client";
import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);

    // Initialize hydration state
    useEffect(() => {
        setIsHydrated(true);
    }, []);

    // Initialize theme from localStorage or system preference
    useEffect(() => {
        if (isHydrated && typeof window !== 'undefined') {
            const savedTheme = localStorage.getItem('theme');

            if (savedTheme === 'dark') {
                setIsDarkMode(true);
                document.documentElement.setAttribute('data-theme', 'dark');
            } else {
                setIsDarkMode(false);
                document.documentElement.setAttribute('data-theme', 'light');

                // If there is no saved theme, default to light explicitly
                if (!savedTheme) {
                    localStorage.setItem('theme', 'light');
                }
            }
        }
    }, [isHydrated]);

    // Toggle theme function
    const toggleTheme = () => {
        const newTheme = !isDarkMode;
        setIsDarkMode(newTheme);
        
        if (typeof window !== 'undefined') {
            localStorage.setItem('theme', newTheme ? 'dark' : 'light');
            document.documentElement.setAttribute('data-theme', newTheme ? 'dark' : 'light');
        }
    };

    return (
        <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}

