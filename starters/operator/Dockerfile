# syntax=docker/dockerfile:1
#
# Reference image for the Node operator (voyant#2966). Node is the first-class
# production target: the composed API graph is built once here and reused for the
# process lifetime, so the container serves warm requests instead of paying a
# per-request composition toll.
#
# This is a pnpm-monorepo build — run it from the REPO ROOT, pointing at this file:
#
#   docker build -f starters/operator/Dockerfile -t voyant-operator .
#   docker run --rm -p 8080:8080 --env-file starters/operator/.env voyant-operator
#
# The Vite build bundles the `@voyant-travel/*` workspace packages into the server
# bundle; all other deps stay external, so the runtime image ships the operator's
# production `node_modules` (via `pnpm deploy --prod`).

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /repo

# ── build: install the workspace, build the operator + its deps, and extract a
#    pruned production node_modules for the runtime stage. ─────────────────────
FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
# Only the operator is built: its Vite config bundles the `@voyant-travel/*`
# packages from SOURCE (the `development` resolve condition), so the whole
# dependency graph does NOT need to be prebuilt. Emits dist/client +
# dist/server/server.js.
RUN pnpm --filter operator build
# Self-contained prod install (real node_modules, no workspace symlinks).
RUN pnpm --filter=operator deploy --prod --legacy /deploy

# ── runtime: minimal image — the built app + its production node_modules. ─────
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /repo/starters/operator/dist ./dist
COPY --from=build /deploy/node_modules ./node_modules
COPY --from=build /repo/starters/operator/package.json ./package.json

# The platform supplies env (DATABASE_URL / DATABASE_URL_DIRECT, realm auth secrets,
# SESSION_CLAIMS_SECRET, INTERNAL_API_KEY, ORIGIN_TRUST_SECRET, APP_URL, …). The
# server reads PORT (default 8080) and exposes /healthz for container probes.
ENV PORT=8080
EXPOSE 8080
CMD ["node", "dist/server/server.js"]
