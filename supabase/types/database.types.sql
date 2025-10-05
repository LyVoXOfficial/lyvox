-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.ad_item_specifics (
  advert_id uuid NOT NULL,
  specifics jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT ad_item_specifics_pkey PRIMARY KEY (advert_id),
  CONSTRAINT ad_item_specifics_advert_id_fkey FOREIGN KEY (advert_id) REFERENCES public.adverts(id)
);
CREATE TABLE public.adverts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  category_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  price numeric,
  currency text DEFAULT 'EUR'::text,
  condition text,
  status text NOT NULL DEFAULT 'active'::text,
  location_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  location text,
  CONSTRAINT adverts_pkey PRIMARY KEY (id),
  CONSTRAINT adverts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id),
  CONSTRAINT adverts_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT adverts_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.locations(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  parent_id uuid,
  slug text NOT NULL UNIQUE,
  level integer NOT NULL CHECK (level >= 1 AND level <= 3),
  name_ru text NOT NULL,
  name_nl text,
  name_fr text,
  name_en text,
  path text NOT NULL,
  sort integer DEFAULT 0,
  icon text,
  is_active boolean DEFAULT true,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.categories(id)
);
CREATE TABLE public.locations (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  country text,
  region text,
  city text,
  postcode text,
  point USER-DEFINED,
  CONSTRAINT locations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.logs (
  id bigint NOT NULL DEFAULT nextval('logs_id_seq'::regclass),
  user_id uuid,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT logs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.media (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  advert_id uuid NOT NULL,
  url text NOT NULL,
  w integer,
  h integer,
  sort integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT media_pkey PRIMARY KEY (id),
  CONSTRAINT media_advert_id_fkey FOREIGN KEY (advert_id) REFERENCES public.adverts(id)
);
CREATE TABLE public.phone_otps (
  id bigint NOT NULL DEFAULT nextval('phone_otps_id_seq'::regclass),
  user_id uuid,
  e164 text NOT NULL,
  code text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  attempts smallint NOT NULL DEFAULT 0,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT phone_otps_pkey PRIMARY KEY (id),
  CONSTRAINT phone_otps_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.phones (
  user_id uuid NOT NULL,
  e164 text NOT NULL UNIQUE,
  verified boolean NOT NULL DEFAULT false,
  lookup jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT phones_pkey PRIMARY KEY (user_id),
  CONSTRAINT phones_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  display_name text,
  phone text,
  verified_email boolean DEFAULT false,
  verified_phone boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.reports (
  id bigint NOT NULL DEFAULT nextval('reports_id_seq'::regclass),
  advert_id uuid NOT NULL,
  reporter uuid NOT NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending'::text,
  reviewed_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT reports_pkey PRIMARY KEY (id),
  CONSTRAINT reports_advert_id_fkey FOREIGN KEY (advert_id) REFERENCES public.adverts(id),
  CONSTRAINT reports_reporter_fkey FOREIGN KEY (reporter) REFERENCES auth.users(id)
);
CREATE TABLE public.spatial_ref_sys (
  srid integer NOT NULL CHECK (srid > 0 AND srid <= 998999),
  auth_name character varying,
  auth_srid integer,
  srtext character varying,
  proj4text character varying,
  CONSTRAINT spatial_ref_sys_pkey PRIMARY KEY (srid)
);
CREATE TABLE public.trust_score (
  user_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT trust_score_pkey PRIMARY KEY (user_id),
  CONSTRAINT trust_score_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);