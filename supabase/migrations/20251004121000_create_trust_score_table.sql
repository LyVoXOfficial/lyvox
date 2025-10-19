-- Trust score table used for moderation heuristics
create table if not exists public.trust_score (
  user_id uuid primary key references auth.users(id) on delete cascade,
  score int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

drop trigger if exists set_updated_at_trust_score on public.trust_score;
create trigger set_updated_at_trust_score
before update on public.trust_score
for each row
execute procedure public.set_updated_at();
