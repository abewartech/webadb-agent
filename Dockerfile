# ---- build stage: compile TypeScript ----
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/bridge/package.json packages/bridge/package.json
RUN npm ci

COPY packages/bridge/tsconfig.json packages/bridge/tsconfig.json
COPY packages/bridge/src packages/bridge/src
COPY packages/web packages/web
RUN npm run build -w @webadb-agent/bridge

# ---- runtime stage: production deps only, non-root ----
FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY packages/bridge/package.json packages/bridge/package.json
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/packages/bridge/dist ./packages/bridge/dist
COPY packages/web ./packages/web

RUN useradd --system --uid 10001 --gid nogroup --home /nonexistent --shell /usr/sbin/nologin webadb \
  && chown -R webadb:nogroup /app
USER webadb

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WEBADB_PORT||'8080')+'/api/health',{headers:{Authorization:'Bearer '+(process.env.WEBADB_TOKEN||'')}}).then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

ENTRYPOINT ["node", "packages/bridge/dist/index.js", "bridge"]
