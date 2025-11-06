-- Seed Data: Job Categories
-- To be run after 20251105213527_catalog_dictionaries.sql migration

INSERT INTO public.job_categories (slug, name_nl, name_fr, name_en, name_de, name_ru, sort_order) VALUES
  ('administration', 'Administratie', 'Administration', 'Administration', 'Verwaltung', 'Администрация', 10),
  ('accounting_finance', 'Boekhouding & Financiën', 'Comptabilité & Finances', 'Accounting & Finance', 'Buchhaltung & Finanzen', 'Бухгалтерия и финансы', 20),
  ('sales_marketing', 'Verkoop & Marketing', 'Ventes & Marketing', 'Sales & Marketing', 'Verkauf & Marketing', 'Продажи и маркетинг', 30),
  ('it_tech', 'IT & Technologie', 'IT & Technologie', 'IT & Technology', 'IT & Technologie', 'IT и технологии', 40),
  ('engineering', 'Engineering', 'Ingénierie', 'Engineering', 'Ingenieurwesen', 'Инженерия', 50),
  ('healthcare', 'Gezondheidszorg', 'Soins de santé', 'Healthcare', 'Gesundheitswesen', 'Здравоохранение', 60),
  ('education', 'Onderwijs', 'Éducation', 'Education', 'Bildung', 'Образование', 70),
  ('hospitality_tourism', 'Horeca & Toerisme', 'Horeca & Tourisme', 'Hospitality & Tourism', 'Gastgewerbe & Tourismus', 'Гостеприимство и туризм', 80),
  ('construction', 'Bouw', 'Construction', 'Construction', 'Bau', 'Строительство', 90),
  ('transport_logistics', 'Transport & Logistiek', 'Transport & Logistique', 'Transport & Logistics', 'Transport & Logistik', 'Транспорт и логистика', 100),
  ('retail', 'Kleinhandel', 'Commerce de détail', 'Retail', 'Einzelhandel', 'Розничная торговля', 110),
  ('customer_service', 'Klantenservice', 'Service client', 'Customer Service', 'Kundenservice', 'Клиентский сервис', 120),
  ('hr', 'Human Resources', 'Ressources humaines', 'Human Resources', 'Personalwesen', 'Управление персоналом', 130),
  ('legal', 'Juridisch', 'Juridique', 'Legal', 'Rechtswesen', 'Юриспруденция', 140),
  ('manufacturing', 'Productie', 'Production', 'Manufacturing', 'Produktion', 'Производство', 150),
  ('quality_safety', 'Kwaliteit & Veiligheid', 'Qualité & Sécurité', 'Quality & Safety', 'Qualität & Sicherheit', 'Качество и безопасность', 160),
  ('creative_design', 'Creatief & Design', 'Créatif & Design', 'Creative & Design', 'Kreativ & Design', 'Креатив и дизайн', 170),
  ('media_communication', 'Media & Communicatie', 'Médias & Communication', 'Media & Communication', 'Medien & Kommunikation', 'Медиа и коммуникации', 180),
  ('real_estate', 'Vastgoed', 'Immobilier', 'Real Estate', 'Immobilien', 'Недвижимость', 190),
  ('agriculture', 'Landbouw', 'Agriculture', 'Agriculture', 'Landwirtschaft', 'Сельское хозяйство', 200),
  ('social_services', 'Sociale Diensten', 'Services sociaux', 'Social Services', 'Soziale Dienste', 'Социальные услуги', 210),
  ('sports_fitness', 'Sport & Fitness', 'Sport & Fitness', 'Sports & Fitness', 'Sport & Fitness', 'Спорт и фитнес', 220),
  ('environment', 'Milieu', 'Environnement', 'Environment', 'Umwelt', 'Экология', 230),
  ('security', 'Beveiliging', 'Sécurité', 'Security', 'Sicherheit', 'Безопасность', 240),
  ('other', 'Overige', 'Autre', 'Other', 'Sonstige', 'Прочее', 250)
ON CONFLICT (slug) DO NOTHING;

