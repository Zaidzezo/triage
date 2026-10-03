# ─────────────────────────────────────────────────────────────
# 1. Dependencies
# ─────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS deps

WORKDIR /app

COPY package.json package-lock.json ./

COPY prisma/schema.prisma ./prisma/schema.prisma

RUN npm ci


# ─────────────────────────────────────────────────────────────
# 2. Build
# ─────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS builder

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY . .

RUN npx prisma generate --schema=prisma/schema.prisma

RUN npm run build


# ─────────────────────────────────────────────────────────────
# 3. Production runtime
# ─────────────────────────────────────────────────────────────

FROM node:22-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN groupadd --system --gid 1001 nextjs \
    && useradd --system --uid 1001 --gid nextjs nextjs

COPY --from=builder /app/public ./public

COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

HEALTHCHECK \
  --interval=30s \
  --timeout=5s \
  --start-period=20s \
  --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]