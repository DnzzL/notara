FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
COPY packages/electron/package.json ./packages/electron/

# The root package.json has a `postinstall: bash scripts/patch-msgpackr.sh`
# hook that patches a missing @effect/platform export; `bun run apply-patches`
# below runs it explicitly, so the scripts have to be here.
COPY scripts/ ./scripts/

# Install deps
# --ignore-scripts: the root postinstall runs `npx simple-git-hooks`, which needs a
# .git dir this context does not have, and simple-git-hooks' own postinstall aborts
# under the bun version in this image. Neither belongs in an image build; the
# msgpackr patch does, so it is applied explicitly.
RUN rm -f bun.lock && bun install --ignore-scripts
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
