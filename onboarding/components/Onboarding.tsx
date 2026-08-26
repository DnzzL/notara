'use client'

import { OnboardingProvider } from '../hooks/useOnboardingTour'
import { OnboardingOverlay } from './OnboardingOverlay'
import { OnboardingTour } from './OnboardingTour'
import { SkipButton } from './SkipButton'
import type { StepDefinition } from '../hooks/useOnboardingTour'

interface OnboardingProps {
  steps: StepDefinition[]
  autoStart?: boolean
  onComplete?: () => void
  children: React.ReactNode
}

export function Onboarding({ steps, autoStart = false, onComplete, children }: OnboardingProps) {
  return (
    <OnboardingProvider steps={steps} autoStart={autoStart} onComplete={onComplete}>
      <OnboardingOverlay />
      <OnboardingTour />
      <SkipButton />
      {children}
    </OnboardingProvider>
  )
}
