# TRIPNEST — PRODUCTION BASELINE REPORT

## Metadata
- **Date**: 2026-09-19
- **Current Git Commit**: `cc9600cbd352d089f7134a9cf24d74c3d50f772b` (`fix(backend): run schema self-healing executeRawUnsafe in createApp`)
- **Branch**: `main` (tracking `origin/main`)
- **Frontend URL**: `https://trip-nest-eight-pied.vercel.app`
- **Backend URL**: `https://tripnest-zytu.onrender.com`
- **Database Provider**: Supabase PostgreSQL

## Current State & Diagnostics
- **Migration Status**:
  - `20260115000000_init`: Applied
  - `20260115000001_add_database_constraints`: Applied
  - `20260115000002_add_memory_photo`: Applied
  - `20260115000003_add_missing_schema_fields`: **FAILED** (Error `P3009` / PostgreSQL `42P01` `relation "PasswordResetToken" does not exist`)
- **Known Production Failures**:
  - Render startup command `npx prisma migrate deploy && node dist/server.js` fails during `prisma migrate deploy` due to failed entry in `_prisma_migrations`, causing Render to continuously restart before binding to PORT.
- **Known Infrastructure Limitations**:
  - **Render Free Tier**: Spins down after inactivity; initial request incurs ~50s cold-start penalty.
  - **Storage**: Ephemeral local filesystem on Render (`./uploads`); photo persistence across container restarts requires cloud storage or DB-backed URLs.
  - **AI / Ollama**: `OLLAMA_BASE_URL` set to `http://localhost:11434` refers to Render container localhost where Ollama daemon is not running. Cloud AI requires external provider endpoint.
  - **Email**: SMTP uses configurable environment; if unconfigured, email delivery degrades gracefully.

## Code Quality Baseline
- **Typecheck**: PASSED (`tsc --noEmit` 0 errors)
- **Lint**: 2 minor unused variable lint warnings in `server.ts` identified and fixed.
- **Tests**: Unit tests covering Auth, Expenses, Split strategies, Budget, Invites, and IDOR middleware.
