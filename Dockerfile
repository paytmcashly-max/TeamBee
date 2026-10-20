# syntax=docker/dockerfile:1

# Keep the image and local development on the same pinned major/minor/patch
# runtime. The client build is included in the final image as a deployable
# artifact; the default process runs the API server.
FROM node:22.19.0-bookworm-slim AS client-build

WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM node:22.19.0-bookworm-slim AS server-dependencies

WORKDIR /app/server
COPY server/package*.json ./
COPY server/prisma ./prisma
RUN npm ci --omit=dev

FROM node:22.19.0-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PORT=5000
WORKDIR /app

COPY --from=server-dependencies /app/server/node_modules ./server/node_modules
COPY server/package*.json ./server/
COPY server/prisma ./server/prisma
COPY server/src ./server/src
COPY --from=client-build /app/client/dist ./client/dist

WORKDIR /app/server
EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 5000) + '/ready').then(r => { if (!r.ok) process.exit(1); }).catch(() => process.exit(1))"

CMD ["npm", "start"]
