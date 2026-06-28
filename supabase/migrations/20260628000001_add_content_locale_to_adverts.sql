-- F31: add content_locale to adverts for SEO inLanguage / hreflang / OG metadata
ALTER TABLE adverts
  ADD COLUMN IF NOT EXISTS content_locale text;
