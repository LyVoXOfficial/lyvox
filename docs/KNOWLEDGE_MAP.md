last_sync: 2025-11-09

# LyVoX Knowledge Map

**Purpose:** Concise hierarchy of the LyVoX documentation stack, showing relationships, authority sources, and the layered knowledge structure for both humans and AI assistants.

**Audience:** Contributors and agents needing fast orientation within the documentation system.

---

## 📚 Documentation Hierarchy

> **PROMPT_MAIN.md** is the root entrypoint. Every documentation journey starts there.

```text
📁 LyVoX Workspace (root)
│
├─ 📄 PROMPT_MAIN.md                     🎯 Root Knowledge Entrypoint
│   └─ Entry point for AI assistants and contributors
│   └─ Links to Master Checklist, deployment workflows, core references
│
├─ 📁 docs/                              🔒 Private Documentation Root (never public)
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
│   │   ├─ 📄 TODO.md                    (Operational backlog)
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
│   │   ├─ 📄 MASTER_CHECKLIST.md        🎯 Start here — prioritized task list
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

## 🎯 Authority Sources

| Document | Authoritative For |
|----------|-------------------|
| `PROMPT_MAIN.md` | AI workflow, deployment checklist, task execution rules |
| `docs/CURSOR_KNOWLEDGE_BASE.md` | Global technical patterns and architecture principles |
| `docs/ARCHITECTURE.md` | System topology, journeys, and stack versions |
| `docs/ARCH_RULES.md` | Non-negotiable architectural constraints |
| `docs/requirements.md` | Schema, RLS policies, compliance, environment setup |
| `docs/API_REFERENCE.md` | API contracts (request/response schemas) |
| `docs/development/MASTER_CHECKLIST.md` | Task priorities, dependencies, completion tracking |
| `supabase/migrations/` | Canonical database definition |
| `supabase/types/database.types.ts` | Generated TypeScript types matching schema |

---

## 📖 Layered Knowledge System

1. **Layer 1 — Root Entry Point:** `PROMPT_MAIN.md` (start here for workflow, references, and governance).  
2. **Layer 2 — General Foundation:** `docs/CURSOR_KNOWLEDGE_BASE.md` (global technical knowledge).  
3. **Layer 3 — Core Documentation:** Root-level docs inside `docs/` (architecture, requirements, planning).  
4. **Layer 4 — Domain Knowledge:** `docs/domains/` (business logic, conceptual rules).  
5. **Layer 5 — Implementation Guides:** `docs/development/` (how-to, modules, checklists).  
6. **Layer 6 — Specialized Systems:** `docs/catalog/` (taxonomy, AI enrichment, category specifics).  

---

## 🔗 Cross-Reference Patterns

- **Domain ↔ Development:** Domain docs explain *what/why*; development docs explain *how/where*. Example: `domains/moderation.md` ↔ `development/moderation-ai.md`.  
- **Development ↔ Master Checklist:** Implementation guides link to IDs in `MASTER_CHECKLIST.md` (e.g., `UI-015`, `DB-003`).  
- **Catalog ↔ Implementation:** `catalog/CATALOG_MASTER.md` (strategy) ↔ `development/categories.md` (execution) ↔ `catalog/categories/*.md` (attributes).  
- **PROMPT_MAIN.md ↔ KNOWLEDGE_MAP.md:** PROMPT references this map; this map points back to PROMPT as the root.  
- **CURSOR_KNOWLEDGE_BASE.md ↔ All Layers:** Acts as the shared foundation for domain and development docs.  

---

## 🔍 Navigation Guidelines

### For New Contributors

1. Read `PROMPT_MAIN.md` to understand workflow and governance.  
2. Skim `docs/CURSOR_KNOWLEDGE_BASE.md` for platform fundamentals.  
3. Review `docs/ARCHITECTURE.md` and `docs/requirements.md` for high-level context.  
4. Follow `docs/development/MASTER_CHECKLIST.md` to pick prioritized tasks.  

### For AI Assistants

1. Always start with `PROMPT_MAIN.md`.  
2. Use `CURSOR_KNOWLEDGE_BASE.md` for architectural patterns.  
3. Dive into `docs/domains/` for business logic.  
4. Implement using `docs/development/` guides; update `MASTER_CHECKLIST.md` as required.  
5. Consult `docs/catalog/` for taxonomy, AI enrichment, and attribute structures.  

### Quick Lookup

- **“How does feature X work?”** → `docs/domains/x.md`.  
- **“How to implement module Y?”** → `docs/development/y.md`.  
- **“What is the API contract?”** → `docs/API_REFERENCE.md`.  
- **“Which schema changes are required?”** → `supabase/migrations/` + `docs/requirements.md`.  
- **“Where is the global technical guidance?”** → `docs/CURSOR_KNOWLEDGE_BASE.md`.  

---

## 🔒 Privacy & Repository Policy

The **entire `/docs` directory (including this file and `PROMPT_MAIN.md`) must remain private**. Do not upload, push, or sync documentation to any public repository.  

- Contains internal specifications, schema, compliance notes.  
- Must stay local until a secure private repository is configured.  
- Ensure `.gitignore` excludes `/docs/**`.  
- AI assistants must not publish or leak documentation content.  

---

## 🔄 Maintenance

- Update this map when new documentation layers or directories are introduced.  
- Revise authority table if canonical sources change.  
- Keep cross-reference examples in sync with major document reorganizations.  
- Refresh `last_sync` whenever edits occur.  
- Validate this map against `PROMPT_MAIN.md` and `CURSOR_KNOWLEDGE_BASE.md` after updates.  

---

## Cross-References

- 🔗 `PROMPT_MAIN.md` — root knowledge entrypoint (this file references it explicitly).  
- 🔗 `docs/CURSOR_KNOWLEDGE_BASE.md` — foundational technical knowledge.  
- 🔗 `docs/development/MASTER_CHECKLIST.md` — operational execution track.  

📚 For full navigation instructions, see the “Knowledge Context” section inside `PROMPT_MAIN.md`.

