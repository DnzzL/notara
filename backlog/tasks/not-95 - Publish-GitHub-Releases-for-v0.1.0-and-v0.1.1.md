---
id: NOT-95
title: Publish GitHub Releases for v0.1.0 and v0.1.1
status: done
assignee:
  - '@claude'
created_date: '2026-08-19 12:21'
updated_date: '2026-08-19 12:49'
labels:
  - enhancement
dependencies: []
priority: medium
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Tags v0.1.0 and v0.1.1 are pushed but the repo has zero GitHub Releases. The Releases page is a discovery and trust surface (Watch > Releases, changelog links from directories and posts), and it currently reads as a project that has never shipped.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A GitHub Release exists for v0.1.0 and v0.1.1, body sourced from CHANGELOG.md
- [x] #2 v0.1.1 marked as latest, with the docker pull command in the body
- [x] #3 release.yml creates the GitHub Release automatically on future tags
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
- Releases created from the CHANGELOG sections: v0.1.0 (not latest) and v0.1.1 (latest), each with the docker run line for its own tag appended.
- release.yml gains a release job, gated on the image job, that extracts the tag's CHANGELOG section with awk and calls gh release create. It fails loudly when the section is missing, so a tag can never ship an empty release.
- The extractor stops at the next version heading or at the footer link definitions; without the second guard the oldest section swallowed the [Unreleased]/[0.1.x] link block, which is what the first published v0.1.0 body did before it was corrected.

- Known limitation: --latest is unconditional, so a patch tag cut from an older branch would take the Latest flag. Not worth a version comparison until that actually happens.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Both tags were pushed but the repo had no GitHub Releases at all, so the Releases page — a discovery surface people watch and directories link to — read as a project that had never shipped.

Changes:
- Published v0.1.0 and v0.1.1 from their CHANGELOG sections, each with the docker run command for its own tag. v0.1.1 carries Latest.
- .github/workflows/release.yml: a release job (after the image job) extracts the tag's CHANGELOG section and creates the release with gh, so CHANGELOG.md stays the single source of truth. Missing section = failed job, never a silent empty release.

Known limitation: --latest is unconditional, so a patch tag cut from an older branch would steal the Latest flag.
<!-- SECTION:FINAL_SUMMARY:END -->
