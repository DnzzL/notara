# Contributing to Notara

Thanks for wanting to help. Notara is a **solo-maintained, fair-source** project
([FSL-1.1-ALv2](./LICENSE)), so the contribution rules are shaped to protect one thing:
your time. The worst outcome is you spending a weekend on a PR that gets closed. This
page exists to prevent that.

## The short version

| You want to… | Do this |
|--------------|---------|
| **Fix a bug** | Open a PR directly. A linked bug issue helps but isn't required. |
| **Fix a typo / docs** | Open a PR directly. |
| **Add a feature or change behavior** | **Open a [feature issue](https://github.com/dnzzl/notara/issues/new?template=feature_request.yml) first and wait for a 👍 from the author. Don't build before it's validated.** |

## Why features need an issue first

One person triages, reviews, and maintains this forever. A feature that doesn't fit the
product's direction — or that adds surface area the author can't commit to supporting —
will be declined *no matter how good the code is*. Validating the **idea** in an issue
before you write the **code** means:

- You don't waste effort on something that was never going to land.
- We agree on the user-facing behavior before implementation details muddy the discussion.
- Scope stays small on purpose. Notara's guiding constraint is *fewer features, done well* — not a pile of half-supported ones.

Unsolicited feature PRs (no approved issue) may be closed with a pointer back here. It's
not personal — it's the only way a one-person project survives past year one.

## Licensing of contributions

By submitting a contribution, you agree that your contribution is licensed under the
**Functional Source License, FSL-1.1-ALv2** — the same license as the project — and that,
like the rest of the code, it converts to Apache-2.0 two years after the release it ships in.

A [DCO](https://developercertificate.org/) sign-off is appreciated but not required — add
`-s` to your commit (`git commit -s`) to certify you wrote the change or have the right to
submit it under this license.

## Development

Setup, run, build, and test instructions live in the [README](./README.md#-development).
Before opening a PR, please make sure the standard checks pass:

```bash
bun test                                 # unit tests
bun --bun tsc --noEmit -p packages/server
bun --bun tsc --noEmit -p packages/app
```

Keep changes surgical: touch only what the fix/feature needs, and match the surrounding
style rather than reformatting adjacent code.

## Security

**Never** report a security vulnerability in a public issue. Email
**legrand.thomas5@hotmail.fr** instead.

## Ground rules

Be kind; assume good intent. Reviews are about the change, not the person.
