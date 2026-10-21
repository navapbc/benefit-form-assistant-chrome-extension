-- Mock connector storage. Fictional data only: every row is flagged `synthetic`.
-- Apply with `npm run connector:migrate` (uses the direct, non-pooled connection).

create table if not exists mock_records (
  source_id   text        not null,
  record_id   text        not null,
  attributes  jsonb       not null,
  synthetic   boolean     not null default true check (synthetic),
  updated_at  timestamptz not null default now(),
  primary key (source_id, record_id)
);

create table if not exists mock_datasets (
  id          text        primary key,
  label       text        not null,
  scenario    text        not null default '',
  description text        not null default '',
  payload     jsonb       not null,
  is_preset   boolean     not null default false,
  synthetic   boolean     not null default true check (synthetic),
  updated_at  timestamptz not null default now()
);
