-- AI-002: AI Moderation fields and moderation_logs table
-- Adds AI moderation fields to adverts and creates moderation_logs table

-- 1. Add AI moderation fields to adverts table
alter table if exists public.adverts
  add column if not exists ai_moderation_score integer,
  add column if not exists ai_moderation_reason text,
  add column if not exists moderation_status text default 'pending' check (moderation_status in ('pending', 'pending_review', 'approved', 'rejected', 'flagged'));

-- 2. Add indexes for moderation queries
create index if not exists idx_adverts_moderation_status on public.adverts(moderation_status) where moderation_status in ('pending', 'pending_review', 'flagged');
create index if not exists idx_adverts_ai_score on public.adverts(ai_moderation_score) where ai_moderation_score is not null;

-- 3. Create moderation_logs table
create table if not exists public.moderation_logs (
  id uuid primary key default gen_random_uuid(),
  advert_id uuid not null references public.adverts(id) on delete cascade,
  moderation_type text not null check (moderation_type in ('ai', 'manual', 'automated')),
  moderator_id uuid references auth.users(id) on delete set null, -- null for AI/automated
  score integer, -- 0-100, where 0 = safe, 100 = critical violation
  reason text,
  recommendation text check (recommendation in ('approve', 'reject', 'review')),
  action_taken text, -- 'approved', 'rejected', 'flagged', 'no_action'
  metadata jsonb, -- Additional data (model used, confidence, etc.)
  created_at timestamptz default now()
);

-- 4. Indexes for moderation_logs
create index if not exists idx_moderation_logs_advert on public.moderation_logs(advert_id, created_at desc);
create index if not exists idx_moderation_logs_type on public.moderation_logs(moderation_type, created_at desc);
create index if not exists idx_moderation_logs_moderator on public.moderation_logs(moderator_id) where moderator_id is not null;

-- 5. Add comment for documentation
comment on column public.adverts.ai_moderation_score is 'AI moderation score (0-100, where 0 = safe, 100 = critical violation)';
comment on column public.adverts.ai_moderation_reason is 'AI-generated reason for moderation decision';
comment on column public.adverts.moderation_status is 'Current moderation status: pending, pending_review, approved, rejected, flagged';
comment on table public.moderation_logs is 'Logs all moderation actions (AI, manual, automated) for audit trail';

