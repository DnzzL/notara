'use client'

import { render, screen, fireEvent } from '@testing-library/react'
import { OnboardingProvider, useOnboardingTour } from '../hooks/useOnboardingTour'

const steps = [
  {
    id: 'step-welcome',
    type: 'dialog' as const,
    title: 'Welcome',
    description: 'Welcome description',
    actions: [
      { label: 'Start Tour', action: 'next' as const },
      { label: 'Skip for now', action: 'skip' as const },
    ],
  },
  {
    id: 'step-dashboard',
    type: 'floating' as const,
    title: 'Dashboard',
    description: 'Dashboard description',
    placement: 'top-start',
  },
]

function TestConsumer() {
  const { currentStepIndex, totalSteps, progressPercent, isOpen, isComplete } = useOnboardingTour()
  return (
    <div>
      <span data-testid="is-open">{String(isOpen)}</span>
      <span data-testid="is-complete">{String(isComplete)}</span>
      <span data-testid="step-index">{currentStepIndex}</span>
      <span data-testid="total-steps">{totalSteps}</span>
      <span data-testid="progress">{progressPercent}</span>
    </div>
  )
}

function renderProvider(overrides?: Partial<React.ComponentProps<typeof OnboardingProvider>>) {
  return render(
    <OnboardingProvider steps={steps} {...overrides}>
      <TestConsumer />
    </OnboardingProvider>
  )
}

describe('OnboardingProvider (context)', () => {
  it('starts closed by default', () => {
    renderProvider()
    expect(screen.getByTestId('is-open')).toHaveTextContent('false')
    expect(screen.getByTestId('is-complete')).toHaveTextContent('false')
    expect(screen.getByTestId('step-index')).toHaveTextContent('0')
  })

  it('starts open when autoStart is true', () => {
    renderProvider({ autoStart: true })
    expect(screen.getByTestId('is-open')).toHaveTextContent('true')
  })

  it('computes progress correctly', () => {
    renderProvider({ autoStart: true })
    expect(screen.getByTestId('total-steps')).toHaveTextContent('2')
    expect(screen.getByTestId('progress')).toHaveTextContent('50')
  })
})

describe('OnboardingTour (integration)', () => {
  it('renders nothing when not open', () => {
    const { container } = render(
      <OnboardingProvider steps={steps}>
        <div>App</div>
      </OnboardingProvider>
    )
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('renders dialog for dialog-type steps', () => {
    render(
      <OnboardingProvider steps={steps} autoStart>
        <div>App</div>
      </OnboardingProvider>
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Welcome')).toBeInTheDocument()
  })

  it('skip button closes the tour', () => {
    render(
      <OnboardingProvider steps={steps} autoStart>
        <div>App</div>
      </OnboardingProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: /skip tour/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
