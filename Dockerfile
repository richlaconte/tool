# syntax=docker/dockerfile:1

FROM node:24.18.0-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED="1"
WORKDIR /app
RUN corepack enable

FROM base AS deps
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm build
RUN pnpm prune --prod

FROM node:24.18.0-bookworm-slim AS runner
ENV NODE_ENV="production"
ENV HOSTNAME="0.0.0.0"
ENV PORT="3000"
ENV NEXT_TELEMETRY_DISABLED="1"
ENV TOOL_DATABASE_PATH="/data/tool.sqlite"
ENV TOOL_YJS_DATABASE_PATH="/data/collaboration.sqlite"
WORKDIR /app
RUN mkdir -p /data && chown -R node:node /data /app
COPY --from=builder --chown=node:node /app/package.json ./package.json
COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/.next ./.next
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/next.config.ts ./next.config.ts
USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
