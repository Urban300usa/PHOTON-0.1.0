# Deploying PHOTON to DigitalOcean

One droplet runs the whole stack — **Postgres + the Node server (which also serves the
web app) + Caddy** (automatic HTTPS, WebSocket-ready). The **web version** is just the
droplet's URL, and the **desktop app** runs in "thin-client" mode pointed at the same URL.
So one deploy powers both, and chat/realtime works across all users.

```
Internet ──443──> Caddy ──> app:5000 (Express: API + web app + /ws/chat) ──> db:5432 (Postgres)
```

---

## 1. What size droplet? (≈ two dozen users to start)

The runtime load for 24 users is **very light** — the heaviest moments are bursty ESI
syncs and the Docker image build itself (Vite compiles ~3,400 modules and peaks around
1–1.5 GB RAM).

| Droplet | Price | Verdict |
|---|---|---|
| 1 GB / 1 vCPU | ~$6/mo | Runs fine for 24 users, **but the build can OOM** — only viable with a swap file, and builds are slow. |
| **2 GB / 2 vCPU** ⭐ | **~$18/mo** | **Recommended start.** Builds comfortably, big runtime headroom (realistically handles 100s of users for this workload). |
| 4 GB / 2 vCPU | ~$24/mo | Overkill at this stage; easy upgrade later if you grow. |

**Recommendation:** a **Basic / Regular 2 GB, 2 vCPU, 60 GB SSD** droplet (Ubuntu 24.04 LTS),
plus a 2 GB swap file (step 3) as a safety net. Postgres on the same box is fine to start;
move to **DigitalOcean Managed Postgres** (~$15/mo, automated backups) only when you want
hands-off DB ops.

---

## 2. Before you start
- A **domain** (or subdomain) you can point at the droplet, e.g. `photon.yourdomain.com`. HTTPS is required by EVE SSO.
- An **EVE application** at <https://developers.eveonline.com> → note the **Client ID** and **Secret Key**, and the scopes PHOTON uses (wallet, assets, skills, industry, contracts, planets, clones, killmails, characters read_*, markets read_character_orders, universe structures, search structures).
- A **DigitalOcean account** (you set this up — account, payment, and droplet creation can't be automated for you).

---

## 3. Create the droplet & basic hardening
1. Create the droplet (Ubuntu 24.04, 2 GB/2 vCPU), add your SSH key.
2. SSH in as root, then:
```bash
# Swap (build safety)
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab

# Firewall: SSH + web only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable

# Docker + compose plugin
curl -fsSL https://get.docker.com | sh
```

## 4. Point DNS at the droplet
In your DNS provider, add an **A record**: `photon` → the droplet's IP. (Wait for it to
resolve before step 6 so Caddy can get a cert.)

## 5. Get the code & configure
```bash
# The deployable code lives on the 'clean-main' branch
git clone -b clean-main https://github.com/Urban300usa/PHOTON-0.1.0.git photon && cd photon
cp .env.example .env
nano .env          # fill in DOMAIN, APP_URL, EVE_CLIENT_ID/SECRET, and the two secrets:
                   #   openssl rand -hex 24   -> POSTGRES_PASSWORD (also paste into DATABASE_URL)
                   #   openssl rand -hex 32   -> SESSION_SECRET
```
Set `APP_URL=https://photon.yourdomain.com` and `DOMAIN=photon.yourdomain.com`.

## 6. Launch
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
Caddy automatically provisions a Let's Encrypt certificate for your domain.

## 7. Create the database schema (first time only)
On the fresh, empty DB this runs without prompts (everything is a "create"):
```bash
docker compose -f docker-compose.prod.yml exec app npm run db:push
```
(If it ever asks create-vs-rename, choose **create**.)

## 8. Register the EVE OAuth callback
In your EVE application settings, add the callback URL:
```
https://photon.yourdomain.com/api/auth/callback
```
Visit `https://photon.yourdomain.com` and log in with EVE SSO to confirm.

✅ **The web version is now live.**

---

## 9. Desktop app (thin client)
The desktop build can point at the hosted server instead of bundling its own:
1. In `electron/main.ts`, set `DEFAULT_REMOTE_URL = "https://photon.yourdomain.com"`
   (or build/run with the env var `PHOTON_REMOTE_URL` set).
2. Build the installer:
```bash
npm run electron:dist
```
The resulting app launches as a window pointed at your hosted server — no local server,
shared data + realtime chat with web users. (Leave `DEFAULT_REMOTE_URL` empty for the
classic self-contained build that spawns a local server.)

---

## 10. Updates & maintenance
```bash
# Deploy new code
git pull && docker compose -f docker-compose.prod.yml up -d --build
# Apply any new schema changes
docker compose -f docker-compose.prod.yml exec app npm run db:push

# Logs
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml logs -f caddy

# Database backup (cron this daily)
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U photon photon > photon-$(date +%F).sql
```

## Notes
- **Secrets** live only in `.env` on the droplet (gitignored) and in your EVE app — never commit them.
- **Object storage** (`PRIVATE_OBJECT_DIR` / `PUBLIC_OBJECT_SEARCH_PATHS`) is optional; only needed if you use file uploads/exports → wire to **DigitalOcean Spaces** (S3-compatible).
- **Scaling past one box:** WebSocket chat broadcasts in-process, so multiple app instances would need sticky sessions or a Redis pub/sub. Not needed at this scale — one instance is plenty.
