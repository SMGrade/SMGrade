# SMGrade

An AI-powered SwordMasters account grader. Users paste their bot `/stats` output and receive a deterministic score (0–100), letter grade (S+ to D), and an AI-generated written analysis comparing them to real players at their level.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/smgrade run dev` — run the frontend (port 23994)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Required env: `OPENAI_API_KEY` — for AI explanation generation

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS (artifacts/smgrade)
- API: Express 5 (artifacts/api-server)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- AI: OpenAI (`gpt-5-mini`) for written explanations only

## Where things live

- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/api-client-react/src/generated/` — generated React Query hooks
- `lib/api-zod/src/generated/` — generated Zod validation schemas
- `artifacts/smgrade/src/lib/benchmark.ts` — benchmark database built from real player data
- `artifacts/smgrade/src/lib/parser.ts` — Discord bot output parser
- `artifacts/smgrade/src/lib/scorer.ts` — deterministic scoring engine
- `artifacts/smgrade/src/lib/numberParser.ts` — SwordMasters number notation parser (K/M/B/T/QT/QNT/SXT...)
- `artifacts/api-server/src/routes/grade.ts` — AI explanation endpoint

## Architecture decisions

- Scoring is 100% deterministic — AI only writes the explanation after scores are computed.
- Benchmark data is hardcoded from real player logs (benchmark.ts) — no DB needed.
- Number parsing supports all SM suffixes: K, M, B, T, QT, QNT, SXT, SEP, OCT.
- Parser uses Discord formatting cleanup + field extraction by label matching.
- Scores are level-tier relative — low-level vs high-level players are never directly compared.

## Product

- Homepage: paste box for Discord bot output, immediately visible
- Result page: letter grade, score breakdown (Gear/Power/Progress/Wealth), player stats, top enemies, AI analysis
- Score categories: S+ S A+ A B+ B C+ C D (thresholds at 97/90/83/75/67/58/48/38)

## User preferences

_Populate as you build._

## Gotchas

- The benchmark power values in `benchmark.ts` are log-scale compared — absolute numbers vary enormously between tiers.
- The OpenAI model `gpt-5-mini` is used for cost efficiency on the explanation endpoint.
- The smgrade frontend passes result data via URL query param (base64 JSON), so there's no DB needed for results.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
