---
id: NOT-82
title: 'BlockLocked reason is lost over RPC, making the lock toast unreachable'
status: done
assignee:
  - '@claude'
created_date: '2026-08-04 14:59'
updated_date: '2026-08-04 15:59'
labels:
  - bug
dependencies: []
priority: medium
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
rpc-handlers.ts signals a locked block with Effect.fail(new Error('BlockLocked:<userId>')) and then Effect.orDie, so the client receives a Defect whose payload serializes to {} — the Error message does not survive. BlockEditor.handleUpdateBlock keys its '<name> is editing this block' toast off msg.includes('BlockLocked'), so that branch can never run: a refused write surfaces as a generic error instead. Proven by E2E: the RPC rejects, but the thrown message is 'RPC updateBlock defect: {}'. Failing spec: e2e/multiuser-locks.spec.ts ('a refused write tells the caller that the block was locked'). Note the UI normally prevents the write by turning the block read-only, so this only bites API consumers and the debounced-save race — but in that race the user currently gets no explanation. Related: NOT-78.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A write refused because of a block lock reaches the client with a machine-readable reason identifying the lock holder
- [x] #2 The failing spec in e2e/multiuser-locks.spec.ts passes
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced Effect.fail(new Error(`BlockLocked:${holder}`)) with a tagged BlockLockedError class carrying its own message field, at both lock sites (updateBlock and deleteBlock).

A plain Error does not survive Effect.orDie — the defect serialized to {}, so the client saw no reason and BlockEditor's '<name> is editing this block' branch was unreachable. The tagged class crosses intact (same shape as AuthError), and the existing client-side parsing needs no change.

Tests: 'a refused write tells the caller that the block was locked' in e2e/multiuser-locks.spec.ts now passes.
<!-- SECTION:FINAL_SUMMARY:END -->
