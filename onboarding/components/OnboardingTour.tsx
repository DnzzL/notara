'use client'

import { useOnboardingTour } from '../hooks/useOnboardingTour'
import { useEffect } from 'react'

const FLOATING_POSITIONS = [
  { top: '12%', left: '50%', transform: 'translateX(-50%)' },
  { top: '26%', left: '50%', transform: 'translateX(-50%)' },
  { top: '40%', left: '50%', transform: 'translateX(-50%)' },
  { top: '12%', right: '5%', transform: 'none' },
]

export function OnboardingTour() {
  const { isOpen, currentStepIndex, nextStep, prevStep, skip, progressPercent, isComplete, steps } = useOnboardingTour()

  const currentStep = steps[currentStepIndex]

  useEffect(() => {
    if (!isOpen || isComplete) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
          e.preventDefault()
          nextStep()
          break
        case 'ArrowLeft':
          e.preventDefault()
          prevStep()
          break
        case 'Escape':
          skip()
          break
        case 'Enter':
          if (currentStep?.type === 'dialog') {
            e.preventDefault()
            nextStep()
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isComplete, currentStepIndex, nextStep, prevStep, skip, currentStep])

  if (!isOpen || isComplete) return null

  if (currentStep?.type === 'dialog') {
    return (
      <div role="dialog" className="fixed inset-0 z-[9998] flex items-center justify-center p-4">
        <div className="relative w-full max-w-sm">
          <button
            onClick={skip}
            className="absolute -top-2.5 -right-2.5 z-10 flex items-center justify-center w-7 h-7 rounded-full bg-surface border border-border-mid text-text-sb hover:text-accent hover:border-accent transition-all shadow-sm"
            aria-label="Close tour"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="square"/>
            </svg>
          </button>

          <div className="bg-surface border border-border-mid rounded-lg shadow-xl p-6">
            <h2 className="font-[var(--font-title)] text-lg font-bold tracking-tight text-text mb-4 uppercase">
              {currentStep.title}
            </h2>

            <p className="text-text-2 text-base leading-relaxed mb-6">
              {currentStep.description}
            </p>

            {currentStep.actions && (
              <div className="flex items-center justify-between gap-3">
                {currentStep.actions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (action.action === 'next') nextStep()
                      else if (action.action === 'prev') prevStep()
                      else if (action.action === 'skip') skip()
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-[4px] font-semibold text-sm transition-all ${
                      idx === 0
                        ? 'bg-accent text-white hover:bg-accent-2'
                        : 'text-text-sb border border-border-mid hover:border-accent hover:text-accent'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const pos = FLOATING_POSITIONS[currentStepIndex] ?? FLOATING_POSITIONS[0]

  return (
    <div className="fixed z-[9998]" style={pos}>
      <div className="bg-surface border border-border-mid rounded-lg shadow-xl p-5 min-w-[240px] max-w-[320px]">
        <h3 className="font-[var(--font-title)] text-sm font-bold tracking-tight text-text mb-2 uppercase">
          {currentStep?.title ?? ''}
        </h3>

        <p className="text-text-sb text-xs leading-relaxed">
          {currentStep?.description ?? ''}
        </p>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
          <span className="font-mono text-[11px] text-text-sb">{currentStepIndex + 1}/{steps.length}</span>

          <div className="w-20 h-1 bg-surface-3 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
