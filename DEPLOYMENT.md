# TripNest — Production Deployment Guide

This document provides step-by-step instructions for building, configuring, migrating, and deploying TripNest to production environments.

---

## 1. System Architecture Overview

```
[ Client Browser ]
       │
       ├──► [ Frontend SPA (Vite / React) ]
       │          │
       │          ▼ (HTTPS / REST API / WebSockets)
       └────► [ Backend API (Express / Node.js) ]
                      │
                      ├──► [ PostgreSQL Database ] (Prisma ORM)
                      ├──► [ Local Disk / S3 Object Storage ] (Photo Uploads)
                      ├──► [ SMTP Mail Server ] (Nodemailer / Gmail / SendGrid)
                      ├──► [ Local Ollama AI ] (Optional, localhost:11434)
                      └──► [ External Free APIs ] (Open-Meteo, Nominatim, OpenFreeMap, OSRM)
```

---

## 2. Production Environment Variable Template

Create a secure `.env` file on your hosting platform for the backend service. **Never commit `.env` to Git.**

```env
# Node & Environment
NODE_ENV="production"
PORT=4000

# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://<db_user>:<db_password>@<db_host>:5432/<db_name>?schema=public&sslmode=require"

# Security & Authentication
JWT_SECRET="<generate-at-least-32-character-random-secret>"
JWT_EXPIRES_IN="7d"

# CORS & Application URLs
CORS_ORIGIN="https://tripnest.yourdomain.com"
APP_URL="https://tripnest.yourdomain.com"

# Production SMTP Email Delivery
EMAIL_PROVIDER="smtp"
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER="noreply@yourdomain.com"
SMTP_PASSWORD="<your-16-character-app-password-or-smtp-key>"
EMAIL_FROM="TripNest <noreply@yourdomain.com>"

# Storage Backend Directory
UPLOADS_DIR="/var/data/uploads"

# Optional External Contact Email (Nominatim User-Agent)
TRIPNEST_CONTACT_EMAIL="ops@yourdomain.com"

# Optional Local AI Service URL (Defaults to http://localhost:11434 if unset)
OLLAMA_BASE_URL="http://localhost:11434"
OLLAMA_MODEL="llama3.2"
```

Frontend Environment Variable (Configured at build time):
```env
VITE_API_URL="https://api.tripnest.yourdomain.com"
```

---

## 3. Database Migration & Setup

Production database migrations MUST use `prisma migrate deploy`. Never use `prisma db push` in production.

### Migration Commands
```bash
cd backend
npm ci
npx prisma generate
npx prisma migrate deploy
```

### Database Backup Procedure
Before running migrations in production, create a standard PostgreSQL dump:
```bash
pg_dump -h <db_host> -U <db_user> -d <db_name> -F c -b -v -f "tripnest_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Database Recovery & Rollback Strategy
- **Application Failure Post-Migration**: If the new backend container fails to start after migration, revert backend code to the previous release. Schema changes are backward-compatible.
- **Migration Failure**: Restore database from the `pg_dump` backup file:
  ```bash
  pg_restore -h <db_host> -U <db_user> -d <db_name> -v --clean "tripnest_backup_<timestamp>.dump"
  ```

---

## 4. Backend Deployment & Health Checks

### Build & Start Commands
```bash
cd backend
npm ci
npm run build
npm start
```

### Container / Load Balancer Probes
- **Liveness Probe** (`/health`): Returns `HTTP 200` (`{ status: 'ok' }`). Verifies Node.js process is active.
- **Readiness Probe** (`/ready`): Returns `HTTP 200` (`{ status: 'ready' }`) if PostgreSQL `SELECT 1` succeeds; returns `HTTP 503` if DB is unreachable.

---

## 5. Frontend Deployment & SPA Fallback

### Build Command
```bash
cd frontend
npm ci
npm run build
```

### Static Hosting Configuration
Configure your web server (Nginx, Caddy, Vercel, Netlify) to rewrite all non-file requests to `/index.html` (SPA routing fallback):

#### Nginx Example:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

---

## 6. Email Production Readiness & SMTP Setup

### Gmail SMTP QA & Testing
For testing real email delivery before domain authorization:
1. Enable 2-Step Verification on Google Account.
2. Generate a 16-character **App Password** under Google Account Security.
3. Set `EMAIL_PROVIDER="smtp"`, `SMTP_HOST="smtp.gmail.com"`, `SMTP_PORT=587`, `SMTP_PASSWORD="<app-password>"`, and `EMAIL_FROM="TripNest <your-gmail>"`.

### Production Domain Email Delivery (SendGrid, Postmark, AWS SES)
When sending from a custom domain (e.g. `noreply@yourdomain.com`):
- Configure **SPF** records (`v=spf1 include:sendgrid.net ~all`).
- Configure **DKIM** CNAME records provided by your email service.
- Configure **DMARC** TXT record (`v=DMARC1; p=quarantine;`).

---

## 7. Storage Requirements

TripNest currently stores uploaded memory photos on disk in `UPLOADS_DIR`.
- **Persistent Disk Hosts (Render Disks, AWS EBS, Railway Volumes)**: Mount a persistent volume at `/var/data/uploads` and set `UPLOADS_DIR="/var/data/uploads"`.
- **Stateless Hosts (Vercel, Heroku, AWS Fargate)**: Local files will reset on restart. For stateless environments, swap `LocalDiskStorage` for an S3/Cloud Storage provider implementing `ObjectStorage`.

---

## 8. Ollama AI Service Requirements

TripNest AI connects to Ollama via `OLLAMA_BASE_URL` (`http://localhost:11434` by default).
- **Private Cloud AI Container**: Run an Ollama container (`ollama/ollama`) alongside the backend on your private network.
- **Graceful Fallback**: If Ollama is not deployed or unreachable, TripNest AI returns `available: false`. The frontend displays an interactive setup guide without breaking any core trip planning features.

---

## 9. External Free API Dependencies & Fallbacks

| Service | Provider | Purpose | Rate Limit / Usage | Failure Fallback |
| :--- | :--- | :--- | :--- | :--- |
| **Geocoding** | Nominatim (OSM) | Place search & coordinates | 1 req/sec max (User-Agent header sent) | Manual coordinate entry |
| **Weather** | Open-Meteo | Forecasts & WMO codes | Free public API | Offline weather warning badge |
| **POI Discovery** | Overpass API | Recommendations & categories | Public Overpass endpoints | Empty recommendation state |
| **Map Tiles** | OpenFreeMap / MapLibre | Interactive maps | Public vector tiles | Map fallback state |
| **Routing** | OSRM / Haversine | Distance & travel times | OSRM public / client Haversine math | Straight-line distance fallback |

---

## 10. Deployment Platform Recommendations

| Hosting Platform | Frontend | Backend | Database | Storage |
| :--- | :--- | :--- | :--- | :--- |
| **Render** | Static Site | Web Service | Managed PostgreSQL | Persistent Disk |
| **Railway** | Static Site | Service | PostgreSQL Plugin | Railway Volume |
| **AWS** | S3 + CloudFront | ECS / App Runner | RDS PostgreSQL | EBS / S3 Bucket |
| **Vercel + Supabase** | Vercel SPA | Node.js Serverless | Supabase Postgres | S3 / Cloudinary |
