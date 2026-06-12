-- BreakCoach initial schema.
-- Generic motion-engine tables (sport-agnostic). Stores ONLY anonymized motion
-- data — never raw video. Row-level security enforces youth-safe access.

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id text primary key,                 -- matches auth.uid()::text once auth is wired
  role text not null check (role in ('child','parent','coach','adult')),
  age_group text not null check (age_group in ('under13','teen','adult')),
  consent_status text not null default 'not_required'
    check (consent_status in ('not_required','pending','granted','revoked')),
  guardian_id text references profiles(id) on delete set null,
  allow_raw_video_storage boolean not null default false,
  allow_public_sharing boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- skills (content; "Move" in the breakdance-only spec). Generic across sports.
-- ---------------------------------------------------------------------------
create table if not exists skills (
  id text primary key,
  discipline text not null,            -- breakdance, boxing, basketball, ...
  name text not null,
  category text not null,              -- toprock, footwork, freeze, striking, ...
  difficulty text not null check (difficulty in ('beginner','intermediate','advanced')),
  description text,
  reference_motion_id text
);

-- ---------------------------------------------------------------------------
-- motion_sessions  (one analyzed attempt)
-- ---------------------------------------------------------------------------
create table if not exists motion_sessions (
  id text primary key,
  user_id text not null references profiles(id) on delete cascade,
  skill_id text not null,
  created_at timestamptz not null default now(),
  duration double precision not null default 0,
  fps integer not null default 15,
  score integer,
  feedback_summary text
);
create index if not exists motion_sessions_user_idx on motion_sessions(user_id);

-- ---------------------------------------------------------------------------
-- motion_frames  (anonymized skeleton; the only "personal" data we keep)
-- ---------------------------------------------------------------------------
create table if not exists motion_frames (
  id bigint generated always as identity primary key,
  session_id text not null references motion_sessions(id) on delete cascade,
  user_id text not null references profiles(id) on delete cascade,
  timestamp integer not null,          -- ms from session start
  joints jsonb not null                -- { nose:[x,y,z,conf], leftShoulder:[...], ... }
);
create index if not exists motion_frames_session_idx on motion_frames(session_id);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table motion_sessions enable row level security;
alter table motion_frames enable row level security;

-- helper: current user id as text
-- (auth.uid() is uuid; cast to text to match our text keys)

-- profiles: a user sees/edits their own row; a guardian can read their child's.
drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles
  for select using (auth.uid()::text = id or auth.uid()::text = guardian_id);
drop policy if exists profiles_self_insert on profiles;
create policy profiles_self_insert on profiles
  for insert with check (auth.uid()::text = id);
drop policy if exists profiles_self_update on profiles;
create policy profiles_self_update on profiles
  for update using (auth.uid()::text = id) with check (auth.uid()::text = id);

-- sessions: owner full access; guardian read-only for their child's sessions.
drop policy if exists sessions_owner_all on motion_sessions;
create policy sessions_owner_all on motion_sessions
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
drop policy if exists sessions_guardian_read on motion_sessions;
create policy sessions_guardian_read on motion_sessions
  for select using (
    exists (
      select 1 from profiles p
      where p.id = motion_sessions.user_id and p.guardian_id = auth.uid()::text
    )
  );

-- frames: same ownership + guardian read.
drop policy if exists frames_owner_all on motion_frames;
create policy frames_owner_all on motion_frames
  for all using (auth.uid()::text = user_id) with check (auth.uid()::text = user_id);
drop policy if exists frames_guardian_read on motion_frames;
create policy frames_guardian_read on motion_frames
  for select using (
    exists (
      select 1 from profiles p
      where p.id = motion_frames.user_id and p.guardian_id = auth.uid()::text
    )
  );

-- skills are public read-only content.
alter table skills enable row level security;
drop policy if exists skills_public_read on skills;
create policy skills_public_read on skills for select using (true);
