# API versioning and deprecation policy

## `/api/v1` is frozen

`/api/v1` only takes **additive** changes: new paths, new operations, new optional
request fields, new response fields, new enum values in responses.

These are breaking and never ship in v1: removing a path, operation or response field;
narrowing or changing a type; removing an enum value; a new required input (parameter,
body field, or a body that was optional). A breaking change needs `/api/v2`.

## Deprecation window

Something deprecated stays working for **2 minor releases or 6 months, whichever is
longer**. Only then may a removal ship, and only in a new major API version.

## How deprecations are announced

1. A `### Deprecated` entry in [CHANGELOG.md](../CHANGELOG.md), with the replacement and
   the earliest removal date.
2. `deprecated: true` on the operation or field in the OpenAPI document
   (`GET /api/v1/openapi.json`).

## Enforcement

`packages/server/test/openapi-breaking.test.ts` compares the live OpenAPI document with the
committed snapshot `packages/server/test/fixtures/openapi.snapshot.json` and fails on any
breaking change.

After an intentional **additive** change, refresh the snapshot and commit it:

```bash
UPDATE_OPENAPI_SNAPSHOT=1 bun test packages/server/test/openapi-breaking.test.ts
```

Never refresh it to silence a failure: a red test means a break, not a stale snapshot.
