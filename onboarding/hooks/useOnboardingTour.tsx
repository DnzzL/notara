import { createContext, useContext, useEffect, useState } from 'react'

export interface StepDefinition {
  id: string
  type: 'dialog' | 'floating' | 'tooltip'
  title: string
  description?: string
  placement?: string
  target?: () => HTMLElement | null
  actions?: Array<{
    label: string
    action: 'next' | 'prev' | 'skip'
  }>
}

interface OnboardingContextType {
  isOpen: boolean
  currentStepIndex: number
  totalSteps: number
  steps: StepDefinition[]
  nextStep: () => void
  prevStep: () => void
  skip: () => void
  resume: () => void
  restart: () => void
  progressPercent: number
  isComplete: boolean
}

export const OnboardingContext = createContext<OnboardingContextType | null>(null)

export function useOnboardingTour() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboardingTour must be used within an OnboardingProvider')
  }
  return context
}

interface OnboardingProviderProps {
  children: React.ReactNode
  steps: StepDefinition[]
  autoStart?: boolean
  allowSkip?: boolean
  onComplete?: () => void
}

export function OnboardingProvider({
  children,
  steps,
  autoStart = false,
  allowSkip = true,
  onComplete,
}: OnboardingProviderProps) {
  const [isOpen, setIsOpen] = useState(autoStart)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    if (autoStart && steps.length > 0) {
      setIsOpen(true)
    }
  }, [autoStart, steps])

  const nextStep = () => {
    if (!allowSkip && currentStepIndex === steps.length - 1) return
    setCurrentStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
  }

  const prevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => Math.max(prev - 1, 0))
    }
  }

  const close = () => {
    setIsOpen(false)
    setIsComplete(true)
    onComplete?.()
  }

  const skip = close

  const restart = () => {
    setIsComplete(false)
    setCurrentStepIndex(0)
    setIsOpen(true)
  }

  const progressPercent = steps.length > 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0

  const value: OnboardingContextType = {
    isOpen,
    currentStepIndex,
    totalSteps: steps.length,
    steps,
    nextStep,
    prevStep,
    skip,
    resume: () => setIsOpen(true),
    restart,
    progressPercent,
    isComplete,
  }

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  )
}
