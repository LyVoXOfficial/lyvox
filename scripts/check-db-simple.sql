-- Quick check of generation insights progress

\echo '============================================================'
\echo 'GENERATION INSIGHTS PROGRESS CHECK'
\echo '============================================================'
\echo ''

\echo 'Total generations to process:'
SELECT COUNT(*) as total_generations 
FROM vehicle_generations 
WHERE code IS NOT NULL AND code != '';

\echo ''
\echo 'Insights created (Russian):'
SELECT COUNT(*) as created_insights 
FROM vehicle_generation_insights;

\echo ''
\echo 'Translations by locale:'
SELECT locale, COUNT(*) as count 
FROM vehicle_generation_insights_i18n 
GROUP BY locale 
ORDER BY locale;

\echo ''
\echo '============================================================'

