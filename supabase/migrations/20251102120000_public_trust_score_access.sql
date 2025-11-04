-- UI-010: Add public read access for trust_score
-- This migration allows public users to read trust_score for public profile pages
-- Trust score is a public metric that helps users assess seller reputation

-- Add public read policy for trust_score
drop policy if exists "Public read trust score" on public.trust_score;
create policy "Public read trust score" on public.trust_score
  for select using (true); -- All users (including anonymous) can read trust scores

-- Note: Trust score is a public metric, similar to ratings on e-commerce platforms
-- It helps users make informed decisions when interacting with sellers
-- The score calculation is handled by the trust_inc() function and moderation system

comment on policy "Public read trust score" on public.trust_score is 
  'Allows all users (including anonymous) to read trust scores for public profile pages';

