FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
COPY packages/electron/package.json ./packages/electron/

RUN bun install --frozen-lockfile

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
COPY package.json bun.lock tsconfig.base.json ./
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
