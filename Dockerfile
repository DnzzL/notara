FROM oven/bun:1 AS base
WORKDIR /app

# Copy all package files
COPY package.json bun.lock* ./
COPY pnpm-workspace.yaml ./

# Copy individual package.json files
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/app/package.json packages/app/

# Install all dependencies
RUN bun install --frozen-lockfile

# Build shared types
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
RUN cd packages/shared && bun run build

# Build server
COPY packages/server/src packages/server/src
COPY packages/server/tsconfig.json packages/server/
COPY packages/server/migrations packages/server/migrations
RUN cd packages/server && bun run build

# Build frontend
COPY packages/app/src packages/app/src
COPY packages/app/tsconfig.json packages/app/
COPY packages/app/vite.config.ts packages/app/
COPY packages/app/index.html packages/app/
RUN cd packages/app && bun run build

# Runtime image
FROM oven/bun:1-slim
WORKDIR /app

# Install only production dependencies
COPY package.json bun.lock* ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
RUN bun install --frozen-lockfile --production

# Copy built output
COPY --from=base /app/packages/shared/dist packages/shared/dist
COPY --from=base /app/packages/server/dist packages/server/dist
COPY --from=base /app/packages/server/migrations packages/server/migrations
COPY --from=base /app/packages/app/dist packages/app/dist

# Create data directory for SQLite
RUN mkdir -p /data

ENV DATA_DIR=/data

EXPOSE 3000

CMD ["bun", "run", "packages/server/dist/index.js"]
