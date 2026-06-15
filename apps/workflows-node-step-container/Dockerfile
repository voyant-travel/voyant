# Legacy image for external Node step execution. The workflow bundle can
# be baked in at build time or resolved per dispatch from a signed URL. See
# `apps/workflows-node-step-container/README.md`.

FROM node:20-slim AS builder
WORKDIR /build

# Install deps against the monorepo's pnpm workspace.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages ./packages
COPY apps/workflows-node-step-container ./apps/workflows-node-step-container
RUN corepack enable && \
    pnpm install --frozen-lockfile --filter @voyant-travel/workflows-node-step-container...
RUN pnpm --filter @voyant-travel/workflows-node-step-container build

# ---- Runtime image ----
FROM node:20-slim AS runtime
WORKDIR /app
COPY --from=builder /build/apps/workflows-node-step-container/dist ./dist
COPY --from=builder /build/apps/workflows-node-step-container/node_modules ./node_modules
COPY --from=builder /build/packages ./packages

# The workflow bundle. The orchestrator deploy pipeline stages it
# into `apps/workflows-node-step-container/bundle.mjs` (there's a placeholder
# checked in so Docker builds succeed locally). Build context is the
# monorepo root (see wrangler.jsonc's `image_build_context`).
COPY apps/workflows-node-step-container/bundle.mjs /app/bundle.mjs

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/server.js"]
