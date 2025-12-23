"use client";
import React from 'react';
import { useSectionManager } from '../hooks/useSectionManager';

/**
 * Generic wrapper component to add section management to any section
 * @param {string} sectionId - Unique identifier for the section
 * @param {React.ReactNode} children - The content to wrap
 * @param {boolean} enabled - Whether to enable section management (default: true)
 */
export default function SectionWrapper({ sectionId, children, enabled = true }) {
  // Use section manager hook
  const { isRestored, getSavedSection, clearSavedProgress } = useSectionManager(
    sectionId,
    null, // no video for this section
    null, // no video ref for this section
    enabled
  );

  return <>{children}</>;
}

/**
 * Hook to easily add section management to any component
 * @param {string} sectionId - Unique identifier for the section
 * @param {boolean} enabled - Whether to enable section management (default: true)
 */
export function useSectionWrapper(sectionId, enabled = true) {
  const { isRestored, getSavedSection, clearSavedProgress } = useSectionManager(
    sectionId,
    null, // no video for this section
    null, // no video ref for this section
    enabled
  );

  return { isRestored, getSavedSection, clearSavedProgress };
} 

