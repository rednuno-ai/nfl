# NFL LIFE — Database Schema

Full SQL lives in `supabase/migrations/0001_init.sql` (schema + RLS) and
`0002_seed_world.sql` (placeholder for seeding fictional teams/colleges into
the DB — see the comment in that file for why it's a documented no-op for
now). This document explains the *shape* and the reasoning; read the
migration for exact column types and constraints.

## Design decision: JSONB state + normalized read tables

`CareerState` (`src/engine/career.ts`) is a large, deeply nested,
frequently-changing object — it advances every single in-game week. Two
options were considered:

1. **Fully normalize** every field into its own table/column.
2. **Store the authoritative state as JSONB**, and normalize only what needs
   independent querying (leaderboards, analytics, admin tooling).

We chose **option 2**. Rationale: the engine already defines a single,
strongly-typed source of truth for what a career looks like
(`src/engine/types.ts` + `career.ts`). Re-deriving an equivalent relational
shape and keeping two representations in lockstep on every autosave (which
happens every simulated week) would be slow, failure-prone, and would force
every engine change to also become a migration. Instead:

- `careers.state` (jsonb) is the full save — this is what the app reads and
  writes on every turn, in one round-trip.
- A handful of hot fields (`player_name`, `position`, `stage`, `age`,
  `overall`, `updated_at`) are promoted to real columns purely so the career
  picker screen can list saves with a fast indexed query instead of pulling
  every JSON blob.
- Everything that plausibly needs cross-career querying later —
  leaderboards, "how common is this outcome", admin/support tooling — gets
  its own normalized table, written by the same transaction that upserts
  `careers.state`: `player_stats`, `contracts`, `games`, `game_events`,
  `relationships`, `injuries`, `assets`, `finances`, `news`, `decisions`,
  `achievements`, `legacy_records`.

If a future phase needs the normalized tables to be the source of truth
(e.g., for a public stats/leaderboard product), the migration path is
additive: keep `careers.state` as the write path, backfill the normalized
tables from it, and gradually move specific read paths over.

## Tables

| Table | Purpose |
|---|---|
| `profiles` | App-specific user profile, keyed to `auth.users`. |
| `subscriptions` | Free/Premium tier — gates career-slot limits (item 50). |
| `teams` | Fictional NFL-analog league (32 teams). Public read. No real names/logos — see licensing note in `GAME_DESIGN.md`. |
| `colleges` | Fictional college football universe (30 programs). Public read. |
| `careers` | One row per save slot. `state` jsonb is authoritative. |
| `player_stats` | One row per season/level, denormalized from `state` for querying. |
| `contracts` | Contract history. |
| `games` / `game_events` | Per-game results and possession-level log entries. |
| `relationships` | Coach/teammate/family/agent/partner/media relationship values. |
| `injuries` | Injury history. |
| `assets` | Houses, cars, investments, businesses. |
| `finances` | Latest cash/net worth/earnings snapshot per career. |
| `news` | Press items, with response state. |
| `decisions` | Every resolved event-engine decision (full history, for "emergent story" callbacks and debugging). |
| `achievements` | Unlocked achievements per career. |
| `legacy_records` | Final retirement summary. |

## Row Level Security

Every table is scoped so a user can only ever see or modify rows belonging
to their own `careers` (checked via `user_id = auth.uid()` directly on
`careers`, and via an `exists (select 1 from careers ...)` join on every
child table). `teams` and `colleges` are public-read reference data with no
write policy for regular users. See the full policies in
`supabase/migrations/0001_init.sql`.

## Why this isn't wired up in this environment

This build environment has no access to the npm registry, so
`@supabase/supabase-js` cannot be installed here, and there is no live
Supabase project to run these migrations against. The repository
abstraction (`src/data/repository.ts`) is what makes this a non-issue for
gameplay: `LocalRepository` (localStorage) is a fully working
implementation of the exact same interface `SupabaseRepository` implements,
so the app is completely playable today. Turning on Supabase is:

```bash
npm install                      # pulls @supabase/supabase-js
supabase db push                 # applies the migrations above
# set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
```

No engine or UI code changes are required.
