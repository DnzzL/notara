FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace manifests and lockfile
COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
COPY packages/electron/package.json ./packages/electron/

RUN bun install --frozen-lockfile

# Build shared types
COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src/ ./packages/shared/src/
RUN cd packages/shared && bun run build

# Build server
COPY packages/server/tsconfig.json ./packages/server/
COPY packages/server/src/ ./packages/server/src/
COPY packages/server/migrations/ ./packages/server/migrations/
RUN cd packages/server && bun run build

# Build frontend
COPY packages/app/tsconfig.json ./packages/app/
COPY packages/app/vite.config.ts ./packages/app/
COPY packages/app/index.html ./packages/app/
COPY packages/app/src/ ./packages/app/src/
RUN cd packages/app && bun run build

# Runtime
FROM oven/bun:1-slim
WORKDIR /app

# Copy node_modules from builder to avoid re-installing across workspace packages
COPY --from=builder /app/node_modules ./node_modules
# Remove heavy electron binary — not needed for server runtime (~280MB saved)
RUN rm -rf ./node_modules/electron

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/migrations ./packages/server/migrations
COPY --from=builder /app/packages/app/dist ./packages/app/dist

# Keep package manifests for module resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/server/package.json ./packages/server/

ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000
CMD ["bun", "run", "packages/server/dist/index.js"]
