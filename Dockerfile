# Multi-stage build for small final image
#
# better-sqlite3 is a native Node.js module that must be compiled for the
# target platform. We install build tools in the deps stage and force
# compilation from source so the binary matches linux/amd64 or linux/arm64.

FROM node:20-alpine AS deps
WORKDIR /app
# Build tools required to compile better-sqlite3 from source
RUN apk add --no-cache python3 make g++
COPY package*.json ./
# npm_config_build_from_source ensures native modules are compiled for the
# current target platform rather than using a downloaded prebuilt binary
RUN npm_config_build_from_source=true npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
