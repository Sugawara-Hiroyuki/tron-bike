create table if not exists scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 12),
  score integer not null check (score >= 0),
  stage integer not null check (stage >= 1),
  created_at timestamptz not null default now()
);

create index if not exists scores_score_idx on scores (score desc, created_at asc);
