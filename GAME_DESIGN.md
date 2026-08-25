# NFL LIFE — Game Design & Architecture

## 1. Vision

NFL LIFE is a football life & career simulator. You don't manage a team —
you live one athlete's life, from a 15-year-old high school freshman to
retirement and legacy. Every system (training, games, money, press,
relationships, injuries) feeds back into one question: **what kind of career
did you build?** The target feeling is "this is *my* career," driven by
decisions with real, compounding, sometimes-surprising consequences —
not a menu of cosmetic choices bolted onto a stat generator.

## 2. Core loop

```
Create Player → High School → Recruiting → College → NFL Draft → NFL
  → Seasons → Playoffs → Super Bowl → Free Agency → Personal Life
  → Decline → Retirement → Legacy / Hall of Fame
```

Concretely, in engine terms: `createCareer()` builds the initial
`CareerState`; `advanceWeek()` is the single tick function that drives every
stage forward — training, games, narrative events, aging, and stage
transitions (high_school → recruiting → college → draft → nfl_offseason →
nfl_season → free_agency → retired) all happen inside it or the functions it
delegates to. The UI never encodes game rules; it only renders `CareerState`
and calls a small set of intent functions (`advanceWeek`, `resolveDecision`,
`resolveGameDecision`, `commitToCollege`, `signWithTeam`, `retireCareer`,
`buyAsset`). This is what "the engine is the source of truth" means in
practice, and it's why the engine has its own full test suite independent of
any UI framework.

## 3. Systems implemented (Phase 1 MVP)

- **Player & attributes** (`engine/attributes.ts`, `engine/player.ts`):
  general/physical/mental/position-specific attribute blocks, a
  position-weighted `computeOverall()`, and a generic dotted-path
  get/set so data-driven events can modify any attribute uniformly.
- **Aging & training** (`engine/aging.ts`): a seasonal aging curve (physical
  peaks ~26, mental keeps climbing into the 30s, durability erodes with
  wear) and a training-focus system (strength/speed/technique/recovery/
  mental/position-specific) with fatigue and injury-risk tradeoffs.
- **Event engine** (`engine/events/engine.ts` + `engine/events/data/*.ts`):
  events are **data**, not UI code. A `GameEventDefinition` has conditions
  (stage, age, position, attribute thresholds, coach relationship, fame,
  narrative tags present/absent, cooldown, once-only, probability) and a
  list of choices, each with compound consequences (attribute deltas,
  relationship deltas, cash, tags added/removed, generated news, injury
  chance, trade-probability nudges, and a `narrativeMemory` string for
  future callbacks). **91 seed events** ship across high_school (15) /
  college (14) / draft (9) / nfl (18) / personal (15) / injury (9) / media
  (11); adding more is purely additive — drop a new object in the relevant
  `data/*.ts` file. This is intentionally the same architecture the spec's
  "50/100/30/150/100/30/100 events" target scales into; Phase 1 ships a
  representative slice of each category, expanded once already (54 → 91,
  see §7) to add both playtime and variety. Every new event's condition
  tags and attribute paths are checked against a live `CareerState` by a
  throwaway validation script before shipping, since a typo like
  `mental.leadership` (the real field is `general.leadership`) or a
  `tagsPresent` value nothing ever adds via `addTags` would silently make
  an event unreachable without tripping `tsc`.
- **Game Day simulation** (`engine/simulation/gameSim.ts`): not a full
  X's-and-O's engine. A game is a sequence of possessions resolved by a
  probability model (team ratings, fatigue, confidence, 4th-quarter
  pressure), with most of the player's own possessions pausing for a real
  decision (e.g., a QB choosing "check it down" / "audible to a run" / "take
  a shot deep", each carrying a safe/balanced/aggressive risk profile that
  shifts the underlying success/turnover/big-play probabilities). This is
  the "decision → execution → consequence" loop from the brief, without
  trying to be Madden. Possession count and key-moment frequency were tuned
  up materially (see §7) specifically to lengthen real playtime — this
  trades a little box-score realism (real NFL drive counts are lower) for a
  denser, more interactive game.
