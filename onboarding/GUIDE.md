# Onboarding Tour Usage Guide

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

## Step Definitions

Define steps with their type, content, and actions:

```typescript
const steps = [
  {
    id: 'step-welcome',
    type: 'dialog', // Modal dialog (Step 1)
    title: 'Welcome to Notion Alt',
    description: 'Organize your thoughts with a new way of thinking.',
    actions: [
      { label: 'Start Tour', action: 'next' },
      { label: 'Skip for now', action: 'skip' }
    ]
  },
  {
    id: 'step-dashboard',
    type: 'floating', // Positioned card (Step 2)
    title: 'Your Dashboard',
    description: 'This is where you create and manage projects.',
    placement: 'top-start'
  }
]
```

## Customization

### Auto-Start
Enable automatic start after login:
```tsx
<OnboardingProviderWrapper 
  steps={steps}
  autoStart={true} // Starts tour automatically on first visit
/>
```

### Skip Button
The `SkipButton` component is persistent and fixed at bottom-right, allowing users to skip the tour at any time.

## Keyboard Navigation

- **Arrow Right**: Next step
- **Arrow Left**: Previous step  
- **Enter**: Advance (for dialog steps)
- **Escape**: Skip/Close tour

## Design System

The implementation follows Notara's design system:
- **Colors**: Uses `--accent` (#2B4DFF) for primary buttons, `--text-sb*` for sidebar text on paper background
- **Typography**: Bricolage Grotesque (uppercase) for titles, Archivo for body text
- **Borders**: Hairline borders (`--border-mid`) and structured layout
- **Radii**: [4px](file:///Users/thomas/Projects/personal/notion-alt/components/ui/Button.tsx#L10-L10) - hard edges where appropriate (Swiss style)
