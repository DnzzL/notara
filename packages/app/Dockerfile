FROM oven/bun:1 AS builder
WORKDIR /app

COPY package.json bun.lock ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/app/package.json ./packages/app/
COPY packages/electron/package.json ./packages/electron/

RUN bun install --frozen-lockfile

COPY packages/shared/tsconfig.json ./packages/shared/
COPY packages/shared/src/ ./packages/shared/src/
RUN cd packages/shared && bun run build

COPY packages/app/tsconfig.json ./packages/app/
COPY packages/app/vite.config.ts ./packages/app/
COPY packages/app/index.html ./packages/app/
COPY packages/app/src/ ./packages/app/src/
RUN cd packages/app && bun run build

FROM nginx:alpine
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
