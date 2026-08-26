export interface OnboardingStep {
  id: string
  title: string
  description?: string
}

export type StepType = 'dialog' | 'floating' | 'tooltip'

export interface TourStepDetails extends OnboardingStep {
  type: StepType
  placement?: string
  target?: () => HTMLElement | null
  actions?: Array<{
    label: string
    action: 'next' | 'prev' | 'skip'
  }>
}

export interface OnboardingContextValue {
  isOpen: boolean
  currentStepIndex: number
  totalSteps: number
  nextStep: () => void
  prevStep: () => void
  skip: () => void
  resume: () => void
  progressPercent: number
  isComplete: boolean
}
