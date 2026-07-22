# syntax=docker/dockerfile:1

# ---------- deps: install node modules ----------
FROM node:22-alpine AS deps
WORKDIR /app
# libc6-compat helps some native deps run on Alpine
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json* ./
RUN npm ci

# ---------- builder: build the Next.js app ----------
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# ----- Frontend / build-time environment -----
# Public values (safe to bake into the image) go here as build args.
# Add NEXT_PUBLIC_* vars if you introduce any; they are inlined at build time.
ENV NEXT_TELEMETRY_DISABLED=1
# Secrets (MONGODB_URI, JWT_SECRET) are NOT set here — they are provided at
# runtime by Google Cloud Run. This app has no DB access during `next build`,
# so no database secret is required to build the image.

RUN npm run build

# ---------- runner: minimal production image ----------
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run injects PORT (default 8080). The Next.js standalone server honors it.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0

# Run as a non-root user
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Copy the standalone server, static assets and public files
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 8080

# server.js is produced by Next.js standalone output
CMD ["node", "server.js"]
