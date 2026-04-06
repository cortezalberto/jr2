# Integrador Production Deployment Runbook

Operational guide for deploying and maintaining Integrador in production.

**Stack**: FastAPI + PostgreSQL + Redis + Nginx (TLS) + Docker Compose
**Capacity**: ~600 concurrent users (2x backend, 2x ws_gateway)

---

## Table of Contents

1. [Pre-deployment Checklist](#1-pre-deployment-checklist)
2. [First-time Deployment](#2-first-time-deployment)
3. [Routine Deployment (Updates)](#3-routine-deployment-updates)
4. [Rollback Procedure](#4-rollback-procedure)
5. [Monitoring Checks](#5-monitoring-checks)
6. [Emergency Procedures](#6-emergency-procedures)
7. [Security Checklist](#7-security-checklist)

---

## 1. Pre-deployment Checklist

Complete every item before proceeding to deployment.

### Infrastructure

- [ ] Server with Docker Engine 24+ and Docker Compose v2 installed
- [ ] Minimum 4 GB RAM, 2 vCPUs (recommended: 8 GB, 4 vCPUs)
- [ ] Ports 80 and 443 open in firewall
- [ ] Domain DNS A record pointing to server's public IP
- [ ] DNS propagation verified: `dig +short yourdomain.com` returns server IP

### Environment Configuration

- [ ] Copy `.env.example` to `.env` in `devOps/`:

```bash
cd devOps
cp .env.example .env
```

- [ ] Edit `.env` and set ALL values (no defaults are safe for production):

```bash
# Generate secrets (run on server)
openssl rand -hex 32   # Use output for JWT_SECRET
openssl rand -hex 32   # Use output for TABLE_TOKEN_SECRET
openssl rand -hex 16   # Use output for POSTGRES_PASSWORD
```

- [ ] Verify these critical values in `.env`:

| Variable | Requirement |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong, unique password |
| `JWT_SECRET` | At least 32 characters |
| `TABLE_TOKEN_SECRET` | At least 32 characters |
| `DOMAIN` | Your production domain (e.g., `app.myrestaurant.com`) |
| `CERT_EMAIL` | Valid email for Let's Encrypt notifications |
| `ALLOWED_ORIGINS` | `https://yourdomain.com` (with `https://` prefix) |
| `COOKIE_SECURE` | `true` |

### Backup

- [ ] If upgrading an existing deployment, take a backup first:

```bash
cd devOps
./backup/backup.sh
```

---

## 2. First-time Deployment

Run all commands from the project root unless otherwise specified.

### Step 1: Clone and configure

```bash
git clone <repository-url> integrador
cd integrador/devOps
cp .env.example .env
# Edit .env with production values (see Pre-deployment Checklist)
```

### Step 2: Obtain SSL certificates

```bash
export DOMAIN=yourdomain.com
export CERT_EMAIL=admin@yourdomain.com

# Optional: test with staging first (avoids rate limits)
# export STAGING=1

bash ssl/init-letsencrypt.sh
```

The script will:
1. Generate a temporary self-signed certificate
2. Start nginx
3. Request a real Let's Encrypt certificate
4. Reload nginx with the production certificate

### Step 3: Start all services

```bash
cd devOps
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Step 4: Apply database migrations

```bash
docker compose exec backend alembic upgrade head
```

### Step 5: Load seed data

```bash
docker compose exec backend python cli.py db-seed
```

This creates: default tenant, test users, allergens, sample menu, and tables.

### Step 6: Verify deployment

```bash
# Check all containers are running
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Test health endpoints
curl -s https://yourdomain.com/health | jq .
curl -s https://yourdomain.com/api/health | jq .

# Test HTTP -> HTTPS redirect
curl -sI http://yourdomain.com/ | head -3
# Expected: HTTP/1.1 301 Moved Permanently

# Test SSL certificate
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates
```

### Step 7: Configure automated backups

```bash
# Add to server crontab
crontab -e

# Daily backup at 3:00 AM
0 3 * * * cd /path/to/integrador/devOps && ./backup/backup.sh >> /var/log/integrador-backup.log 2>&1
```

See `devOps/backup/backup-cron.example` for more options.

---

## 3. Routine Deployment (Updates)

Use this procedure for deploying new code changes.

### Step 1: Pull latest code

```bash
cd /path/to/integrador
git fetch origin
git log --oneline HEAD..origin/main   # Review incoming changes
git pull origin main
```

### Step 2: Take a backup (if database migrations are included)

```bash
cd devOps
./backup/backup.sh
```

### Step 3: Rebuild images

```bash
cd devOps
docker compose -f docker-compose.yml -f docker-compose.prod.yml build
```

### Step 4: Apply migrations (if any)

```bash
# Check for pending migrations
docker compose exec backend alembic history --verbose | head -20
docker compose exec backend alembic current

# Apply migrations
docker compose exec backend alembic upgrade head
```

### Step 5: Rolling restart

```bash
cd devOps
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

Docker Compose will restart only containers whose images changed.

### Step 6: Verify

```bash
# Check all services are healthy
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Tail logs for errors
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=50 backend backend-2 ws_gateway ws_gateway_2

# Test endpoints
curl -s https://yourdomain.com/api/health | jq .
```

---

## 4. Rollback Procedure

### Code rollback (no migration changes)

```bash
cd /path/to/integrador
git log --oneline -10                  # Find the previous good commit
git checkout <previous-commit-hash>

cd devOps
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Code + migration rollback

```bash
# 1. Rollback migration (one step back)
cd devOps
docker compose exec backend alembic downgrade -1

# 2. Rollback code
cd /path/to/integrador
git checkout <previous-commit-hash>

# 3. Rebuild and restart
cd devOps
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### Full rollback from backup

If the situation is critical, restore from the last backup:

```bash
cd devOps
./backup/restore.sh backups/<latest-backup-file>.tar.gz
```

The restore script is interactive and will prompt for confirmation. It restores both PostgreSQL and Redis data.

---

## 5. Monitoring Checks

### Health endpoints

| Endpoint | Expected | What it checks |
|----------|----------|----------------|
| `GET /health` | `200 {"status":"healthy","service":"nginx"}` | Nginx is running |
| `GET /api/health` | `200` | Backend is responding |
| `GET /api/health/detailed` | `200` with dependency status | Backend + PostgreSQL + Redis |
| `GET /ws/health` | `200` | WebSocket gateway is responding |

```bash
# Quick health check (all endpoints)
curl -s https://yourdomain.com/health | jq .
curl -s https://yourdomain.com/api/health | jq .
curl -s https://yourdomain.com/api/health/detailed | jq .
```

### Expected response times

| Endpoint | Normal | Degraded | Critical |
|----------|--------|----------|----------|
| `/health` | < 5ms | < 50ms | > 100ms |
| `/api/health` | < 50ms | < 200ms | > 500ms |
| `/api/health/detailed` | < 100ms | < 500ms | > 1s |
| REST API (typical) | < 200ms | < 1s | > 2s |
| WebSocket connect | < 100ms | < 500ms | > 1s |

### Container health

```bash
cd devOps

# Check status of all containers
docker compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Check resource usage
docker stats --no-stream

# Check logs for errors
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 backend 2>&1 | grep -i error
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100 ws_gateway 2>&1 | grep -i error
```

### Database connectivity

```bash
# PostgreSQL
docker compose exec db pg_isready -U postgres -d menu_ops
# Expected: /var/run/postgresql:5432 - accepting connections

# Redis
docker compose exec redis redis-cli ping
# Expected: PONG

# Redis memory usage
docker compose exec redis redis-cli info memory | grep used_memory_human
```

### SSL certificate expiry

```bash
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null \
  | openssl x509 -noout -dates
# Certificates renew automatically; check that expiry is > 30 days out
```

---

## 6. Emergency Procedures

### 6.1 Database restore from backup

```bash
cd devOps

# List available backups
ls -la backups/

# Restore (interactive — will prompt for confirmation)
./backup/restore.sh backups/integrador_backup_YYYYMMDD_HHMMSS.tar.gz

# Verify after restore
docker compose exec backend alembic current
curl -s https://yourdomain.com/api/health/detailed | jq .
```

### 6.2 Redis flush (when safe)

Only flush Redis when there are no active user sessions. This will:
- Disconnect all WebSocket clients
- Invalidate all JWT blacklist entries
- Clear event catch-up history
- Clear rate limiting counters

```bash
# Check active WebSocket connections first
docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=20 ws_gateway | grep -i "connections"

# Flush Redis (all databases)
docker compose exec redis redis-cli FLUSHALL

# Restart services that depend on Redis
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend backend-2 ws_gateway ws_gateway_2
```

### 6.3 Force restart all services

```bash
cd devOps
docker compose -f docker-compose.yml -f docker-compose.prod.yml down
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

If containers are stuck:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml kill
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 6.4 SSL certificate emergency renewal

If the certificate has expired or is about to expire:

```bash
cd devOps

# Force renewal
docker compose -f docker-compose.yml -f docker-compose.prod.yml run --rm certbot renew --force-renewal

# Reload nginx with new certificate
docker compose -f docker-compose.yml -f docker-compose.prod.yml exec nginx nginx -s reload

# Verify new certificate dates
echo | openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null \
  | openssl x509 -noout -dates
```

If certbot fails (e.g., rate limited), generate a temporary self-signed cert to restore service:

```bash
# Re-run the init script (it will create a self-signed cert first, then attempt Let's Encrypt)
export DOMAIN=yourdomain.com
export CERT_EMAIL=admin@yourdomain.com
bash ssl/init-letsencrypt.sh
```

### 6.5 Disk space emergency

```bash
# Check disk usage
df -h

# Clean Docker resources (unused images, containers, networks)
docker system prune -f

# Clean old backups (keep last 3)
cd devOps/backups
ls -t *.tar.gz | tail -n +4 | xargs rm -f

# Check PostgreSQL size
docker compose exec db psql -U postgres -d menu_ops -c "SELECT pg_size_pretty(pg_database_size('menu_ops'));"
```

---

## 7. Security Checklist

Run this checklist after every deployment and periodically (monthly).

### Secrets

- [ ] `JWT_SECRET` is at least 32 characters and randomly generated
- [ ] `TABLE_TOKEN_SECRET` is at least 32 characters and randomly generated
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] No default/development secrets in `.env` (`dev-secret-change-me` etc.)
- [ ] `.env` file is NOT committed to git (check `.gitignore`)

### Network

- [ ] `ALLOWED_ORIGINS` is set to exact production domain(s) only
- [ ] `DEBUG=false` in `.env`
- [ ] `ENVIRONMENT=production` in `.env`
- [ ] `COOKIE_SECURE=true` in `.env`
- [ ] pgAdmin is disabled (uses `debug` profile, not started by default)
- [ ] PostgreSQL port (5432) is NOT exposed to public internet
- [ ] Redis port (6379/6380) is NOT exposed to public internet

### SSL/TLS

- [ ] SSL certificate is valid and not expired
- [ ] HTTP redirects to HTTPS (test: `curl -sI http://yourdomain.com/`)
- [ ] HSTS header is present (test: `curl -sI https://yourdomain.com/ | grep -i strict`)
- [ ] Only TLSv1.2 and TLSv1.3 are enabled
- [ ] Certificate auto-renewal is working (certbot container is running)

### Application

- [ ] Default test user passwords have been changed or accounts removed
- [ ] Rate limiting is active on auth endpoints
- [ ] WebSocket origin validation is configured
- [ ] Server tokens are hidden (`server_tokens off` in nginx)

### Verification commands

```bash
# Check secrets are not defaults
grep -c "CHANGE_ME\|dev-secret\|change-me" devOps/.env
# Expected: 0

# Check TLS configuration
nmap --script ssl-enum-ciphers -p 443 yourdomain.com

# Check security headers
curl -sI https://yourdomain.com/api/health | grep -iE "strict-transport|x-frame|x-content-type|referrer-policy"
# Expected: All four headers present

# Check HTTP redirect
curl -sI http://yourdomain.com/ | head -1
# Expected: HTTP/1.1 301 Moved Permanently

# Check debug mode is off
curl -s https://yourdomain.com/api/nonexistent-endpoint | jq .
# Should NOT include stack traces or debug information
```

---

## Appendix: Service Architecture

```
Internet
  │
  ├─ :80  ──→ Nginx ──→ 301 redirect to :443
  │
  └─ :443 ──→ Nginx (SSL termination)
                ├─ /api/*  ──→ backend_1:8000 (least_conn)
                │              backend_2:8000
                ├─ /ws/*   ──→ ws_gateway_1:8001 (ip_hash)
                │              ws_gateway_2:8001
                └─ /health ──→ local 200

Internal:
  backend ──→ PostgreSQL :5432
  backend ──→ Redis :6379
  ws_gateway ──→ Redis :6379
  certbot ──→ Let's Encrypt ACME (port 80 challenge)
```

## Appendix: Key File Locations

| File | Purpose |
|------|---------|
| `devOps/.env` | Production secrets (never commit) |
| `devOps/.env.example` | Template for `.env` |
| `devOps/docker-compose.yml` | Base compose (dev) |
| `devOps/docker-compose.prod.yml` | Production overlay (scaling + SSL) |
| `devOps/nginx/nginx.conf` | Nginx config (HTTP only, dev) |
| `devOps/nginx/nginx-ssl.conf` | Nginx config (HTTPS, production) |
| `devOps/ssl/init-letsencrypt.sh` | SSL certificate bootstrap script |
| `devOps/certbot/conf/` | Let's Encrypt certificates (created at runtime) |
| `devOps/certbot/www/` | ACME challenge webroot (created at runtime) |
| `devOps/backup/backup.sh` | Backup script (PostgreSQL + Redis) |
| `devOps/backup/restore.sh` | Restore script (interactive) |
| `devOps/SCALING.md` | Horizontal scaling documentation |
