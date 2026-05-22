# ApexTrace (Overwolf)

**Repository:** https://github.com/sjbong0904/ApexTrace-app

Apex Legends match tracking and stats overlay for [Overwolf](https://www.overwolf.com/).

This repository contains the **Overwolf desktop app** (React + Vite). It does **not** include the Vercel-hosted API proxy; keep that in your separate Vercel-linked repo (`trace-proxy-server`).

## Requirements

- Node.js 20+
- Overwolf client (for running the unpacked extension)
- Supabase project with `public.languages` and related schema (`supabase/migrations`)

## Setup

```bash
npm install
cp .env.example .env   # optional; only needed for seed:languages
npm run dev            # Vite dev server
npm run build          # Output to dist/ — load via Overwolf unpacked extension
```

## i18n

- **Runtime:** translations are loaded from Supabase `languages` (see `src/lib/loadLanguages.ts`).
- **Source of truth in Git:** `scripts/locale-seeds/*.json`
- **Push to Supabase:** `npm run seed:languages` (requires `SUPABASE_SERVICE_ROLE_KEY` or temporary RPC grant)
- **Regenerate zh-TW from zh-CN:** `node scripts/generate-zh-tw.mjs`
- **Lang codes:** BCP 47 style (`zh-CN`, `es-ES`, `pt-BR`, …)

## Project layout

| Path | Purpose |
|------|---------|
| `src/` | React UI |
| `public/background/` | Overwolf background controller |
| `manifest.json` | Overwolf app manifest |
| `scripts/locale-seeds/` | Translation JSON (seed source) |
| `supabase/migrations/` | Database schema migrations |

## Related repos

- **Vercel / Mozambique proxy API** — deploy separately; do not mix with this Overwolf app repo.
