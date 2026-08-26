'use client'

import { useOnboardingTour } from '../hooks/useOnboardingTour'
import { useEffect, useRef } from 'react'

export function OnboardingOverlay() {
  const { isOpen, isComplete, skip, currentStepIndex, steps } = useOnboardingTour()
  const lastActiveRef = useRef(Date.now())

  useEffect(() => {
    if (!isOpen || isComplete) return

    const updateActivity = () => {
      lastActiveRef.current = Date.now()
    }

    document.addEventListener('click', updateActivity)
    document.addEventListener('keydown', updateActivity)

    const interval = setInterval(() => {
      if (Date.now() - lastActiveRef.current > 30000) {
        skip()
      }
    }, 1000)

    return () => {
      document.removeEventListener('click', updateActivity)
      document.removeEventListener('keydown', updateActivity)
      clearInterval(interval)
    }
  }, [isOpen, isComplete, skip])

  if (!isOpen || isComplete) return null

  const currentStep = steps[currentStepIndex]
  if (!currentStep || currentStep.type !== 'dialog') return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/15 backdrop-blur-sm" />
  )
}
