# Onboarding Tour Implementation

This directory contains an interactive onboarding flow using ArkUI's Tour component, following the Notara Design System.

## Structure

```
onboarding/
├── hooks/
│   └── useOnboardingTour.ts          # State management and navigation logic
├── components/
│   ├── OnboardingProvider.tsx        # React Context provider
│   ├── OnboardingOverlay.tsx         # Full-screen overlay for dialogs
│   ├── OnboardingTour.tsx            # Main tour component with positioning
│   ├── SkipButton.tsx                # Persistent skip button (fixed position)
│   └── Onboarding.tsx               # Wrapper component for easy integration
├── types/
│   └── onboarding.ts                 # TypeScript interfaces
└── example.tsx                       # Usage example
```

## Features

- **Step Types**: Dialog, Floating, and Tooltip support via ArkUI Tour API
- **Keyboard Navigation**: Arrow keys to navigate, Escape to skip
- **Skip Logic**: Persistent button allowing users to skip the tour at any time
- **Progress Tracking**: Visual progress bar and step counter
- **Auto-Close**: Closes after 30 seconds of inactivity
- **Resume Capability**: Can resume from any step using the "Resume" button

## Integration

### Simple Usage (Recommended)

Wrap your application in `Onboarding` component:

```tsx
import { Onboarding } from './onboarding'

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
    }
  ]}
/>
```

### Advanced Usage (Full Control)

For full control over the tour system, use `OnboardingProviderWrapper`:

```tsx
import { OnboardingProviderWrapper } from './onboarding'

<OnboardingProviderWrapper>
  <YourApp />
</OnboardingProviderWrapper>
```

## Step Configuration

Each step is defined with:
- `id`: Unique identifier
- `type`: 'dialog' (modal), 'floating' (positioned card), or 'tooltip'
- `title`/`description`: Content
- `placement`: For floating steps ('top-start', etc.)
- `actions`: Array of button actions ({ label, action })

## Design System Compliance

- Uses `--accent` (#2B4DFF) for primary buttons and active states
- Follows Swiss typography: Bricolage Grotesque for titles (uppercase), Archivo for body
- Small radii ([4px](file:///Users/thomas/Projects/personal/notion-alt/components/ui/Button.tsx#L10-L10)) - hard edges where appropriate
- Paper background (`--bg` #FAFAF8) with white surfaces
- Hairline borders and structured layout
