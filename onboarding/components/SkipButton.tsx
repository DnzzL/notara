'use client'

import { useOnboardingTour } from '../hooks/useOnboardingTour'

export function SkipButton() {
  const { isOpen, isComplete, skip } = useOnboardingTour()

  if (!isOpen || isComplete) return null

  return (
    <button
      onClick={skip}
      className="fixed bottom-5 right-5 z-[9998] flex items-center gap-2 px-4 py-2.5 bg-surface border border-border-mid rounded-full shadow-md hover:shadow-lg transition-shadow text-text-sb hover:text-accent"
      aria-label="Skip tour"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
        <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"/>
      </svg>
      <span className="font-mono text-xs font-semibold">Skip</span>
    </button>
  )
}
