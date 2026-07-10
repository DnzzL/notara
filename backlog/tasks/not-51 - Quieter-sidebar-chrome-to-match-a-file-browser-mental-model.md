---
id: NOT-51
title: Quieter sidebar chrome to match a file-browser mental model
status: done
assignee:
  - '@thomas'
created_date: '2026-07-10 15:39'
updated_date: '2026-07-10 16:06'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 54000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Hubble.md's simplicity comes partly from a plain file-browser feel. Notara's sidebar tree already IS a file browser but is dressed as a 'workspace' with heavier chrome. Lean into the file-browser metaphor: plainer page rows, quieter labels/icons, less visual weight on workspace framing. This is design-judgment work (spacing, hierarchy, tone) rather than mechanical, so it needs a human design pass rather than an AFK agent.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Sidebar page rows read as a plain, quiet file tree (reduced chrome/visual weight)
- [x] #2 Change is presentational only; no behavior or data changes
- [x] #3 Reviewed against the 'simplest, lightest Notion alternative' positioning
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
File-browser-quiet direction (approved). 1. Section labels (Favorites/Pages): drop mono+uppercase+wide tracking -> plain 11px muted. 2. Favorites selected row: accent tint+semibold -> neutral bg-sb-3 + normal text + medium. 3. Tree selected (styles.css): accent-dim bg + accent bar -> var(--sb-3) bg, var(--text-sb) text, weight 500, remove ::before accent bar.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Presentational only. Sidebar.tsx: two section labels de-emphasized (removed var(--font-mono), uppercase, tracking-[0.12em]; now text-[11px] muted). Favorites selected highlight -> bg-sb-3!/text-text-sb!/font-medium!. styles.css: [data-part=branch-control][data-selected] now uses neutral var(--sb-3)/var(--text-sb)/500 and the accent left-bar ::before rule was removed. Tokens are theme-aware. Verify: app tsc clean for Sidebar.tsx; 118/118 server tests pass (no server changes).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Quieter, file-browser-style sidebar chrome.

- Section labels ('Favorites', 'Pages'): dropped the monospace + uppercase + wide letter-spacing treatment for a plain muted 11px label.
- Selected page row: replaced the accent-blue tint + bold + left accent bar with a soft neutral gray highlight (var(--sb-3) / var(--text-sb), medium weight) in both the Favorites list (Sidebar.tsx) and the page tree (styles.css [data-part=branch-control][data-selected]).

Why: reads as a calm file tree (Finder/VS Code) rather than a 'designed' app chrome, supporting the simplest/lightest positioning. Presentational only — no behavior or data changes; theme-aware tokens used.

Tests: app type-check clean for the edited file; 118/118 server tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
