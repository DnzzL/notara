---
id: NOT-34
title: Move onboarding tour out of the Backups/settings context into Help menu
status: done
assignee:
  - '@thomas'
created_date: '2026-06-17 13:15'
updated_date: '2026-06-17 14:04'
labels:
  - frontend
dependencies: []
ordinal: 39000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The sidebar "Backups" button opens a SettingsModal that contains both a "Welcome" section with the "Take the onboarding tour" button and "Backup to S3" settings. This is confusing because:

1. The sidebar button is labelled "Backups" but opens a dialog containing unrelated items (tour button)
2. The onboarding tour lives in the same modal as backup config

Fix (option b): Move the "Take the onboarding tour" button to a different location, such as:
- A "Help" item in the sidebar (e.g., with a "?" icon)
- A dedicated menu section separate from backups
- Or make the sidebar button more generic (e.g., "Settings") if the modal contains multiple sections
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The 'Take the onboarding tour' button is no longer displayed in the backups/settings modal
- [x] #2 The onboarding tour is accessible from a logical location in the sidebar (e.g., a Help or ? menu item)
- [x] #3 Backups menu and settings modal remain otherwise unchanged
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Remove 'Welcome' section and onboarding tour button from SettingsModal.tsx\n2. Add 'Help' sidebar button (with ? icon) that triggers the tour in Sidebar.tsx\n3. Update tour text in OnboardingTour.tsx to reference 'Help menu' instead of 'Settings'
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Removed 'Welcome' section with onboarding tour button from SettingsModal.tsx. Added '?' Help button in sidebar bottom nav that triggers onStartTour. Updated tour final step text to reference 'Help menu' instead of 'Settings'.
<!-- SECTION:NOTES:END -->
