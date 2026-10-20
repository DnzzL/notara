---
id: NOT-38
title: Todo text struck through when unchecked
status: done
assignee: []
created_date: '2026-06-23 19:22'
updated_date: '2026-06-23 19:22'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The task-item line-through CSS selector matched attribute presence ([data-checked]) instead of value, so unchecked todos (data-checked="false", which is how TipTap TaskItem always renders) were struck through. Surfaced on imported content with many todos.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Unchecked todos render with no strikethrough
- [x] #2 Checked todos still render with strikethrough
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed task-item strikethrough selector in packages/app/src/styles.css: changed li.task-item[data-checked] (matched attribute presence — true and false alike) to li.task-item[data-checked="true"]. TipTap's TaskItem always emits data-checked ("true"/"false"), so unchecked items were incorrectly struck through. One-line CSS change; no markup or data changes.
<!-- SECTION:FINAL_SUMMARY:END -->
