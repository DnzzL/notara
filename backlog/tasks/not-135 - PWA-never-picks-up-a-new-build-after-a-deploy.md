---
id: NOT-135
title: PWA never picks up a new build after a deploy
status: done
assignee: []
created_date: '2026-08-29 17:33'
updated_date: '2026-08-29 17:33'
labels:
  - bug
dependencies: []
priority: high
ordinal: 130000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
vite-plugin-pwa's injected registerSW.js registers /sw.js once on load and never calls update(). With registerType autoUpdate the new worker skipWaiting()s and claims the page, but nothing reloads it — so an installed PWA window keeps serving the previous build indefinitely. index.html was also served with no Cache-Control, leaving it to nginx heuristic freshness.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Registration checks for an update on every foreground and hourly
- [x] #2 The page reloads once a new worker takes control, but not on first install
- [x] #3 index.html is served no-cache and /assets/ immutable
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the plugin's injected registration with src/lib/sw-update.ts: it registers /sw.js, calls registration.update() on every visibilitychange to visible and hourly, and reloads once controllerchange fires on a client that already had a controller (so a first install does not bounce). injectRegister is now null. nginx serves index.html no-cache and /assets/ immutable. Plain navigator.serviceWorker rather than virtual:pwa-register, to keep the workbox chain out of the dev server (NOT-126).
<!-- SECTION:FINAL_SUMMARY:END -->
