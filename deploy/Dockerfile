FROM node:24.15.0-bookworm-slim

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN npm install --global pnpm@10.33.2

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json eslint.config.mjs ./
COPY apps/api ./apps/api
COPY apps/agent ./apps/agent
COPY apps/worker ./apps/worker
COPY packages ./packages
COPY integrations ./integrations

RUN pnpm install --frozen-lockfile --prod \
    --filter @mandate/api... \
    --filter @mandate/agent... \
    --filter @mandate/worker... \
    && pnpm store prune \
    && chown -R node:node /app /pnpm

ENV NODE_ENV=production

USER node
