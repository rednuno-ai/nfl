-- =============================================================================
-- NFL LIFE — Initial schema
-- -----------------------------------------------------------------------------
-- Design: `careers.state` holds the full, authoritative CareerState as JSONB
-- (matches src/engine/career.ts exactly — the engine is the schema for the
-- simulation). A handful of hot fields are promoted to real columns for fast
-- list queries and RLS. Everything that needs independent querying/joining
-- (achievements unlocked, news items, season stat lines, decisions) is ALSO
-- normalized into its own table, written by the same application transaction
-- that upserts `careers.state`. Postgres/Supabase; auth via Supabase Auth.
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Users are Supabase Auth users (auth.users). We keep a thin profile table
-- for app-specific fields and subscription tier (see item 50: monetization).
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tier text not null default 'free' check (tier in ('free', 'premium')),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Fictional world data (teams & colleges). Seeded once, read-only to clients.
-- Kept in the DB (rather than only in engine code) so future licensed data
-- can be swapped in via a data migration without a client release.
-- ---------------------------------------------------------------------------
create table public.teams (
  id text primary key,
  city text not null,
  name text not null,
  abbreviation text not null,
  conference text not null,
  division text not null,
  prestige int not null,
  market_size int not null,
  coaching_quality int not null,
  roster_strength int not null,
  head_coach_name text not null
);

create table public.colleges (
  id text primary key,
  name text not null,
  mascot text not null,
  conference text not null,
  state text not null,
  prestige int not null,
  coaching_quality int not null,
  academics int not null,
  exposure int not null,
  development_rate numeric not null
);

-- ---------------------------------------------------------------------------
-- Careers: one row per save slot. `state` is the full CareerState JSON blob.
-- ---------------------------------------------------------------------------
create table public.careers (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  player_name text not null,
  position text not null,
  stage text not null,
  age int not null,
  overall int not null,
  seed bigint not null,
  retired boolean not null default false,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index careers_user_id_idx on public.careers (user_id, updated_at desc);

-- ---------------------------------------------------------------------------
-- Normalized tables for querying without touching the JSON blob.
-- ---------------------------------------------------------------------------
create table public.player_stats (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  season int not null,
  level text not null check (level in ('high_school', 'college', 'nfl')),
  team_or_school_id text not null,
  games_played int not null default 0,
  games_started int not null default 0,
  pass_attempts int not null default 0,
  pass_completions int not null default 0,
  pass_yards int not null default 0,
  pass_tds int not null default 0,
  interceptions_thrown int not null default 0,
  rush_attempts int not null default 0,
  rush_yards int not null default 0,
  rush_tds int not null default 0,
  receptions int not null default 0,
  receiving_yards int not null default 0,
  receiving_tds int not null default 0,
  fumbles int not null default 0,
  tackles int not null default 0,
  sacks int not null default 0,
  interceptions int not null default 0,
  passes_defended int not null default 0,
  forced_fumbles int not null default 0,
  pro_bowl boolean not null default false,
  all_pro boolean not null default false,
  mvp boolean not null default false,
  championship_won boolean not null default false
);

create index player_stats_career_idx on public.player_stats (career_id, season);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  team_id text not null,
  years int not null,
  total_value bigint not null,
  signing_bonus bigint not null,
  guaranteed_money bigint not null,
  start_year int not null,
  rookie_deal boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.games (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  season int not null,
  week int not null,
  level text not null check (level in ('high_school', 'college', 'nfl')),
  opponent_label text not null,
  score_player int not null,
  score_opponent int not null,
  result text not null check (result in ('win', 'loss', 'tie')),
  played_at timestamptz not null default now()
);

create table public.game_events (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  possession_index int not null,
  quarter int not null,
  text text not null,
  player_involved boolean not null default false
);

create table public.relationships (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  name text not null,
  type text not null check (type in ('coach', 'teammate', 'family', 'friend', 'agent', 'partner', 'media')),
  value int not null,
  tags text[] not null default '{}'
);

create table public.injuries (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  type text not null,
  severity text not null check (severity in ('minor', 'moderate', 'severe', 'career_threatening')),
  week_occurred int not null,
  recovery_weeks int not null,
  performance_penalty numeric not null,
  played_through boolean not null default false
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  name text not null,
  type text not null check (type in ('house', 'car', 'investment', 'business', 'luxury')),
  value bigint not null,
  weekly_upkeep numeric not null,
  weekly_return numeric not null,
  purchased_week int not null
);

create table public.finances (
  career_id text primary key references public.careers (id) on delete cascade,
  cash bigint not null,
  net_worth bigint not null,
  total_career_earnings bigint not null,
  total_taxes_paid bigint not null,
  debt bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table public.news (
  id text primary key,
  career_id text not null references public.careers (id) on delete cascade,
  week int not null,
  headline text not null,
  body text not null,
  tone text not null check (tone in ('positive', 'negative', 'neutral', 'controversial')),
  source text not null,
  requires_response boolean not null default false,
  responded boolean not null default false
);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  event_id text not null,
  title text not null,
  choice_id text not null,
  choice_label text not null,
  week int not null,
  decided_at timestamptz not null default now()
);

create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  career_id text not null references public.careers (id) on delete cascade,
  achievement_id text not null,
  unlocked_week int,
  unique (career_id, achievement_id)
);

create table public.legacy_records (
  career_id text primary key references public.careers (id) on delete cascade,
  tier text not null check (tier in ('bust', 'solid_career', 'star', 'superstar', 'legend', 'hall_of_fame')),
  score int not null,
  summary text not null,
  seasons_played int not null,
  games_played int not null,
  championships int not null,
  pro_bowls int not null,
  all_pros int not null,
  mvps int not null,
  career_earnings bigint not null,
  net_worth bigint not null,
  retired_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security: a user can only ever see/modify their own careers and
-- everything hanging off them. World data (teams/colleges) is public-read.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.careers enable row level security;
alter table public.player_stats enable row level security;
alter table public.contracts enable row level security;
alter table public.games enable row level security;
alter table public.game_events enable row level security;
alter table public.relationships enable row level security;
alter table public.injuries enable row level security;
alter table public.assets enable row level security;
alter table public.finances enable row level security;
alter table public.news enable row level security;
alter table public.decisions enable row level security;
alter table public.achievements enable row level security;
alter table public.legacy_records enable row level security;
alter table public.teams enable row level security;
alter table public.colleges enable row level security;

create policy "own profile" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid());
create policy "own subscription" on public.subscriptions for select using (user_id = auth.uid());

create policy "own careers" on public.careers for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Child tables: ownership is checked via a join back to careers.user_id.
create policy "own player_stats" on public.player_stats for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own contracts" on public.contracts for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own games" on public.games for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own game_events" on public.game_events for all
  using (exists (select 1 from public.games g join public.careers c on c.id = g.career_id where g.id = game_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.games g join public.careers c on c.id = g.career_id where g.id = game_id and c.user_id = auth.uid()));

create policy "own relationships" on public.relationships for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own injuries" on public.injuries for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own assets" on public.assets for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own finances" on public.finances for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own news" on public.news for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own decisions" on public.decisions for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own achievements" on public.achievements for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "own legacy_records" on public.legacy_records for all
  using (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.careers c where c.id = career_id and c.user_id = auth.uid()));

create policy "public read teams" on public.teams for select using (true);
create policy "public read colleges" on public.colleges for select using (true);

-- ---------------------------------------------------------------------------
-- Keep `updated_at` fresh on every career write.
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger careers_set_updated_at
  before update on public.careers
  for each row execute function public.set_updated_at();
