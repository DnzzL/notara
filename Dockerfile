# ============================================================
# notion-alt — Nix-reproducible Docker build
# ============================================================
# Build:  docker build -t notion-alt .
# Run:    docker run -p 3000:3000 -v notion-data:/data notion-alt
# ============================================================

# --- Stage 1: Build with Nix-pinned toolchain ---
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Copy dependency manifests first (Docker layer cache)
COPY package.json bun.lock bunfig.toml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/

# Install deps (no --frozen-lockfile to allow platform-specific native module resolution)
RUN rm -f bun.lock && bun install --no-cache

# Copy source
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src/ ./packages/shared/src/
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src/ ./packages/server/src/
COPY packages/server/migrations/ ./packages/server/migrations/
COPY packages/app/tsconfig.json ./packages/app/
COPY packages/app/vite.config.ts ./packages/app/
COPY packages/app/index.html ./packages/app/
COPY packages/app/src/ ./packages/app/src/

# Build all workspaces
RUN cd packages/shared && bun run build
RUN cd packages/server && bun run build
RUN cd packages/app && bun run build

# --- Stage 2: Minimal runtime ---
FROM oven/bun:1-alpine

WORKDIR /app

# Copy runtime node_modules from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules 2>/dev/null || true

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
