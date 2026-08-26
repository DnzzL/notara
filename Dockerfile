# ============================================================
# notara — Nix-reproducible Docker build
# ============================================================
# Build:  docker build -t notara .
# Run:    docker run -p 3000:3000 -v notion-data:/data notara
# ============================================================

# --- Stage 1: Build with Nix-pinned toolchain ---
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# scripts/patch-msgpackr.sh has a `#!/usr/bin/env bash` shebang and alpine ships
# only ash, so `bun run apply-patches` exits 127 without this.
RUN apk add --no-cache bash

# Copy dependency manifests first (Docker layer cache)
COPY package.json bun.lock bunfig.toml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
# The lockfile covers every workspace, so --frozen-lockfile needs all of their
# manifests present — even the ones this image doesn't build.
COPY packages/cli/package.json ./packages/cli/
COPY packages/electron/package.json ./packages/electron/

COPY scripts/ ./scripts/

# --ignore-scripts is belt and braces: this repo has no postinstall and no
# trustedDependencies, so nothing should run anyway. The msgpackr patch is
# applied explicitly rather than by a lifecycle hook — see CONTRIBUTING.md.
RUN bun install --frozen-lockfile --no-cache --ignore-scripts
RUN bun run apply-patches

# Copy source
# Every package tsconfig does `"extends": "../../tsconfig.base.json"`.
COPY tsconfig.base.json ./
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src/ ./packages/shared/src/
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src/ ./packages/server/src/
COPY packages/server/migrations/ ./packages/server/migrations/
COPY packages/app/tsconfig.json ./packages/app/
COPY packages/app/vite.config.ts ./packages/app/
COPY packages/app/index.html ./packages/app/
COPY packages/app/src/ ./packages/app/src/
# Vite copies public/ into dist/ verbatim. Without it the build silently
# succeeds and ships a dist with no favicons, no PWA icons and no hero video.
COPY packages/app/public/ ./packages/app/public/

# Build all workspaces
RUN cd packages/shared && bun run build
RUN cd packages/server && bun run build
RUN cd packages/app && bun run build

# --- Stage 2: Minimal runtime ---
FROM oven/bun:1-alpine

WORKDIR /app

# Copy runtime node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/migrations ./packages/server/migrations
COPY --from=builder /app/packages/app/dist ./packages/app/dist

# Copy package.json files (workspace resolution at runtime)
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/server/package.json ./packages/server/

# Data volume for SQLite
RUN mkdir -p /data
ENV NODE_ENV=production
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["bun", "run", "packages/server/dist/index.js"]
