# syntax=docker/dockerfile:1
FROM node:22-alpine AS build
WORKDIR /app
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client
COPY client/ ./client/
RUN npm run build --prefix client

FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    PORT=3001 \
    DB_PATH=/data/virasa.db \
    UPLOAD_DIR=/data/uploads
WORKDIR /app
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server --omit=dev
COPY server/ ./server/
COPY --from=build /app/client/dist ./client/dist

# Seed idempotently on first start, then serve the API + built client.
WORKDIR /app/server
VOLUME ["/data"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["sh", "-c", "node seed.js && node index.js"]
