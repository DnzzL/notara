FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock* ./
COPY packages/app/package.json packages/app/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile

COPY packages/shared packages/shared
RUN cd packages/shared && bun run build

COPY packages/app packages/app
RUN cd packages/app && bun run build

FROM nginx:alpine
COPY --from=base /app/packages/app/dist /usr/share/nginx/html
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
