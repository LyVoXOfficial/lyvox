-- FRAUD-001: Fraud detection rules table
-- Creates table for fraud detection rules and seed data with basic rules

-- 1. Create fraud_rules table
create table if not exists public.fraud_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  rule_type text not null check (rule_type in ('pattern', 'threshold', 'behavior', 'composite')),
  condition jsonb not null, -- JSON structure defining the rule condition
  action text not null check (action in ('block', 'flag', 'review', 'warn')),
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  enabled boolean default true,
  priority integer default 0, -- Higher priority rules are checked first
  metadata jsonb, -- Additional rule configuration
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Create fraud_detection_logs table
create table if not exists public.fraud_detection_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  advert_id uuid references public.adverts(id) on delete set null,
  rule_id uuid references public.fraud_rules(id) on delete set null,
  rule_name text not null,
  match_score numeric not null, -- 0-100, how well the rule matched
  action_taken text not null check (action_taken in ('block', 'flag', 'review', 'warn', 'none')),
  details jsonb, -- Details about what triggered the rule
  created_at timestamptz default now()
);

-- 3. Indexes for performance
create index if not exists idx_fraud_rules_enabled on public.fraud_rules(enabled, priority desc) where enabled = true;
create index if not exists idx_fraud_rules_type on public.fraud_rules(rule_type);
create index if not exists idx_fraud_detection_logs_user on public.fraud_detection_logs(user_id, created_at desc);
create index if not exists idx_fraud_detection_logs_advert on public.fraud_detection_logs(advert_id) where advert_id is not null;
create index if not exists idx_fraud_detection_logs_rule on public.fraud_detection_logs(rule_id, created_at desc);

-- 4. Trigger for updated_at
create trigger set_updated_at_fraud_rules
  before update on public.fraud_rules
  for each row
  execute function public.set_updated_at();

-- 5. Seed data with basic fraud detection rules
insert into public.fraud_rules (name, description, rule_type, condition, action, severity, enabled, priority) values
  -- Rule 1: Multiple accounts from same IP
  (
    'multiple_accounts_same_ip',
    'Detects multiple accounts created from the same IP address within a short time',
    'pattern',
    '{"type": "ip_duplicate", "time_window_hours": 24, "max_accounts": 3}'::jsonb,
    'flag',
    'medium',
    true,
    10
  ),
  -- Rule 2: Rapid advert posting
  (
    'rapid_posting',
    'Detects users posting too many adverts in a short time',
    'threshold',
    '{"type": "advert_count", "time_window_hours": 1, "max_adverts": 5}'::jsonb,
    'review',
    'medium',
    true,
    8
  ),
  -- Rule 3: Suspicious price patterns
  (
    'suspicious_price',
    'Detects adverts with prices significantly below market average',
    'threshold',
    '{"type": "price_deviation", "deviation_percent": 50, "category_required": true}'::jsonb,
    'review',
    'low',
    true,
    5
  ),
  -- Rule 4: Duplicate content detection
  (
    'duplicate_content',
    'Detects duplicate or very similar advert titles/descriptions',
    'pattern',
    '{"type": "content_similarity", "similarity_threshold": 0.9}'::jsonb,
    'flag',
    'high',
    true,
    15
  ),
  -- Rule 5: Unverified user posting
  (
    'unverified_poster',
    'Flags adverts from users without verified email or phone',
    'pattern',
    '{"type": "verification_check", "require_email": true, "require_phone": false}'::jsonb,
    'review',
    'low',
    true,
    3
  ),
  -- Rule 6: High rejection rate
  (
    'high_rejection_rate',
    'Flags users with high percentage of rejected adverts',
    'threshold',
    '{"type": "rejection_rate", "min_adverts": 3, "rejection_threshold": 0.5}'::jsonb,
    'flag',
    'high',
    true,
    12
  ),
  -- Rule 7: Suspicious contact patterns
  (
    'suspicious_contact',
    'Detects patterns suggesting spam or fraud in contact information',
    'pattern',
    '{"type": "contact_pattern", "patterns": ["multiple_emails", "suspicious_domains"]}'::jsonb,
    'review',
    'medium',
    true,
    7
  ),
  -- Rule 8: Account age vs activity
  (
    'new_account_high_activity',
    'Flags new accounts with unusually high activity',
    'behavior',
    '{"type": "account_age_activity", "max_age_days": 7, "max_adverts": 10}'::jsonb,
    'flag',
    'medium',
    true,
    9
  )
on conflict (name) do nothing;

-- 6. Add comments for documentation
comment on table public.fraud_rules is 'Fraud detection rules that can be evaluated against users and adverts';
comment on table public.fraud_detection_logs is 'Logs of fraud detection rule matches and actions taken';
comment on column public.fraud_rules.condition is 'JSON structure defining rule conditions. Structure varies by rule_type.';
comment on column public.fraud_rules.action is 'Action to take when rule matches: block (immediate block), flag (mark for review), review (add to review queue), warn (log only)';
comment on column public.fraud_detection_logs.match_score is 'Score from 0-100 indicating how well the rule matched (100 = perfect match)';

