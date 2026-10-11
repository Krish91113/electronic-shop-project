# Database Migration, Local Development & Deployment Guide

This guide establishes the database operations, migration lifecycle, local development workflow, and cloud deployment procedures for the **Electronics Shop Billing & Inventory Management System** using **Prisma ORM** and **Neon PostgreSQL**.

---

## 1. Architecture & Connection Overview

Neon provides serverless PostgreSQL with built-in connection pooling via PgBouncer. Because Prisma Client and Prisma Migrate interact differently with pooled connections, two database connection strings are configured:

| Environment Variable | Target Port / Endpoint | Purpose | Neon Connection String Format |
|---|---|---|---|
| `DATABASE_URL` | Pooled endpoint (`-pooler` subdomain, port 5432) | Normal application runtime queries by Express. Enables connection pooling for high concurrency and serverless scalability. | `postgresql://<user>:<password>@ep-<id>-pooler.<region>.aws.neon.tech/<dbname>?sslmode=require&channel_binding=require` |
| `DIRECT_URL` | Direct endpoint (standard compute subdomain, port 5432) | Prisma schema migrations (`prisma migrate deploy`, `prisma migrate status`, advisory locks). Direct connection avoids PgBouncer transaction-mode locking limitations. | `postgresql://<user>:<password>@ep-<id>.<region>.aws.neon.tech/<dbname>?sslmode=require` |

### Prisma Datasource Configuration (`backend/prisma/schema.prisma`)
```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

---

## 2. Local Development Setup (Windows PowerShell)

You have two supported approaches for local development:
1. **Dedicated Neon Development Branch** (Recommended: identical engine to cloud production, instant branching).
2. **Local PostgreSQL Instance** (Offline development).

### Option A: Dedicated Neon Development Branch
1. In the Neon Console, create a branch named `development` from your `production` branch (or run `neon branch create --name development`).
2. Copy the pooled and direct connection strings for the `development` branch.
3. Configure `backend/.env`:
   ```powershell
   DATABASE_URL="postgresql://neondb_owner:<dev_password>@ep-<dev-id>-pooler.<region>.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
   DIRECT_URL="postgresql://neondb_owner:<dev_password>@ep-<dev-id>.<region>.aws.neon.tech/neondb?sslmode=require"
   ```

### Option B: Local PostgreSQL
If running a local PostgreSQL service on Windows:
```powershell
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/electronics_shop_dev"
DIRECT_URL="postgresql://postgres:postgres@localhost:5432/electronics_shop_dev"
```

### Windows PowerShell Commands for Backend Setup

Execute these commands in Windows PowerShell from the repository root:

```powershell
# 1. Navigate to backend directory
cd backend

# 2. Install dependencies using lockfile
npm ci

# 3. Create .env from template (if not already present)
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# 4. Validate the Prisma schema
npx prisma validate

# 5. Generate Prisma Client
npm run prisma:generate

# 6. Apply existing migrations to your development database
npm run prisma:migrate:deploy

# 7. Check migration status
npm run prisma:migrate:status

# 8. Safe Idempotent Initialization (creates owner & 2 shops without deleting data)
npm run prisma:init:prod

# 9. (OPTIONAL - DEV ONLY) Destructive Demo Seeding (Clears all tables and loads sample inventory)
# DO NOT RUN ON PRODUCTION
# $env:ALLOW_DESTRUCTIVE_SEED="true"; npm run prisma:seed

