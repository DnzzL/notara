# Onboarding Tour Implementation

## What Was Built

A complete onboarding flow using ArkUI's Tour component, following the Notara Design System.

### Files Created

1. **`hooks/useOnboardingTour.ts`** - React Context for state management (open/close, navigation, progress)
2. **`components/OnboardingProvider.tsx`** - Wraps app with tour context and step definitions  
3. **`components/OnboardingOverlay.tsx`** - Full-screen overlay for dialog steps with activity tracking
4. **`components/OnboardingTour.tsx`** - Main tour component handling positioning and keyboard navigation
5. **`components/SkipButton.tsx`** - Persistent skip button (fixed bottom-right)
6. **`components/Onboarding.tsx`** - Wrapper component for easy integration
7. **`types/onboarding.ts`** - TypeScript interfaces for step types and context values
8. **`example.tsx`** - Usage example showing integration
9. **`README.md`** - Documentation of structure and features
10. **`GUIDE.md`** - Usage guide with examples
11. **`__tests__/useOnboardingTour.test.tsx`** - Basic test coverage

## Integration

### Simple Usage (Recommended)

Wrap your app in `Onboarding` component:

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

## Architecture

```
onboarding/
├── hooks/                    # State management (Context API)
│   └── useOnboardingTour.ts
├── components/               # UI Components
│   ├── OnboardingProvider.tsx      # Context provider with steps
│   ├── OnboardingOverlay.tsx       # Dialog overlay
│   ├── OnboardingTour.tsx           # Floating positioning logic
│   └── SkipButton.tsx              # Persistent skip button
├── types/                    # TypeScript definitions
│   └── onboarding.ts
└── tests/                    # Unit tests
    └── useOnboardingTour.test.tsx
```

## Step Configuration

```typescript
const steps = [
  // Step 1: Welcome Dialog (Modal)
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
  
  // Step 2: Dashboard Floating
  {
    id: 'step-dashboard',
    type: 'floating',
    title: 'Your Dashboard',
    description: 'This is where you create and manage projects.',
    placement: 'top-start'
  },
  
  // Step 3: Create Project Dialog (Interactive)
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
  
  // Step 4: Keyboard Navigation Floating
  {
    id: 'step-keyboard',
    type: 'floating',
    title: 'Keyboard Navigation',
    description: 'Use arrow keys to navigate through this tour.',
    placement: 'top-end'
  }
]
```

## Key Features

### 1. Step Types (ArkUI Tour)
- **Dialog**: Modal dialogs for major actions (welcome, project creation)
- **Floating**: Positioned cards that follow the user's screen position
- **Tooltip**: Quick hints anchored to UI elements

### 2. Keyboard Navigation
Built-in support via ArkUI:
- Arrow keys: Navigate between steps
- Enter: Advance dialog step
- Escape: Skip/Close tour

### 3. Skip Logic
Persistent `SkipButton` at bottom-right allows users to skip the tour at any time.

### 4. Progress Tracking
Visual progress bar + step counter showing completion percentage.

### 5. Auto-Close
Closes after 30 seconds of user inactivity (tracked via click activity).

## Design System Compliance

- **Colors**: Uses `--accent` (#2B4DFF) for primary buttons, `--text-sb*` for sidebar text on paper background (`#FAFAF8`)
- **Typography**: Bricolage Grotesque (uppercase) for titles, Archivo for body
- **Borders**: Hairline borders (`--border-mid`) and structured layout
- **Radii**: [4px](file:///Users/thomas/Projects/personal/notion-alt/components/ui/Button.tsx#L10-L10) - hard edges where appropriate (Swiss style)

## Next Steps

1. **Integration**: Wrap your app in `Onboarding` component to enable the tour system
2. **Customize Steps**: Update step definitions to match your actual features
3. **Add Effects**: Use the `effect` function for custom logic (wait for user actions)
4. **Analytics**: Track completion rates and skip behavior
5. **Personalization**: Detect user role and adjust steps accordingly
