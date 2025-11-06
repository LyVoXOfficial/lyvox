-- Seed Data: Belgium CP Codes (Paritair Comité / Commission Paritaire)
-- To be run after 20251105213527_catalog_dictionaries.sql migration
-- Common CP codes used in Belgium for employment contracts

INSERT INTO public.cp_codes (code, name_nl, name_fr, name_en, sector) VALUES
  -- Most common CP codes
  ('PC200', 'Bedienden', 'Employés', 'White-Collar Employees', 'general'),
  ('PC202', 'Bedienden - Commerce', 'Employés - Commerce', 'White-Collar - Retail', 'retail'),
  ('PC207', 'Bedienden - Chemie', 'Employés - Chimie', 'White-Collar - Chemical', 'chemical'),
  ('PC218', 'Bedienden - Voeding', 'Employés - Alimentation', 'White-Collar - Food Industry', 'food'),
  ('PC220', 'Bedienden - Banken', 'Employés - Banques', 'White-Collar - Banking', 'banking'),
  ('PC306', 'Bedienden - Verzekeringen', 'Employés - Assurances', 'White-Collar - Insurance', 'insurance'),
  
  -- Construction
  ('PC124', 'Bouw', 'Construction', 'Construction', 'construction'),
  ('PC224', 'Bedienden - Bouw', 'Employés - Construction', 'White-Collar - Construction', 'construction'),
  
  -- Healthcare
  ('PC318', 'Gezondheidszorg', 'Soins de santé', 'Healthcare', 'healthcare'),
  ('PC319', 'Openbare Gezondheidszorg', 'Santé publique', 'Public Healthcare', 'healthcare'),
  ('PC330', 'Ziekenhuizen', 'Hôpitaux', 'Hospitals', 'healthcare'),
  
  -- Hospitality
  ('PC302', 'Horeca', 'Horeca', 'Hospitality', 'hospitality'),
  
  -- Transport
  ('PC140', 'Transport', 'Transport', 'Transport', 'transport'),
  ('PC142', 'Verhuizingen', 'Déménagement', 'Moving', 'transport'),
  
  -- IT & Services
  ('PC218.01', 'IT-diensten', 'Services informatiques', 'IT Services', 'it'),
  ('PC323', 'Bewaking', 'Gardiennage', 'Security Services', 'security'),
  ('PC337', 'Schoonmaak', 'Nettoyage', 'Cleaning', 'cleaning'),
  
  -- Education
  ('PC227.02', 'Audiovisuele sector', 'Secteur audiovisuel', 'Audiovisual', 'media'),
  
  -- Industry
  ('PC111', 'Metaalverwerkende nijverheid', 'Industrie métallurgique', 'Metal Industry', 'industry'),
  ('PC116', 'Chemie', 'Chimie', 'Chemical Industry', 'chemical'),
  ('PC118', 'Voeding', 'Alimentation', 'Food Industry', 'food'),
  ('PC120', 'Textiel', 'Textile', 'Textile Industry', 'textile'),
  
  -- Retail
  ('PC201', 'Kleinhandel - Voeding', 'Commerce de détail - Alimentation', 'Retail - Food', 'retail'),
  ('PC202', 'Kleinhandel - Algemeen', 'Commerce de détail - Général', 'Retail - General', 'retail'),
  
  -- Other
  ('PC329', 'Sport', 'Sport', 'Sports', 'sports'),
  ('PC331', 'Grote detailhandel', 'Grand commerce de détail', 'Large Retail', 'retail')
ON CONFLICT (code) DO NOTHING;

