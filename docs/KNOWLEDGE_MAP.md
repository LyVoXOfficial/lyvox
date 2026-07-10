> [!WARNING]
> **Историческая карта документации от 2025-11-09. Не использовать указанные ниже entrypoint, authority или checklist для выбора задач.** Единственная актуальная точка входа в production-работу: [`docs/MASTER_PRODUCTION_TZ.md`](./MASTER_PRODUCTION_TZ.md). Карта сохранена до отдельной регенерации.

last_sync: 2025-11-09

# LyVoX Knowledge Map

**Purpose:** Concise hierarchy of the LyVoX documentation stack, showing relationships, authority sources, and the layered knowledge structure for both humans and AI assistants.

**Audience:** Contributors and agents needing fast orientation within the documentation system.

---

## 📚 Documentation Hierarchy

> **Historical mapping (retired):** at the time, `PROMPT_MAIN.md` was treated as the root entrypoint. Do not use it to start current work.

```text
📁 LyVoX Workspace (root)
│
├─ 📄 PROMPT_MAIN.md                     Historical root entrypoint (retired)
│   └─ Historical entry point for AI assistants and contributors (retired)
│   └─ Historical links to retired checklist and deployment workflows
│
├─ 📁 docs/                              Historical documentation root
│   │
│   ├─ 📄 KNOWLEDGE_MAP.md               📚 This document — knowledge hierarchy
│   │
│   ├─ 📄 CURSOR_KNOWLEDGE_BASE.md       🌐 General Technical Foundation
│   │   └─ Consolidated architectural patterns, security, and platform-wide rules
│   │
│   ├─ 📁 Core Documentation              🏗️ System Contracts & Planning
│   │   ├─ 📄 ARCHITECTURE.md            (System topology, journeys, stack versions)
│   │   ├─ 📄 ARCH_RULES.md              (Non-negotiable architectural constraints)
│   │   ├─ 📄 requirements.md            (Requirements, ERD, RLS, environment matrix)
│   │   ├─ 📄 API_REFERENCE.md           (API contracts and schemas)
│   │   ├─ 📄 PLAN.md                    (Roadmap and milestones)
│   │   ├─ 📄 TODO.md                    (Historical backlog; retired)
│   │   ├─ 📄 INSTALL.md                 (Environment setup)
│   │   ├─ 📄 MCP_SERVICES.md            (Supabase & Vercel MCP usage)
│   │   └─ Additional planning/compliance docs
│   │
│   ├─ 📁 domains/                       🏢 Domain-Specific Business Logic
│   │   ├─ adverts.md | profile.md | auth.md | moderation.md | trust_score.md
│   │   ├─ phones.md | chat.md | billing.md | deals.md | analytics.md
│   │   ├─ support_disputes.md | seo.md | i18n.md | devops.md | consents.md
│   │   └─ (Conceptual descriptions of business flows and rules)
│   │
│   ├─ 📁 development/                   💻 Implementation Guides & Modules
│   │   ├─ 📄 MASTER_CHECKLIST.md        Historical prioritized list (retired)
│   │   ├─ 📄 README.md                  (Development documentation overview)
│   │   ├─ 📄 database-schema.md         (Supabase schema details)
│   │   ├─ 📄 api-architecture.md        (Route handler design patterns)
│   │   ├─ 📄 security-compliance.md     (Security, RLS, GDPR, anti-fraud)
│   │   ├─ 📄 backend-logic.md           (Server-side modules)
│   │   ├─ 📄 ui-guides.md               (UI/UX conventions)
│   │   ├─ Feature guides: homepage-navigation.md, search-filters.md,
│   │   │   categories.md, ad-posting.md, ad-view.md, user-profile.md,
│   │   │   verification.md, chat-messages.md, billing-subscriptions.md,
│   │   │   moderation-ai.md, admin-panel.md, notifications.md,
│   │   │   user-dashboard.md, seo-metadata.md, i18n.md, mobile-responsive.md
│   │   └─ Planning files: roadmap.md, risks-mitigation.md, checklists.md
│   │
│   └─ 📁 catalog/                       📦 Category & Enrichment System
│       ├─ 📄 CATALOG_MASTER.md          (Master catalog design)
│       ├─ 📄 AI_ENRICHMENT.md           (AI enrichment strategy)
│       ├─ 📄 DATABASE_STRATEGY.md       (Catalog database blueprint)
│       ├─ 📄 POSTFORM_INTEGRATION.md    (Ad posting integration guidance)
│       ├─ 📄 SEARCHFILTERS_EXTENSION.md (Enhanced search filters)
│       └─ 📁 categories/                (Per-category attribute guides)
│           ├─ electronics.md | fashion.md | real-estate.md
│           ├─ jobs.md | home-kids-pets-misc.md
│
└─ 📁 Code & Migrations
    ├─ apps/web/src/                     (Next.js application)
    ├─ supabase/migrations/              (Canonical database schema)
    └─ supabase/types/                   (Generated TypeScript types)
```

---

## Historical authority sources (retired)