- **Weekly training decision** (`engine/career.ts`'s `chooseTrainingFocus`):
  every trainable week now opens with a real choice — strength / speed /
  technique / mental / position-specific / recovery — before that week's
  narrative event or game resolves. This was item 24 of the original brief
  ("Treino, com escolha de foco") and doubles as the single biggest lever on
  total career length, since it's one extra decision on literally every week
  of the career (HS, college, and all NFL seasons/offseasons).
- **Season & schedule** (`engine/simulation/season.ts`): schedule
  generation for HS/college/NFL, win/loss records, simplified playoff
  qualification, and a single-elimination Wild Card → Divisional →
  Conference Championship → Super Bowl bracket resolver.
- **Draft** (`engine/draft.ts`): combine score generation, a projection
  model (round range + "stock"), and a draft-night resolver with real
  boom/bust variance (a strong stock can still fall; a weak one can still
  sneak in).
- **Contracts & Free Agency** (`engine/contracts.ts`): rookie-scale
  contracts by draft slot, veteran free-agency offers shaped by age/market
  size/team quality, and weekly salary payout.
- **Finance** (`engine/finance.ts`): cash, a transparent flat effective tax
  rate, assets (house/car/investment/business/luxury) with upkeep and
  returns, sponsorships that scale with fame/reputation, and a weekly tick
  that's fully auditable (every dollar movement has a log line).
- **News & social media** (`engine/news.ts`): deterministic template-based
  headline/body/social-post generation driven by game performance — no
  external AI dependency, per the brief's "core gameplay must work without
  an AI API" requirement. (Swapping in an LLM later to *vary the prose* of
  these same headlines is a pure presentation-layer enhancement — see
  Phase 3.)
- **Injuries** (`engine/injury.ts`): minor/moderate/severe/career-threatening
  tiers, each with its own recovery-time and reinjury-risk range, gated by
  durability and discipline.
- **Achievements & Legacy** (`engine/achievements.ts`, `engine/legacy.ts`):
  a checklist of career achievements, and a final legacy scorer that turns
  career totals into a tier (Bust → Solid Career → Star → Superstar →
  Legend → Hall of Fame) with a human-readable summary. The store
  (`src/store/gameStore.ts`) diffs each achievement's `unlockedWeek` before
  vs. after every mutating action through a shared `applyCareer()` helper,
  so unlocking one surfaces an immediate `🏆 Achievement unlocked: …` toast
  no matter which action triggered it, instead of only the screens that
  happened to check manually.
- **Fictional world** (`engine/teams.ts`, `engine/colleges.ts`): 32
  fictional NFL-analog teams and 30 fictional colleges — see §6 on
  licensing.
- **Save system**: `Repository` interface with a fully working
  `LocalRepository` (localStorage) and a ready-to-activate
  `SupabaseRepository`. Multiple concurrent careers, autosave on every
  action. See `DATABASE_SCHEMA.md`.
- **Accounts & subscription** (`src/data/auth.ts`, `AuthScreen`,
  `SubscriptionScreen`): registration is required to play at all, and an
  active subscription ($5/month) is required beyond that. Both gates are
  real — there is no way to reach `CareerSelectScreen` without them — but
  the implementation is local (localStorage + Web Crypto PBKDF2 password
  hashing, no server) because this sandbox has no way to provision a live
  Supabase Auth project or a live payment processor. See §7 for the exact
  swap path to real Auth/billing, and the module header of `auth.ts` for why
  the "Simular assinatura" button is an honest, clearly-labeled simulation
  rather than a fake button that pretends to charge a real card. A seeded
  demo account (`adm` / `adm`, pre-subscribed) exists so the paywall doesn't
  block testing.

## 4. What a played-through MVP session looks like

