FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
COPY packages/electron/package.json ./packages/electron/
# The lockfile covers every workspace, so --frozen-lockfile needs all of their
# manifests present — even the ones this image doesn't build.
COPY packages/cli/package.json ./packages/cli/
COPY bun.lock ./

# `bun run apply-patches` below runs scripts/patch-msgpackr.sh. That script patches
# @effect/platform, which Effect 4 folded into `effect` (ADR-011), so on a fresh
# install it finds nothing — kept until it is retired along with the CI step.
COPY scripts/ ./scripts/

# Install deps
# --frozen-lockfile: never let a build resolve its own dependency versions. Deleting
# the lockfile re-resolved @effect/platform-node-shared 4.0.0 -> 4.0.5, which imports
# `make` from effect/Path, an export missing from the effect@4.0.0 this repo pins —
# the server then died at module load and nginx served 502 on every /api/*.
# --ignore-scripts: simple-git-hooks' postinstall registers git hooks and aborts
# without a .git dir in this context, and no dependency lifecycle script belongs in
# an image build. The deliberate patch step is re-run explicitly below.
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run apply-patches

COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src/ ./packages/shared/src/
RUN cd packages/shared && bun run build

COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src/ ./packages/server/src/
COPY packages/server/migrations/ ./packages/server/migrations/
RUN cd packages/server && bun run build

FROM oven/bun:1-slim
WORKDIR /app

# Copy package manifests
COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/migrations ./packages/server/migrations

# Copy node_modules with all symlinks preserved
COPY --from=builder --link /app/node_modules ./node_modules
COPY --from=builder --link /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder --link /app/packages/server/node_modules ./packages/server/node_modules

# Remove electron
RUN rm -rf node_modules/electron node_modules/.bun/electron* packages/*/node_modules/electron 2>/dev/null || true

ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000
CMD ["bun", "packages/server/dist/index.js"]
