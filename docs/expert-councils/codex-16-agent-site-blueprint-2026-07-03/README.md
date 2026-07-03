# Codex 16-Agent Expert Council - LyVoX Site Blueprint

Дата: 2026-07-03  
Формат: независимый экспертный совет Codex, отдельный от Claude Code  
Модель агентов: `gpt-5.5`, reasoning effort `xhigh`, service tier `priority`  
Scope: стратегия продукта, UX, SEO, дизайн, доверие, монетизация, локализация и юридические ограничения. Проверка на Samsung и device QA намеренно не выполнялись.

## Итог в одну строку

LyVoX должен позиционироваться не как "самый безопасный marketplace" и не как "бельгийский Vinted", а как **локальный бельгийский marketplace, где первые результаты свежие, понятные и дают более ясные seller signals до контакта**.

## Главный verdict

Домашняя страница должна перестать быть landing page с каруселями, слабой статистикой и маркетинговыми trust-блоками. Она должна стать marketplace-first поверхностью:

1. Один canonical search: query + category + location.
2. Сразу над или внутри первого viewport: 2-4 SSR organic quality listings с фиксированными image boxes.
3. Затем первый organic quality grid без paid slots.
4. Trust не как billboard, а как product mechanics: card metadata, seller status, ranking, report/block, contact panel, chat safety prompts.
5. Paid placement и Pro не покупают доверие и не попадают в первый proof grid.

## Файлы

- [01-method-roles.md](./01-method-roles.md) - метод, исходный бриф, роли 16 агентов.
- [02-rounds-and-votes.md](./02-rounds-and-votes.md) - позиции, дебаты, изменения мнений, голосование.
- [FINAL_BLUEPRINT.md](./FINAL_BLUEPRINT.md) - финальный blueprint для сравнения и реализации.

## Регуляторные источники, проверенные отдельно

- European Commission: Digital Services Act - marketplaces, ad transparency, reporting, seller traceability: https://digital-strategy.ec.europa.eu/en/policies/digital-services-act
- EUR-Lex Regulation 2022/2065 - DSA Articles 30-31 on trader traceability and compliance by design: https://eur-lex.europa.eu/eli/reg/2022/2065/oj/eng
- European Commission: European Accessibility Act - e-commerce is in covered services: https://commission.europa.eu/strategy-and-policy/policies/justice-and-fundamental-rights/disability/european-accessibility-act-eaa_en
- European Commission: Data protection explained: https://commission.europa.eu/law/law-topic/data-protection/data-protection-explained_en

## Важно

Это продуктово-дизайнерский и технический blueprint, не юридическое заключение. Формулировки для trader status, KYBC, consumer-rights notices, paid placement и contact-only disclosure нужно финально проверить с юристом перед production launch.
