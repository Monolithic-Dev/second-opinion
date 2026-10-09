# One image, two commands (MCP server, simulator + console). See docker-compose.yml.
FROM node:22-slim AS build
# better-sqlite3 compiles from source when no prebuilt binary matches this Node version
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages ./packages
COPY apps ./apps
RUN npm ci
RUN npm run build:web

FROM node:22-slim
ENV NODE_ENV=production HOST=0.0.0.0
WORKDIR /app
COPY --from=build /app /app
COPY scripts ./scripts
COPY data ./data
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
EXPOSE 3000 3001
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT_CHECK||3001)+'/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["npx", "tsx", "apps/mcp-server/src/index.ts"]