Create a player → play through 4 seasons of high school (games + training
weeks + narrative decisions) → get recruited and commit to a college →
play 1-4 college seasons → declare for the draft → combine/interviews →
draft night → sign a rookie deal → NFL training camp → regular season
(weekly games with key-moment decisions, injuries, news, salary) →
playoffs if you qualify → offseason (aging, contract countdown, possible
free agency) → repeat until you choose to retire (or age 40 forces it) →
Legacy screen. This exact path is exercised end-to-end by
`src/engine/__tests__/career.test.ts`'s full-loop integration test, which
auto-plays a career from creation to retirement.

## 5. Environment constraint & tooling substitutions (read this)

This project was built inside a sandboxed cloud environment with **no
access to the npm registry, PyPI, or GitHub** (an organization-level
network egress policy — confirmed by direct 403s from
`registry.npmjs.org`, `pypi.org`, `jsr.io`, and `github.com`). That means
`npm install` could not be run here even once. Two things follow:

1. **`package.json` is written for the real, intended stack** — React,
   TypeScript, Vite, Vitest, Playwright, `@supabase/supabase-js` — and
   needs zero changes to run with `npm install` on a normal machine, in
   CI, or on Vercel/Cloudflare Pages.
2. **Verification inside this sandbox used dependency-free equivalents**,
   documented here so nothing is a silent surprise:
   - **Tailwind CSS → hand-written CSS design system**
     (`src/styles/index.css`). No Tailwind CLI could be installed to
     verify a build here, so the visual design is a small, deliberate set
     of CSS custom properties (dark, sport-inspired palette) and
     utility-ish classes instead. Swapping to Tailwind later is a styling
     migration, not an architecture change.
   - **Zustand → a ~30-line store factory** (`src/store/createStore.ts`)
     built on React's built-in `useSyncExternalStore`, matching Zustand's
     `get/set/subscribe` shape closely enough that swapping in real
     Zustand later is a one-file change. The brief explicitly allows
     "Zustand ou solução equivalente simples."
   - **Vitest → Node's built-in test runner**, run via `tsx` (already
     available in this sandbox with zero installs). Every engine test in
     `src/engine/__tests__/*.test.ts` uses `node:test` + `node:assert/strict`
     and actually executes in this environment (`npm run test:sandbox`).
     `vitest` is still the tool declared in `package.json` for the real
     project (`npm run test`) since its API is close enough that porting
     these files is mechanical (`node:test`'s `describe`/`it` ↔ vitest's
     `describe`/`it`, `assert.equal` ↔ `expect().toBe()`).
   - **Vite dev/build → esbuild**, used only by
     `tools/sandbox/esbuild-build.mjs` to produce a real, working browser
     bundle *inside this sandbox* for manual/Playwright verification
     (esbuild ships as a transitive dependency of the globally-installed
     `tsx`, so no install was needed). This script is clearly out-of-band
     tooling — the shipped app runs on Vite (`npm run dev` / `npm run
     build`), not esbuild.
   - **Supabase**: `SupabaseRepository` is written against the real
     `@supabase/supabase-js` v2 API but is never imported by default (see
     `src/data/index.ts` — it's a dynamic import gated on env vars), so
     its absence doesn't block anything. It has not been executed against
     a live project, since none exists in this sandbox.

None of these substitutions change the product's behavior — they change
*what tool proves the behavior is correct inside this particular sandbox*.
The full engine test suite (33 tests) and a real, running, screenshotted
build both pass inside this environment; see the final delivery summary for
the exact commands used.

## 6. Licensing

No real team names, logos, university names, player names, or photography
are used anywhere (`engine/teams.ts`, `engine/colleges.ts`). The league and
college universe are wholly fictional, so the product can operate
commercially without an NFL/NCAA license. Swapping in licensed data later
is isolated to those two files plus their DB seed — nothing else references
real-world names.

During QA a handful of procedurally-generated fictional nicknames happened
to collide with real trademarks (`Titans`, `Falcons` — real current NFL
teams; `Longhorns`, `Hurricanes` — real college football teams), and the
fictional conferences were literally labeled `"NFC"/"AFC"`, the real NFL's
own abbreviations. All were caught and replaced (`Colossi`, `Talons`,
`Ironhorns`, `Tempest`; conferences renamed to `"National"/"American"`)
before this delivery — see `engine/teams.ts`. Worth a periodic re-check of
`CITIES`/`NICKNAMES` if that list is ever extended.

## 7. Playtime tuning, accounts/billing, and the homepage demo

This section documents changes made after the initial MVP delivery, in
response to explicit follow-up requests: lengthen real playtime
substantially, require registration to play, add a paid subscription gate,
and add a homepage demo video.

**Playtime.** The original MVP's engine-driven full-career playthrough (High
School → age-40 retirement) measured at roughly 3,200 player actions. Three
changes pushed that to roughly 7,200 actions — at a normal, read-everything
pace (~6s/action) that's about 12 hours for one full natural career:

