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

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Prune devDependencies after build
RUN npm prune --production

# Expose the app port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Run as non-root user for security
RUN useradd -m -s /bin/bash photon && chown -R photon:photon /app
USER photon

CMD ["npm", "start"]
