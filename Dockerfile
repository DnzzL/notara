FROM oven/bun:1 AS builder
WORKDIR /app

# Copy everything
COPY . .

# Install and build
RUN bun install
RUN bun run --filter @notion-alt/shared build
RUN bun run --filter @notion-alt/server build
RUN bun run --filter @notion-alt/app build

# Runtime
FROM oven/bun:1
WORKDIR /app

# Copy manifests
COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/migrations ./packages/server/migrations
COPY --from=builder /app/packages/app/dist ./packages/app/dist

# Install production deps
RUN bun install --production

ENV DATA_DIR=/data
RUN mkdir -p /data

EXPOSE 3000
CMD ["bun", "packages/server/dist/index.js"]
