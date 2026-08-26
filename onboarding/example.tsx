'use client'

import { Onboarding } from './index'

export function OnboardingExample() {
  return (
    <>
      {/* Simple usage - wrap your app */}
      <Onboarding 
        steps={[
          {
            id: 'step-welcome',
            type: 'dialog',
            title: 'Welcome to Notion Alt',
            description: 'Organize your thoughts with a new way of thinking.',
            actions: [
              { label: 'Start Tour', action: 'next' },
              { label: 'Skip for now', action: 'skip' }
            ]
          },
          {
            id: 'step-dashboard',
            type: 'floating',
            title: 'Your Dashboard',
            description: 'This is where you create and manage projects.',
            placement: 'top-start'
          },
          {
            id: 'step-create-project',
            type: 'dialog',
            title: 'Create a New Project',
            description: 'Try creating your first project by clicking the button below.',
            actions: [
              { label: 'Show me how', action: 'next' },
              { label: 'I already know', action: 'skip' }
            ]
          },
          {
            id: 'step-keyboard',
            type: 'floating',
            title: 'Keyboard Navigation',
            description: 'Use arrow keys to navigate through this tour.',
            placement: 'top-end'
          }
        ]}
      />
    </>
  )
}
