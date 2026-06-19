# Base image: Node 20 on Debian (not Alpine) for better compatibility and debugging tools
FROM node:20-bookworm-slim

# Install useful debugging/admin utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    # Networking tools
    curl \
    wget \
    net-tools \
    iputils-ping \
    dnsutils \
    netcat-openbsd \
    # Process tools
    procps \
    htop \
    # Text/file tools
    vim-tiny \
    less \
    jq \
    # Database client (for debugging PostgreSQL)
    postgresql-client \
    # General utilities
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files first (better layer caching)
COPY package*.json ./

# Install all dependencies (including devDependencies for build).
# Use `npm install` (not `npm ci`) so the build tolerates minor lockfile drift
# e.g. optional native deps of `ws` like bufferutil/utf-8-validate.
RUN npm install --no-audit --no-fund

# Copy source code
COPY . .

# Build the application. Raise Node's heap so the Vite build doesn't OOM on small
# droplets — this relies on swap being enabled on the host (see DEPLOY.md step 3).
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

# NOTE: we intentionally KEEP dev dependencies so `npm run db:push` (drizzle-kit)
# is available inside the container for first-time schema setup / migrations.
# (For a leaner image later, switch to committed drizzle migrations + drizzle-orm's
# runtime migrator, then re-enable: RUN npm prune --production)

# Expose the app port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Run as non-root user for security
RUN useradd -m -s /bin/bash photon && chown -R photon:photon /app
USER photon

CMD ["npm", "start"]
