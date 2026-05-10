FROM oven/bun:1 AS builder
WORKDIR /app

# Copy workspace manifests and lockfile
COPY package.json bun.lock tsconfig.base.json ./
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

# Runtime stage
FROM oven/bun:1-slim
WORKDIR /app

# Copy all package manifests and lockfile
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
# We need shared's dist for the workspace dependency
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Install dependencies fresh in runtime (Bun handles this well)
# Exclude electron by not copying its package.json
RUN bun install --frozen-lockfile --production --ignore-scripts

# Copy built server and frontend
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/migrations ./packages/server/migrations
COPY --from=builder /app/packages/app/dist ./packages/app/dist

ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000
CMD ["bun", "packages/server/dist/index.js"]
