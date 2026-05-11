# ============================================================
# Stage 1: Nix-based build environment (fully reproducible)
# ============================================================
FROM nixos/nix:latest AS builder

WORKDIR /app

# Enable flakes and trust the nixpkgs input
RUN echo "experimental-features = nix-command flakes" >> /etc/nix/nix.conf
RUN echo "trusted-public-keys = cache.nixos.org-1:6NCHdD59X431o0gWypbMrAURkbJ16ZPMQFGspcDShjY=" >> /etc/nix/nix.conf

# Copy flake files first (Docker layer caching)
COPY flake.nix ./

# Initialize the flake (downloads nixpkgs, cached on subsequent builds)
RUN nix flake lock --no-update-lock-file 2>/dev/null || true

# Copy all source files
COPY . .

# Build using the Nix-defined shell environment
# This ensures exact versions of Bun, Node, Python, etc.
RUN nix develop --command bash -c "\
  echo 'Building with Bun: $(bun --version)'; \
  bun install --frozen-lockfile --no-cache; \
  cd packages/shared && bun run build && cd ../..; \
  cd packages/server && bun run build && cd ../..; \
  cd packages/app && bun run build && cd ../..; \
  echo 'Build complete'; \
"

# ============================================================
# Stage 2: Minimal runtime
# ============================================================
FROM oven/bun:1-alpine

WORKDIR /app

# Copy built artifacts from the Nix builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/node_modules ./packages/shared/node_modules 2>/dev/null || true
COPY --from=builder /app/packages/server/node_modules ./packages/server/node_modules 2>/dev/null || true
COPY --from=builder /app/packages/app/node_modules ./packages/app/node_modules 2>/dev/null || true

# Copy built output
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/server/migrations ./packages/server/migrations
COPY --from=builder /app/packages/app/dist ./packages/app/dist

# Copy package.json files for workspace resolution
COPY --from=builder /app/package.json ./
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/packages/server/package.json ./packages/server/
COPY --from=builder /app/packages/app/package.json ./packages/app/

# Create data directory
RUN mkdir -p /data

ENV NODE_ENV=production
ENV DATA_DIR=/data

EXPOSE 3000

CMD ["bun", "run", "packages/server/dist/index.js"]