# 10. Start the backend development server
npm run dev
```

---

## 3. Prisma Migration Lifecycle

### Principles
- **Migration SQL is Version-Controlled:** All schema evolutions live under `backend/prisma/migrations/<timestamp>_<name>/migration.sql`.
- **Never use `prisma db push` in production:** `db push` skips migration tracking and can silently drop columns or tables.
- **Never run `prisma migrate reset` in production:** Reset drops the entire database schema and deletes all data.
- **Stop Deployment on Migration Failure:** Failed migrations exit with a non-zero code, preventing an incompatible application instance from starting.

### Developing a New Schema Change (Development Only)
When you modify `backend/prisma/schema.prisma` during development:

1. Against your local PostgreSQL database or dedicated dev branch:
   ```powershell
   npx prisma migrate dev --name describe_your_change
   ```
2. Inspect the generated SQL in `backend/prisma/migrations/<timestamp>_describe_your_change/migration.sql`.
3. Commit the migration folder and `schema.prisma` to Git.

> **Note on Neon Cloud Branches & Shadow Databases:**  
> Cloud Neon does not permit standard users to execute `CREATE DATABASE` for temporary shadow databases. If developing directly against a Neon cloud branch, generate your migration SQL safely via:
> ```powershell
> npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script
> ```
> Save the migration script into a new migration folder under `prisma/migrations/`, verify it, and apply using `npx prisma migrate deploy`.

### Applying Migrations in Production
Production uses:
```bash
npx prisma migrate deploy
```
This command:
- Connects through `DIRECT_URL`.
- Checks the `_prisma_migrations` table for unapplied migrations.
- Applies pending migrations in order inside database transactions.
- Never prompts interactively and never creates shadow databases.

---

## 4. Production Deployment on Render

### Service Setup
Create a **Web Service** on Render with the following configuration:

- **Repository:** Your connected GitHub repository
- **Root Directory:** `backend`
- **Environment:** `Node`
- **Build Command:**
  ```bash
  npm ci && npx prisma generate
  ```
- **Pre-Deploy Command (Render Standard/Pro plans):**
  ```bash
  npx prisma migrate deploy
  ```
  *(If your Render plan does not support Pre-Deploy hooks, adjust the Start Command below).*
- **Start Command:**
  - With Pre-Deploy hook:
    ```bash
    node src/server.js
    ```
  - Without Pre-Deploy hook (safe sequenced startup):
    ```bash
    npx prisma migrate deploy && node src/server.js
    ```

### Required Render Environment Variables

| Variable | Value / Description | Example |
|---|---|---|
| `NODE_ENV` | `production` | `production` |
| `PORT` | `10000` (Render default) or custom | `10000` |
| `HOST` | `0.0.0.0` (Ensures Express listens on all interfaces) | `0.0.0.0` |
| `DATABASE_URL` | Neon pooled connection string | `postgresql://neondb_owner:***@ep-***-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require` |
| `DIRECT_URL` | Neon direct connection string | `postgresql://neondb_owner:***@ep-***.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require` |
| `JWT_SECRET` | 64+ hex characters generated via crypto | `generate with crypto.randomBytes(32).toString('hex')` |
| `COOKIE_SECRET` | 64+ hex characters | `generate with crypto.randomBytes(32).toString('hex')` |
| `CORS_ORIGIN` | Deployed Vercel frontend URL(s), comma-separated | `https://your-app.vercel.app` |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary account name | `your_cloud_name` |
| `CLOUDINARY_API_KEY` | Cloudinary API Key | `your_api_key` |
| `CLOUDINARY_API_SECRET` | Cloudinary API Secret | `your_api_secret` |
| `INIT_OWNER_EMAIL` | Initial owner email address | `owner@electronics.com` |
| `INIT_OWNER_PASSWORD` | Strong initial owner password for bootstrap | `YourStrongPassword123!` |
| `INIT_OWNER_NAME` | Initial owner display name | `Store Owner` |

### Post-Deployment Initial Bootstrap
To safely seed the initial Owner and two shops (`Electronics Hub - Main Street` and `Electronics Hub - Park Road`) without wiping any existing tables:
Run a one-time command in Render's **Shell**:
```bash
npm run prisma:init:prod
```
This script is completely idempotent: if the owner or shops already exist, it preserves all existing records and makes no destructive changes.

---

## 5. Frontend Integration on Vercel

The frontend is a Vite + React + TypeScript Single Page Application. It **never** connects directly to PostgreSQL or Neon.

### Vercel Configuration
1. Set Root Directory to: `frontend`
2. Framework Preset: `Vite`
3. Environment Variables:
   - `VITE_API_BASE_URL`: `https://your-backend.onrender.com` (Your Render backend URL without trailing slash)
   - `VITE_PUBLIC_SHOP_SLUG`: `electronics-hub-main`
4. Build Command: `npm run build`
5. Output Directory: `dist`

---

## 6. Backup and Recovery Strategy for Neon PostgreSQL

### 1. Instant Neon Branching (Zero-Downtime Point-in-Time Snapshots)
Neon uses Copy-on-Write storage, allowing near-instant point-in-time branches:
- **Pre-Migration Safety Branch:** Before applying any major schema migrations, create a backup branch in Neon:
  ```bash
  # Using Neon CLI or Web Console
  neon branch create --name pre-migration-backup --branch production
  ```
- If an unexpected error occurs during application upgrade, you can immediately switch your connection strings to point to `pre-migration-backup` with zero data loss.

### 2. Logical Backups (`pg_dump`)
Regardless of hosting plan, maintain scheduled off-site logical backups:
```powershell
# Backup database (direct endpoint)
pg_dump "postgresql://neondb_owner:<password>@ep-<direct-id>.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require" -F c -b -v -f "electronics_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').dump"

# Restore database from backup
pg_restore -d "postgresql://neondb_owner:<password>@ep-<target-id>.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require" -v -c "electronics_backup.dump"
```

### 3. Plan Limitations & Retention
- **Neon Free Tier:** Offers point-in-time recovery (PITR) with up to 24 hours of history. Branch limits typically apply (up to 10 branches).
- **Neon Launch / Scale Plans:** Provides up to 7–30 days of configurable PITR history and automated continuous backups.
