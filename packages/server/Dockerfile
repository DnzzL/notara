FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock* ./
COPY packages/server/package.json packages/server/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

# Build shared types
COPY packages/shared packages/shared
RUN cd packages/shared && bun run build

# Build server
COPY packages/server packages/server
RUN cd packages/server && bun run build

# Runtime
FROM oven/bun:1-slim
WORKDIR /app

RUN bun install --global npx

# Copy built output and dependencies
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared ./packages/shared
COPY --from=base /app/packages/server/dist ./packages/server/dist
COPY --from=base /app/packages/server/migrations ./packages/server/migrations

EXPOSE 3000

CMD ["bun", "run", "packages/server/dist/index.js"]
