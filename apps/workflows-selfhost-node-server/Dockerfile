FROM node:20-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json .npmrc ./
COPY LICENSE NOTICE CHANGELOG.md README.md ./

COPY apps/workflows-selfhost-node-server/package.json apps/workflows-selfhost-node-server/package.json
COPY apps/workflows-selfhost-node-server/voyant-typescript-config.json apps/workflows-selfhost-node-server/voyant-typescript-config.json
COPY apps/workflows-selfhost-node-server/README.md apps/workflows-selfhost-node-server/README.md
COPY apps/workflows-selfhost-node-server/Dockerfile apps/workflows-selfhost-node-server/Dockerfile
COPY apps/workflows-selfhost-node-server/docker-compose.yml apps/workflows-selfhost-node-server/docker-compose.yml
COPY apps/workflows-selfhost-node-server/src apps/workflows-selfhost-node-server/src
COPY apps/workflows-selfhost-node-server/scripts apps/workflows-selfhost-node-server/scripts
COPY apps/workflows-selfhost-node-server/examples apps/workflows-selfhost-node-server/examples

COPY packages/workflows-orchestrator/package.json packages/workflows-orchestrator/package.json
COPY packages/workflows-orchestrator/voyant-typescript-config.json packages/workflows-orchestrator/voyant-typescript-config.json
COPY packages/workflows-orchestrator/src packages/workflows-orchestrator/src

COPY packages/workflows-orchestrator-node/package.json packages/workflows-orchestrator-node/package.json
COPY packages/workflows-orchestrator-node/voyant-typescript-config.json packages/workflows-orchestrator-node/voyant-typescript-config.json
COPY packages/workflows-orchestrator-node/README.md packages/workflows-orchestrator-node/README.md
COPY packages/workflows-orchestrator-node/src packages/workflows-orchestrator-node/src
COPY packages/workflows-orchestrator-node/drizzle packages/workflows-orchestrator-node/drizzle
COPY packages/workflows-orchestrator-node/drizzle.config.ts packages/workflows-orchestrator-node/drizzle.config.ts

COPY packages/workflows/package.json packages/workflows/package.json
COPY packages/workflows/voyant-typescript-config.json packages/workflows/voyant-typescript-config.json
COPY packages/workflows/src packages/workflows/src

COPY packages/typescript-config/package.json packages/typescript-config/package.json
COPY packages/typescript-config/*.json packages/typescript-config/

RUN pnpm install --frozen-lockfile \
  && pnpm --filter @voyantjs/workflows-selfhost-node-server build \
  && pnpm --filter @voyantjs/workflows-selfhost-node-server deploy /opt/app \
  && chmod +x /opt/app/scripts/docker-entrypoint.sh

FROM node:20-bookworm-slim AS runtime

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mkdir -p /app/workflows

COPY --from=build /opt/app /app

EXPOSE 3232

ENTRYPOINT ["./scripts/docker-entrypoint.sh"]
CMD ["node", "./dist/server.js"]
