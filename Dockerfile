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
WORKDIR /app
RUN npm install -g pnpm@latest

# Accept UID and GID as build arguments
ARG USER_UID=1000
ARG USER_GID=100

# The node:20-alpine image already has a "node" user with UID 1000
# We'll use that user and add them to the specified GID group
RUN GROUP_NAME=$(getent group ${USER_GID} | cut -d: -f1) && \
    if [ -z "$GROUP_NAME" ]; then \
        addgroup -g ${USER_GID} appgroup; \
        GROUP_NAME=appgroup; \
    fi && \
    addgroup node ${GROUP_NAME}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Rebuild native modules BEFORE changing ownership and switching users
RUN cd /app/node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 && npm run build-release

# Create .next directory with proper permissions
RUN mkdir -p /app/.next && chown -R ${USER_UID}:${USER_GID} /app/.next

# Change ownership of the app directory to node user
RUN chown -R ${USER_UID}:${USER_GID} /app

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Switch to the node user
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
