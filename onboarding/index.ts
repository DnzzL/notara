// Primary entry point - easy integration
export { Onboarding } from './components/Onboarding'
// Full control option
export { OnboardingProviderWrapper } from './components/OnboardingProvider'
// Individual components for advanced customization
export { OnboardingOverlay } from './components/OnboardingOverlay'
export { OnboardingTour } from './components/OnboardingTour'
export { SkipButton } from './components/SkipButton'
// Hook for programmatic control (replay, resume, etc.)
export { useOnboardingTour } from './hooks/useOnboardingTour'
