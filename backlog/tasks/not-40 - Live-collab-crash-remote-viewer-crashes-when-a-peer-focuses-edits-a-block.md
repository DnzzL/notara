---
id: NOT-40
title: 'Live collab crash: remote viewer crashes when a peer focuses/edits a block'
status: done
assignee: []
created_date: '2026-06-24 10:19'
updated_date: '2026-06-24 10:20'
labels:
  - bug
dependencies: []
priority: high
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
When two users view the same page, the moment one user focuses or edits a block, the other viewer's entire app crashed with 'Failed to execute insertBefore on Node: The node before which the new node is to be inserted is not a child of this node' (React error in the <span> component, caught by the route error boundary). Root cause: the block-lock-badge <span> in BlockEditor was conditionally mounted/unmounted as a sibling of the ProseMirror-managed <EditorContent>. React used the BubbleMenu's DOM node as the insertBefore reference, but tippy relocates that node, so the reference was no longer a child of .block-node -> NotFoundError. Fix: always mount the lock badge span (stable first child) and toggle it via CSS display, so the .block-node child list never mutates around the ProseMirror DOM.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Two users on the same page: one focusing a block does not crash the other
- [x] #2 Live block updates/creates/deletes propagate without crashing remote viewers
- [x] #3 Lock badge still appears for remote-held blocks
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed a hard crash in live collaboration. With two users on one page, when peer A focused or edited any block, peer B's whole app crashed (React 'insertBefore' NotFoundError in the <span> component, caught by the route error boundary). Root cause in packages/app/src/components/BlockEditor.tsx: the block-lock-badge <span> was conditionally mounted/unmounted as a sibling of the ProseMirror-managed <EditorContent>; React anchored the insert on the BubbleMenu node, which tippy relocates, so the reference node was no longer a child of .block-node. Fix: keep the badge always mounted as a stable first child and toggle it via CSS display:none, so the .block-node child list never mutates around the contentEditable DOM. Verified with two browser sessions (Alice owner + Bob invited member): bidirectional live block updates, creation, deletion/merge all sync with zero console errors and no crash; lock badge still shows for remote-held blocks.
<!-- SECTION:FINAL_SUMMARY:END -->
