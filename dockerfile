# ---------- BUILD STAGE ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files trước để cache
COPY server/package*.json ./server/
COPY client/package*.json ./client/

RUN cd server && npm install
RUN cd client && npm install

# Copy source
COPY server ./server
COPY client ./client

# Build client
RUN cd client && npm run build

# Build server (ts -> js)
RUN cd server && npm run build

# ---------- PRODUCTION STAGE ----------
FROM node:24-alpine

WORKDIR /app

# Copy built files
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/package*.json ./server/
COPY --from=builder /app/client/dist ./client/dist

# Install only production deps
RUN cd server && npm install --omit=dev

WORKDIR /app/server

EXPOSE 3000

CMD ["sh", "-c", "node dist/index.js $ARGS"]