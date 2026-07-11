> [!IMPORTANT]
> Единственная точка входа в production-работу и источник текущего статуса: [`docs/MASTER_PRODUCTION_TZ.md`](./MASTER_PRODUCTION_TZ.md). Остальные документы дают подчинённый контекст.

last_sync: 2026-07-11

# LyVoX Knowledge Map

**Purpose:** Concise hierarchy of the LyVoX documentation stack, showing relationships, authority sources, and the layered knowledge structure for both humans and AI assistants.

**Audience:** Contributors and agents needing fast orientation within the documentation system.

---

## 📚 Documentation Hierarchy

> Current navigation starts from the Production master. Architecture, domain and implementation documents do not own backlog priority or release status.

```text
📁 LyVoX Workspace (root)
│
├─ 📁 docs/                              Documentation root
│   │
│   ├─ 📄 MASTER_PRODUCTION_TZ.md        Canonical production backlog and status
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
│   │   └─ Planning support: risks-mitigation.md
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

## Authority sources

| Document | Authoritative For |
|----------|-------------------|
| `docs/MASTER_PRODUCTION_TZ.md` | Current scope, priority, status and release readiness |
| `docs/CURSOR_KNOWLEDGE_BASE.md` | Global technical patterns and architecture principles |
| `docs/ARCHITECTURE.md` | System topology, journeys, and stack versions |
| `docs/ARCH_RULES.md` | Non-negotiable architectural constraints |
| `docs/requirements.md` | Schema, RLS policies, compliance, environment setup |
| `docs/API_REFERENCE.md` | API contracts (request/response schemas) |
| `supabase/migrations/` | Canonical database definition |
| `supabase/types/database.types.ts` | Generated TypeScript types matching schema |

---

## 📖 Layered Knowledge System

1. **Layer 1 — Production entry point:** `docs/MASTER_PRODUCTION_TZ.md`.
2. **Layer 2 — General Foundation:** `docs/CURSOR_KNOWLEDGE_BASE.md` (global technical knowledge).  
3. **Layer 3 — Core Documentation:** Root-level docs inside `docs/` (architecture, requirements, planning).  
4. **Layer 4 — Domain Knowledge:** `docs/domains/` (business logic, conceptual rules).  
5. **Layer 5 — Implementation Guides:** `docs/development/` (how-to, modules, checklists).  
6. **Layer 6 — Specialized Systems:** `docs/catalog/` (taxonomy, AI enrichment, category specifics).  

---

## 🔗 Cross-Reference Patterns

- **Domain ↔ Development:** Domain docs explain *what/why*; development docs explain *how/where*. Example: `domains/moderation.md` ↔ `development/moderation-ai.md`.  
- **Catalog ↔ Implementation:** `catalog/CATALOG_MASTER.md` (strategy) ↔ `development/categories.md` (execution) ↔ `catalog/categories/*.md` (attributes).  
- **CURSOR_KNOWLEDGE_BASE.md ↔ All Layers:** Acts as the shared foundation for domain and development docs.  

---

## 🔍 Navigation Guidelines

### For New Contributors

1. Start from `docs/MASTER_PRODUCTION_TZ.md` for current work and release status.
2. Skim `docs/CURSOR_KNOWLEDGE_BASE.md` for platform fundamentals.  
3. Review `docs/ARCHITECTURE.md` and `docs/requirements.md` for high-level context.  

### For AI Assistants

1. Start with `docs/MASTER_PRODUCTION_TZ.md`.
2. Use `CURSOR_KNOWLEDGE_BASE.md` for architectural patterns.  
3. Dive into `docs/domains/` for business logic.  
4. Consult `docs/catalog/` for taxonomy, AI enrichment, and attribute structures.

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

---

## Cross-References

- 🔗 `docs/CURSOR_KNOWLEDGE_BASE.md` — foundational technical knowledge.  

Current navigation and execution begin in [`docs/MASTER_PRODUCTION_TZ.md`](./MASTER_PRODUCTION_TZ.md).