| Document | Authoritative For |
|----------|-------------------|
| `PROMPT_MAIN.md` | Historical AI workflow and deployment rules (retired) |
| `docs/CURSOR_KNOWLEDGE_BASE.md` | Global technical patterns and architecture principles |
| `docs/ARCHITECTURE.md` | System topology, journeys, and stack versions |
| `docs/ARCH_RULES.md` | Non-negotiable architectural constraints |
| `docs/requirements.md` | Schema, RLS policies, compliance, environment setup |
| `docs/API_REFERENCE.md` | API contracts (request/response schemas) |
| `docs/development/MASTER_CHECKLIST.md` | Historical priorities and completion tracking (retired) |
| `supabase/migrations/` | Canonical database definition |
| `supabase/types/database.types.ts` | Generated TypeScript types matching schema |

---

## 📖 Layered Knowledge System

1. **Layer 1 — Historical root entry point:** `PROMPT_MAIN.md` (retired workflow).
2. **Layer 2 — General Foundation:** `docs/CURSOR_KNOWLEDGE_BASE.md` (global technical knowledge).  
3. **Layer 3 — Core Documentation:** Root-level docs inside `docs/` (architecture, requirements, planning).  
4. **Layer 4 — Domain Knowledge:** `docs/domains/` (business logic, conceptual rules).  
5. **Layer 5 — Implementation Guides:** `docs/development/` (how-to, modules, checklists).  
6. **Layer 6 — Specialized Systems:** `docs/catalog/` (taxonomy, AI enrichment, category specifics).  

---

## 🔗 Cross-Reference Patterns

- **Domain ↔ Development:** Domain docs explain *what/why*; development docs explain *how/where*. Example: `domains/moderation.md` ↔ `development/moderation-ai.md`.  
- **Development ↔ Master Checklist:** historical links to retired IDs in `MASTER_CHECKLIST.md` (for traceability only).
- **Catalog ↔ Implementation:** `catalog/CATALOG_MASTER.md` (strategy) ↔ `development/categories.md` (execution) ↔ `catalog/categories/*.md` (attributes).  
- **PROMPT_MAIN.md ↔ KNOWLEDGE_MAP.md:** historical circular navigation, now retired.
- **CURSOR_KNOWLEDGE_BASE.md ↔ All Layers:** Acts as the shared foundation for domain and development docs.  

---

## 🔍 Navigation Guidelines

### For New Contributors

1. Retired instruction: do not use `PROMPT_MAIN.md` as current workflow or governance.
2. Skim `docs/CURSOR_KNOWLEDGE_BASE.md` for platform fundamentals.  
3. Review `docs/ARCHITECTURE.md` and `docs/requirements.md` for high-level context.  
4. Historical instruction, no longer valid: use `docs/development/MASTER_CHECKLIST.md` to pick tasks.

### For AI Assistants

1. Historical instruction, no longer valid: start with `PROMPT_MAIN.md`.
2. Use `CURSOR_KNOWLEDGE_BASE.md` for architectural patterns.  
3. Dive into `docs/domains/` for business logic.  
4. Historical instruction, no longer valid: implement from `docs/development/` guides and update `MASTER_CHECKLIST.md`.
5. Consult `docs/catalog/` for taxonomy, AI enrichment, and attribute structures.  

### Quick Lookup

- **“How does feature X work?”** → `docs/domains/x.md`.  
- **“How to implement module Y?”** → `docs/development/y.md`.  
- **“What is the API contract?”** → `docs/API_REFERENCE.md`.  
- **“Which schema changes are required?”** → `supabase/migrations/` + `docs/requirements.md`.  
- **“Where is the global technical guidance?”** → `docs/CURSOR_KNOWLEDGE_BASE.md`.  

---

## Historical privacy statement (retired)

The former instruction to keep `/docs` local and exclude it from Git is no longer valid for this repository. Do not change Git visibility, ignore rules, publishing policy, or repository access based on this archive; follow the current repository governance and `docs/MASTER_PRODUCTION_TZ.md`.

---

## 🔄 Maintenance

- Update this map when new documentation layers or directories are introduced.  
- Revise authority table if canonical sources change.  
- Keep cross-reference examples in sync with major document reorganizations.  
- Do not maintain `last_sync` manually; regenerate or retire this map through an explicit current task.
- Do not validate current documentation against retired `PROMPT_MAIN.md`.

---

## Cross-References

- 🔗 `PROMPT_MAIN.md` — historical root entrypoint (retired).
- 🔗 `docs/CURSOR_KNOWLEDGE_BASE.md` — foundational technical knowledge.  
- 🔗 `docs/development/MASTER_CHECKLIST.md` — historical execution track (retired).

Current navigation and execution begin in [`docs/MASTER_PRODUCTION_TZ.md`](./MASTER_PRODUCTION_TZ.md), not in `PROMPT_MAIN.md`.


## 🤖 AI Enrichment & Cross-Reference System

This workspace maintains AI-generated links between domain, development, and catalog documents.

See `docs/AI_LINKS_INDEX.md` for the full matrix of relationships.
