FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
COPY packages/electron/package.json ./packages/electron/

# `bun run apply-patches` below runs scripts/patch-msgpackr.sh. That script patches
# @effect/platform, which Effect 4 folded into `effect` (ADR-011), so on a fresh
# install it finds nothing — kept until it is retired along with the CI step.
COPY scripts/ ./scripts/

# Remove lockfile to allow platform-specific resolution (Linux ARM64 in container)
# --ignore-scripts: simple-git-hooks' postinstall registers git hooks and aborts
# without a .git dir in this context, and no dependency lifecycle script belongs in
# an image build. The deliberate patch step is re-run explicitly below.
RUN rm -f bun.lock && bun install --ignore-scripts
RUN bun run apply-patches

COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src/ ./packages/shared/src/
RUN cd packages/shared && bun run build

COPY packages/app/tsconfig.json ./packages/app/
COPY packages/app/vite.config.ts ./packages/app/
COPY packages/app/index.html ./packages/app/
COPY packages/app/src/ ./packages/app/src/
# Vite copies public/ into dist/ verbatim. Without it the build silently
# succeeds and nginx serves a root with no favicons, no PWA icons and no hero
# video — every miss swallowed by the SPA fallback as a 200.
COPY packages/app/public/ ./packages/app/public/
RUN cd packages/app && bun run build

FROM nginx:alpine
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
