# Onboarding Flow Plan using ArkUI Tour

## Overview

This plan outlines the implementation of an interactive onboarding flow using [ArkUI's Tour component](https://ark-ui.com/docs/components/tour). The tour will guide new users through key features of the application, providing context-aware guidance that adapts to user actions.

## Quick Start

The `Onboarding` component provides a simple way to integrate the tour:

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

For full control, use `OnboardingProviderWrapper` instead.

---

## 1. Architecture & Structure

### File Organization
```
otion-alt/
├── onboarding/
│   ├── hooks/
│   │   └── useOnboardingTour.ts          # Tour state management
│   ├── components/
│   │   ├── OnboardingTour.tsx             # Main Tour component wrapper
│   │   ├── OnboardingOverlay.tsx           # Full-screen overlay (optional)
│   │   └── SkipButton.tsx                  # Persistent skip button
│   └── steps/
│       ├── step-1-welcome.ts               # Welcome & value prop
│       ├── step-2-dashboard.ts              # Dashboard overview
│       ├── step-3-create-project.ts     # Project creation demo
│       ├── step-4-keyboard-shortcuts.ts  # Keyboard navigation guide
│       └── step-5-settings.ts             # Settings customization
├── types/
│   └── onboarding.ts                       # Step type definitions
└── utils/
    └── onboarding.ts                        # Helper functions (e.g., skip logic)
```

### Core Components

#### `useOnboardingTour` Hook
Manages tour state, step navigation, and user preferences:
```typescript
const { 
  isOpen,
  currentStepIndex,
  totalSteps,
  nextStep,
  prevStep,
  skip,
  resume,
  progressPercent,
  isComplete
} = useOnboardingTour({
  steps: [/* step definitions */],
  autoStart: true, // Optional: start after signup
  allowSkip: true,
})
```

#### `OnboardingOverlay` Component
Full-screen overlay that dims the background and centers tour content:
```typescript
function OnboardingOverlay({ children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      {children}
    </div>
  )
}
```

---

## 2. Step Design & Content Strategy

### Step Types to Use

#### A. Dialog Steps (for major actions)
Use for high-impact moments that require user attention:
- **Step 1: Welcome** - Value proposition, "What is this?"
- **Step 3: Create Project** - Interactive demo showing the core feature

```typescript
{
  id: 'step-welcome',
  type: 'dialog', // Modal dialog centered on screen
  title: 'Welcome to Notion Alt',
  description: 'Discover a new way to organize your thoughts.',
  actions: [
    { label: 'Start Tour', action: 'next' },
    { label: 'Skip for now', action: 'skip' }
  ],
}
```

#### B. Floating Steps (for contextual guidance)
Use for features that appear in the UI:
- **Step 2: Dashboard** - Show where key elements are located
- **Step 4: Keyboard Shortcuts** - Overlay showing shortcuts

```typescript
{
  id: 'step-dashboard',
  type: 'floating', // Flexible positioning
  placement: 'top-start',
  target: () => document.querySelector('.dashboard-header'),
  title: 'Your Dashboard',
  description: 'This is where you create and manage projects.',
}
```

#### C. Tooltip Steps (for quick hints)
Use for small UI elements or temporary guidance:
- **Step 5: Settings** - Hover tooltips explaining options

---

## 3. Implementation Details

### Step Configuration Pattern

```typescript
const steps = [
  // Step 1: Welcome Dialog
  {
    id: 'step-welcome',
    type: 'dialog',
    title: 'Welcome to Notion Alt',
    description: 'Organize your thoughts with a new way of thinking.',
    actions: [
      { label: 'Start Tour', action: 'next' },
      { label: 'Skip for now', action: 'skip' }
    ],
  },

  // Step 2: Dashboard Floating
  {
    id: 'step-dashboard',
    type: 'floating',
    placement: 'top-start',
    target: () => document.querySelector('.dashboard-header'),
    title: 'Your Dashboard',
    description: 'This is where you create and manage projects.',
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
    ],
  },

  // Step 4: Keyboard Shortcuts (Wait step)
  {
    id: 'step-keyboard',
    type: 'wait',
    title: 'Keyboard Navigation',
    description: 'Use arrow keys to navigate through this tour.',
    effect({ next }) {
      // Wait for user interaction
      const button = document.querySelector('.keyboard-demo-btn');
      if (button) {
        button.addEventListener('click', () => next());
        return () => button.removeEventListener('click', () => {});
      }
    },
  },
];
```

### Effects & Interactivity

Use the `effect` function for custom logic:
```typescript
{
  id: 'step-interactive',
  type: 'floating',
  effect({ next, show }) {
    // Wait for user to click a button before showing step
    const demoButton = document.querySelector('.demo-button');
    if (demoButton) {
      let shown = false;
      demoButton.addEventListener('click', () => {
        if (!shown) {
          show();
          shown = true;
          next(); // Move to next step
        }
      });
      return () => demoButton.removeEventListener('click', ...);
    }
  },
}
```

### Skip Logic
```typescript
const skipLogic = {
  allowSkip: true,
  skipAfterSteps: 2, // Allow skipping after first step
  autoResume: false, // Don't resume on return to app
};
```

---

## 4. User Experience Flow

### Phase 1: Immediate Post-Login (0-5 seconds)
**Trigger:** After successful authentication
- Show **Step 1 (Welcome)** as a dialog
- Allow immediate skip for power users
- Auto-start after 3 seconds if user hasn't interacted

### Phase 2: First Session (5-60 minutes)
**Trigger:** User opens app on first visit
- Show all steps in sequence
- Dialog → Floating → Dialog (interactive) → Wait
- Allow resuming from any step using context API

### Phase 3: On-Demand Guidance
**Trigger:** User clicks "Show me" button or specific UI element
- Use floating tooltips for quick help
- Context-aware positioning based on current page

---

## 5. Accessibility & Keyboard Navigation

### Required Features (ArkUI built-in)
- **Keyboard navigation**: Arrow keys to navigate steps
- **Skip functionality**: Escape key or dedicated skip button
- **Focus management**: Proper focus trapping in dialogs
- **ARIA labels**: All tour elements properly labeled

### Additional Enhancements
```typescript
// Ensure proper ARIA attributes
{
  id: 'step-welcome',
  type: 'dialog',
  // Add aria-label for screen readers
  description: () => (
    <span className="sr-only">Learn how to organize your thoughts</span>
  ),
}
```

---

## 6. Testing Strategy

### Unit Tests
```typescript
// Test step configuration
it('should have correct step count', () => {
  expect(steps.length).toBe(5);
});

// Test skip logic
it('should allow skipping after first step', () => {
  const tour = useOnboardingTour({ steps });
  expect(tour.isSkipAllowed()).toBe(true);
});
```

### Integration Tests
- Verify keyboard navigation works end-to-end
- Test dialog accessibility (focus trap, ARIA states)
- Verify skip button persists across step changes

---

## 7. Performance Considerations

### Lazy Loading Steps
```typescript
// Load steps asynchronously to reduce initial bundle size
const steps = useLazySteps(); // Custom hook
```

### Debounced Effects
```typescript
effect({ next }) {
  const timer = setTimeout(() => next(), 1000);
  return () => clearTimeout(timer);
}
```

---

## 8. Analytics & Tracking

Track tour completion and skip rates:
```typescript
const analytics = useAnalytics();
analytics.track('onboarding_tour_started');
analytics.track('onboarding_step_completed', { stepId: 'step-welcome' });
analytics.track('onboarding_skip', { reason: 'user_requested' });
```

---

## 9. Future Enhancements

### A/B Testing
- Test different welcome messages
- Compare dialog vs floating positioning
- Measure skip rates by step type

### Personalization
- Detect user role (free vs premium) and adjust steps
- Show advanced features only to power users
- Remember completion status per user session

---

## Summary Checklist

- [ ] Implement `useOnboardingTour` hook with state management
- [ ] Create step configuration for all 5 steps
- [ ] Add skip button component (persistent across steps)
- [ ] Test keyboard navigation (arrow keys, enter, escape)
- [ ] Verify accessibility (ARIA labels, focus management)
- [ ] Add analytics tracking for tour events
- [ ] Implement responsive positioning for mobile
- [ ] Add loading states for async step content
- [ ] Test skip logic and resumption behavior
- [ ] Performance optimization (lazy loading steps)

---

**Next Steps:** Start with Step 1 (Welcome) as a dialog, then iterate based on user feedback before implementing the remaining steps.
