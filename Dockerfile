FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat git python3 make g++
WORKDIR /app

# Setup pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* .npmrc ./
RUN pnpm install --frozen-lockfile

# Development target with built native modules
FROM base AS dev
RUN apk add --no-cache libc6-compat git python3 make g++ bash curl sudo shadow

# Accept UID and GID as build arguments
ARG USER_UID=1000
ARG USER_GID=100

# Install pnpm as root first
RUN npm install -g pnpm@latest

# Create user and group early, then switch to that user
RUN GROUP_NAME=$(getent group ${USER_GID} | cut -d: -f1) && \
    if [ -z "$GROUP_NAME" ]; then \
        addgroup -g ${USER_GID} appgroup; \
        GROUP_NAME=appgroup; \
    fi && \
    addgroup node ${GROUP_NAME}

# Switch to node user to avoid permission issues
USER node
WORKDIR /app

# Copy node_modules as node user (already has correct permissions)
COPY --from=deps --chown=node:${USER_GID} /app/node_modules ./node_modules

# Copy source code as node user
COPY --chown=node:${USER_GID} . .

# Rebuild native modules for the container architecture
RUN cd /app/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release

# Create .next directory (already owned by node user)
RUN mkdir -p /app/.next

# Switch back to root to install Claude Code CLI globally, then back to node
USER root
RUN npm install -g @anthropic-ai/claude-code
USER node

EXPOSE 3000
CMD ["sh", "-c", "pnpm db:init && pnpm db:seed && pnpm dev"]

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache git python3 make g++ bash

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN pnpm db:generate

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/next-config-js/output
CMD HOSTNAME="0.0.0.0" node server.js
