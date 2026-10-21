-- Participant directory. Fictional data only while `synthetic` is enforced.
create table if not exists participants (
  record_id       text primary key,
  first_name      text not null,
  last_name       text not null,
  record          jsonb not null,
  organization_id text not null default 'demo',
  synthetic       boolean not null default true check (synthetic),
  updated_at      timestamptz not null default now()
);
create index if not exists participants_name_idx on participants (lower(first_name || ' ' || last_name));

create table if not exists participant_audit (
  id             bigserial primary key,
  user_id        text not null,
  action         text not null,
  participant_id text,
  at             timestamptz not null default now()
);

-- Who may read the directory, and which organization's participants. No row means no access.
create table if not exists directory_members (
  user_id         text primary key,
  organization_id text not null
);

-- Failed sign-in counters (hashed email or client address) for the sign-in broker's rate limit.
create table if not exists auth_attempts (
  key            text primary key,
  failures       integer     not null,
  window_started timestamptz not null
);
