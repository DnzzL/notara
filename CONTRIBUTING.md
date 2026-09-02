# Contributing to Notara

Thanks for wanting to help. Notara is a **solo-maintained, copyleft** project
([AGPL-3.0-or-later](./LICENSE)), so the contribution rules are shaped to protect one thing:
your time. The worst outcome is you spending a weekend on a PR that gets closed. This
page exists to prevent that.

## The short version

| You want to… | Do this |
| -------------- | --------- |
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
**GNU Affero General Public License v3.0 or later** — the same license as the project.
Inbound equals outbound: there is no CLA and no copyright assignment, so your contribution
stays yours under the same terms everyone else gets.

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

### Installing does not run code

`bun install` in this repo executes nothing. There is no `postinstall`, and
`bunfig.toml` sets `ignoreScripts = true`, so Bun skips every dependency lifecycle
script — including for packages on Bun's own built-in default-trust list (an empty
`trustedDependencies` alone does not stop those; `ignoreScripts` does).

That is deliberate. A postinstall script is arbitrary code running with your credentials
and your network, triggered by a transitive version bump nobody read — the shape most
recent npm supply-chain compromises have taken.

The two things installing used to do are now one deliberate command:

```bash
bun run setup
```

It patches `@effect/platform`'s MsgPack export (an upstream bug that breaks `@effect/rpc`)
and registers the git hooks. Run it once after cloning, and again after a dependency
bump if the patch is undone.

**Do not add an entry to `trustedDependencies` without writing down why beside it**, and
do not reintroduce a root `postinstall` — the convenience is not worth the surface.

If a type-check fails in a way that makes no sense — a command TipTap clearly defines
reporting as missing, say — try a clean install before believing it:

```bash
rm -rf node_modules packages/*/node_modules && bun install && bun run setup
```

A stale `node_modules` can hold two copies of a package whose types augment each other,
so the augmentation lands on one copy and your code is typed against the other. That was
NOT-100.

## Security

**Never** report a security vulnerability in a public issue. Email
**<legrand.thomas5@hotmail.fr>** instead.

## Performance gates

Run before merging to catch regressions: `bun run pre-merge`

**Bundle-size** (`bash scripts/check-bundle-size.sh`, `bun run check-bundle-size`)

- Builds packages/app (Vite) + packages/shared (tsc) and compares output sizes
  against the baseline in `.github/bundle-sizes.json`.
- Fails if any tracked file grows by more than **10%** (configurable as first arg).
- Update baseline: rebuild and overwrite `.github/bundle-sizes.json`.

Be kind; assume good intent. Reviews are about the change, not the person.