- `gameSim.ts`: possessions per game raised from 10-14 to 24-36, and the
  chance a player-side possession becomes an interactive key moment raised
  from a fixed 3-slot schedule to an 90%-chance roll (cap 20/game). This is
  the single biggest lever — most of a career's actions happen inside games.
- `career.ts`'s `rollNarrativeEvent`: every event's own base probability is
  now scaled by 1.6x (capped at 92%), so a typical week is meaningfully more
  likely to bring a real decision instead of a bare "Advance Week" click.
- The new mandatory weekly training-focus decision (§3) adds one guaranteed
  extra action to every single week of the career.

Re-measure this any time with a short throwaway script that imports
`createCareer`/`advanceWeek`/etc. from `engine/career.ts` and autoplays,
counting resolver calls — see the git history for the exact probe used
during this tuning pass (removed from the repo since it's a one-off, not a
maintained tool).

**Accounts & subscription** — see §3's bullet for what exists. The swap path
to production-real versions:
- *Auth*: replace `src/data/auth.ts` with calls to Supabase Auth
  (`supabase.auth.signUp` / `signInWithPassword`), keep the same
  `AuthScreen`/`SubscriptionScreen` — they only depend on the small
  register/login/logout/getSession surface, not on how it's implemented.
- *Billing*: replace `activateSubscriptionDemo()` with a real Stripe
  Checkout session (redirect out, webhook flips `subscriptionActive` in the
  database on `checkout.session.completed`). No UI changes needed beyond
  removing the "ambiente de demonstração" notice.

**Homepage demo video** (`public/demo.webm`, embedded in `AuthScreen`): real
gameplay footage — login, player creation, a narrative decision, a training
choice — recorded with Playwright's built-in video recorder against the
sandbox build (`tools/sandbox/record-demo.mjs`, sandbox-only like the rest
of `tools/sandbox/`). Re-record any time the early-game flow changes enough
to make the footage stale.

## 8. Roadmap

**Phase 1 (this delivery) — MVP, playable end-to-end**: everything in §3.

**Phase 2**:
- Expand event content toward the full 50/100/30/150/100/30/100 targets
  per category (architecture already supports this — it's pure data entry).
- Deeper relationship system: named teammates/agents with their own arcs,
  narrative memory actually referenced by later event text (the
  `narrativeMemory` field already exists on consequences for this).
- Richer game sim: per-drive field position tracking, weather, a
  visual play diagram (Canvas/SVG) for key moments.
- Social media as a first-class screen with player-authored responses
  affecting fan sentiment as a tracked metric.
- Sponsorship negotiation flow (currently: offers auto-appear and can be
  accepted via an event choice; a dedicated negotiation screen is next).
- Admin/debug panel (item 47): age/money/attribute overrides, forced
  events, forced injuries — internal-only, never shipped to end users.
- Achievements UI with unlock toasts + a dedicated trophy case screen.

**Phase 3**:
- Optional AI-generated headline/interview *prose variation* layered on
  top of the deterministic template system (never required for core
  gameplay to function, per the brief).
- Leaderboards / shared legacy comparisons (needs Supabase live).
- Premium tier enforcement (unlimited careers, advanced stats) once
  billing exists.
- Expanded position depth (OL/DL/S/K/P get their own attribute-weighted
  stat lines and key-moment flavor, beyond the generic block they use today).
