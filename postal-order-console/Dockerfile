# syntax=docker/dockerfile:1

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --no-audit --no-fund

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Public variables are inlined at build time.
ARG NEXT_PUBLIC_SERVER_URL
ARG NEXT_PUBLIC_WS_SERVER_URL
ARG NEXT_PUBLIC_WARN_MINUTES=5
ARG NEXT_PUBLIC_DANGER_MINUTES=10
ARG NEXT_PUBLIC_POLL_INTERVAL_MS=15000
ENV NEXT_PUBLIC_SERVER_URL=$NEXT_PUBLIC_SERVER_URL \
    NEXT_PUBLIC_WS_SERVER_URL=$NEXT_PUBLIC_WS_SERVER_URL \
    NEXT_PUBLIC_WARN_MINUTES=$NEXT_PUBLIC_WARN_MINUTES \
    NEXT_PUBLIC_DANGER_MINUTES=$NEXT_PUBLIC_DANGER_MINUTES \
    NEXT_PUBLIC_POLL_INTERVAL_MS=$NEXT_PUBLIC_POLL_INTERVAL_MS \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3002 \
    HOSTNAME=0.0.0.0
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3002
CMD ["node", "server.js"]
