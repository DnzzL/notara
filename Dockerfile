FROM oven/bun:1 AS builder
WORKDIR /app

# Copy root config
COPY package.json ./
COPY bun.lock ./

# Copy all workspace package.json files
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/

# Install all deps
RUN bun install --frozen-lockfile

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

# Build everything
RUN cd packages/shared && bun run build
RUN cd packages/server && bun run build
RUN cd packages/app && bun run build

# Runtime
FROM oven/bun:1-slim
WORKDIR /app

COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/

RUN bun install --frozen-lockfile --production

# Copy built output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/migrations ./packages/server/migrations
COPY --from=builder /app/packages/app/dist ./packages/app/dist

RUN mkdir -p /data
ENV DATA_DIR=/data

EXPOSE 3000
CMD ["bun", "run", "packages/server/dist/index.js"]
