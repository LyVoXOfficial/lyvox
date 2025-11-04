-- Fix: Ensure all existing users have profiles and trust_score records
-- This is a backfill migration to create missing profile and trust_score records

-- Ensure all existing users have profiles (backfill)
INSERT INTO public.profiles (id, display_name, verified_email, verified_phone)
SELECT 
  u.id,
  COALESCE(u.raw_user_meta_data->>'display_name', u.email),
  u.email_confirmed_at IS NOT NULL,
  u.phone_confirmed_at IS NOT NULL
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- Ensure all users have trust_score records
INSERT INTO public.trust_score (user_id, score)
SELECT 
  u.id,
  0
FROM auth.users u
LEFT JOIN public.trust_score ts ON ts.user_id = u.id
WHERE ts.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Note: The trigger for automatic profile creation (on_auth_user_created) 
-- must be created manually via Supabase Dashboard > Database > Triggers
-- or via SQL Editor with appropriate permissions

