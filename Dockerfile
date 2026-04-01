# Multi-stage build
#
# better-sqlite3 is a native Node.js module that must be compiled for the
# exact target platform. We compile it in BOTH the deps stage (for the build)
# and recompile it in the runner stage (to guarantee the final binary matches
# the actual deployment platform — avoids QEMU cross-compilation mismatches).

FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
RUN npm_config_build_from_source=true npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
# Build tools are needed here to recompile better-sqlite3 for the exact
# target platform. Without this, QEMU cross-compilation can produce a binary
# that fails with "Exec format error" on real hardware.
RUN apk add --no-cache python3 make g++
RUN npm install -g node-gyp
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
# Recompile the native module for this exact platform
RUN cd /app/node_modules/better-sqlite3 && node-gyp rebuild
EXPOSE 3000
CMD ["node", "server.js"]
