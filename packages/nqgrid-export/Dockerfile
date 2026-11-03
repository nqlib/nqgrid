# syntax=docker/dockerfile:1
#
# nqgrid-export as a container: HTTP service by default, one-shot CLI when given arguments.
# Build from the repository root (the library is built from source):
#
#   docker build -f packages/nqgrid-export/Dockerfile -t nqgrid-export .
#   docker run --rm -p 127.0.0.1:8787:8787 nqgrid-export                       # serve
#   docker run --rm -i nqgrid-export --input - --format pdf < req.json > out.pdf  # one-shot
#
# The Playwright image ships Chromium for exactly one Playwright version: keep PLAYWRIGHT_VERSION,
# the image tag and the `playwright` npm package below in lockstep (currently 1.63.0).
ARG PLAYWRIGHT_VERSION=1.63.0

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 CI=1
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter "@nqlib/nqgrid-export..." \
 && pnpm --filter @nqlib/nqgrid run build \
 && pnpm --filter @nqlib/nqgrid-export run build \
 && pnpm --filter @nqlib/nqgrid-export deploy --prod --legacy /out

FROM mcr.microsoft.com/playwright:v${PLAYWRIGHT_VERSION}-noble
ARG PLAYWRIGHT_VERSION
ENV NODE_ENV=production \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_PATH=/opt/playwright/node_modules
# Inter matches the app typography (the HTML falls back to system fonts without it).
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-inter \
 && rm -rf /var/lib/apt/lists/*
# `playwright` is an optional peer of nqgrid-export; install the version matching the baked-in browsers.
RUN mkdir -p /opt/playwright \
 && cd /opt/playwright \
 && npm init -y >/dev/null \
 && npm install --omit=dev --no-audit --no-fund "playwright@${PLAYWRIGHT_VERSION}"
WORKDIR /app
COPY --from=build /out /app
USER pwuser
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:8787/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["node", "/app/dist/cli.js"]
# Inside the container the service must listen on all interfaces; publish it on 127.0.0.1 (see above).
CMD ["serve", "--host", "0.0.0.0", "--port", "8787"]
