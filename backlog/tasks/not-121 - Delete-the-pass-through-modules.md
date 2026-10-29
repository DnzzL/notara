---
id: NOT-121
title: Delete the pass-through modules
status: done
assignee:
  - '@thomas'
created_date: '2026-08-26 11:13'
updated_date: '2026-08-26 20:10'
labels:
  - enhancement
dependencies: []
priority: low
ordinal: 116000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Housekeeping pass over modules that fail the deletion test — deleting them concentrates nothing, because they hold nothing.

The auth client is twelve lines of pure re-export. The import-export handler module has five exports, four of which are one-line re-exports; only the archive unwrapping earns its place. The rate-limit middleware computes an allowed-origin value that nothing reads.

One of them is not a deletion but a deepening: the error reporter takes an Error, so eight of its nine call sites in the server entry point are the same stanza wrapping a cause into a synthetic Error and losing the cause in the process. Have it take the cause directly.

Keep this surgical. Do not remove pre-existing dead code beyond the items named here.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The re-export-only modules are deleted and their callers import the real source directly
- [x] #2 The unused computed value in the rate-limit middleware is gone
- [x] #3 The error reporter accepts a cause, and the repeated wrapping stanza is removed from every call site
- [x] #4 Error reports still reach the analytics backend with their original cause preserved
- [x] #5 Both type-check commands pass and the server test suite is green
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Two of this ticket's four claims were wrong. Verified each before touching anything, which is now the standing rule for this batch.

FALSE — "auth-client.ts is twelve lines of pure re-export". It configures the client: baseURL derived from window.location, and the anonymousClient plugin the demo button needs. Ten modules import it. Deleting it would scatter that configuration across all ten. It passes the deletion test; kept.

FALSE — "four of five exports are one-line re-exports". Two are: exportDatabase and exportAll. importNotion maps the result into ImportResult, exportPage branches on includeDatabases, and importNotionZip is the substance. The two genuine re-exports are also the handler layer's interface for the RPC surface — deleting them makes rpc-handlers reach past the module into export/page.js, which is worse than the duplication. Kept, deliberately.

ALREADY DONE — _allowedOrigin was corrected in NOT-108, where it was renamed, exported and given a second consumer.

TRUE, and worth more than the ticket implied — reportError taking an Error. Eight sites did reportError(new Error(cause.toString())), which threw away the original error's type and stack and the Cause's structure. What reached PostHog was a synthetic Error whose stack pointed at the line that built it.

causeToReport squashes the Cause so the thrown object arrives with its own stack, and carries the pretty-printed cause as context because squashing loses the shape — a parallel failure keeps only one branch.

Writing its tests found a real defect that was not in the ticket: Cause.squash THROWS on an interrupt-only cause. Reporting a cancelled request would have crashed the error reporter, on the one path least able to afford it. Interruption is now checked first and labelled rather than squashed, so the noise is filterable instead of fatal.

AC 1 is left unchecked: nothing was deleted, because nothing that the ticket named as deletable actually was.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Deepen the error reporter; delete nothing, because nothing named was deletable.

Two of the ticket's four claims did not survive checking. auth-client.ts is not a re-export — it configures baseURL and the anonymous plugin for ten consumers. importExport.ts has two genuine one-line re-exports rather than four, and those two are the handler layer's interface: deleting them makes rpc-handlers reach past the module. Both kept. _allowedOrigin was already fixed in NOT-108.

The fourth claim was true and larger than described. Eight sites reported failures as reportError(new Error(cause.toString())), discarding the original error's type and stack along with the Cause's structure — defect or failure, one branch or two. PostHog received a synthetic Error whose stack pointed at the line that built it.

causeToReport squashes the Cause so the thrown object arrives with its own stack, and carries the pretty-printed cause as context, because squashing keeps only one branch of a parallel failure. reportCause replaces all eight sites.

Writing the tests found a defect the ticket did not mention: Cause.squash throws on an interrupt-only cause, so reporting a cancelled request would have crashed the error reporter. Interruption is checked first and labelled rather than squashed.

Tests: 238 server pass / 0 fail (6 new), both type-checks clean, biome clean.
<!-- SECTION:FINAL_SUMMARY:END -->
