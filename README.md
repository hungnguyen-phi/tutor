# Tutor — Adaptive AI Tutor (Trường Việt Anh)

Multi-subject, multi-tenant adaptive AI tutoring platform. Pilot: **Toán 9–10** (objective + CAS + Socratic) and **Tiếng Anh** (objective MCQ + rubric writing + speaking). Built per PRD v4.0.

## Stack (free pilot — $0)
- **Frontend:** Next.js (App Router) **static export** → Cloudflare Workers Static Assets (free plan)
- **Chat serving:** Supabase Edge Functions (Deno) — `chat-turn`, `effort-gate`, `evaluate`, `evaluate-rubric`, `evaluate-speaking`, `guide`, `diagnose`
- **Async:** n8n (`n8n.truongvietanh.com`, self-hosted)
- **Data:** Supabase Postgres + pgvector + Storage + RLS (free tier); Drizzle ORM (+ raw SQL for KG core)
- **CAS:** mathjs / nerdamer (JS) for the Toán pilot
- **Speaking:** browser Web Speech API (pilot) → Azure Speech F0 free tier when phoneme scoring is needed
- **LLM Gateway:** provider-agnostic router — **OpenRouter free models** default (Claude adapter kept for later). The only place provider/keys appear.

> Secrets live in Supabase Edge Function secrets (`supabase secrets set …`) and local `.env` only — never in the public frontend or git.

## Monorepo layout
```
apps/web              Next.js app (OpenNext → Cloudflare Worker)
supabase/functions    Deno Edge Functions (sync chat path)
packages/db           Drizzle schema + KG-core SQL + RLS
packages/llm-gateway  Model router, budget, anonymize, cache
packages/pedagogy     Pure logic: effort-gate, mastery, Leitner, Socratic
packages/shared       Shared types/zod + KG types from KG_Schema_v2.json
packages/config       Shared tsconfig / subject config
n8n/workflows         Version-controlled workflow JSON
seed/kg               Seed knowledge graphs
```

## Getting started
```bash
pnpm install
cp .env.example .env        # fill secrets (do NOT commit)
pnpm db:push                # apply schema to Supabase (needs DATABASE_URL)
pnpm web:dev                # Next.js dev
```

> Working copy lives on Google Drive; for active dev, clone from GitHub to a local (non-Drive) path for faster installs:
> `git clone git@github.com:duong-edu/Tutor.git`

## Inviolable principles (PRD Part II)
Socratic / never give answers directly · effort gate · **evaluate agent separated from guide agent** · LLM never computes quantitative answers (CAS) · human-in-the-loop review before serving · safety flags via human verification, never auto to parents · PDPL (dual consent ≥7, withdraw → stop, anonymize before LLM, audit logs) · multi-provider gateway, no hard-coded provider/keys.
