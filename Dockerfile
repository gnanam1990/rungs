# One service hosts everything: the keeper (indexer + read API) also serves the built site, /llms.txt and /skill.md.
# Build:  docker build --build-arg PUBLIC_URL=https://your-domain -t rungs .
# Run:    docker run -p 8787:8787 -v rungs-data:/data --env-file .env.keeper rungs
# No secrets are needed: the keeper only reads the chain. Never put DEPLOYER_PRIVATE_KEY in the host's settings.
FROM node:22-bookworm-slim

# better-sqlite3 normally downloads a prebuilt binary; these are its fallback build tools
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable

WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile

# The site calls the API on its own domain; the address is baked into the page and its Content-Security-Policy.
ARG PUBLIC_URL
RUN test -n "$PUBLIC_URL" || (echo "Build with --build-arg PUBLIC_URL=https://your-domain" >&2 && exit 1)
RUN VITE_KEEPER_URL="$PUBLIC_URL" pnpm --filter @rungs/web build

ENV NODE_ENV=production \
    WEB_DIST=/app/apps/web/dist \
    KEEPER_DB_PATH=/data/rungs.sqlite \
    PUBLIC_KEEPER_URL=$PUBLIC_URL \
    WEB_ORIGIN=$PUBLIC_URL
VOLUME /data
EXPOSE 8787
CMD ["pnpm", "--filter", "@rungs/keeper", "start"]
