last_sync: 2025-11-09

# LyVoX Cursor Knowledge Base

**Purpose:** General technical foundation and architectural patterns for the LyVoX marketplace platform. This document consolidates core technical knowledge extracted from architecture, security, database, and DevOps documentation — representing “global technical knowledge” independent of specific project features.

**Audience:** AI assistants (Codex/Cursor) and new contributors who need to understand the platform’s foundational principles before diving into project-specific logic.

---

## Stack & Technology Foundation

### Core Technologies

- **Runtime:** Node.js ≥ 20 LTS  
- **Language:** TypeScript 5.9  
- **Frontend Framework:** Next.js 16.0.0 (App Router with SSR/ISR)  
- **UI Framework:** React 19.2.0  
- **Styling:** TailwindCSS 4, shadcn/ui, Radix UI primitives  
- **Database:** Supabase Postgres with Row-Level Security (RLS) enabled everywhere  
- **Authentication:** Supabase Auth (magic link, phone OTP, future Itsme OAuth)  
- **Storage:** Supabase Storage (bucket `ad-media`)  
- **Package Manager:** pnpm + Turborepo  
- **Hosting:** Vercel  
- **Rate Limiting:** Upstash Redis sliding window strategy  

### Version Constraints

Pinned versions from `docs/ARCH_RULES.md`:

- `@supabase/supabase-js` 2.76.x  
- `@supabase/ssr` 0.7.x (pinned — upgrade only after verification)  

**Upgrade policy for `@supabase/ssr`:**

1. `pnpm install` completes without registry/build errors  
2. `pnpm exec tsc -p apps/web/tsconfig.json --noEmit` passes  
3. Manual SSR smoke test succeeds (`supabaseServer()` fetching the current profile server-side)  

---

## Authentication & Authorization Patterns

### Identity Architecture

- **Profile ↔ Auth linkage:** `public.profiles.id` matches `auth.users.id` (one-to-one).  
- **Role enforcement:** JWT `app_metadata.role` claims must be validated on the server; never trust client-provided roles.  
- **Admin role:** Verified through the `public.is_admin()` helper function.  
- **Trust score:** Read-only for clients; only service-role handlers may call `trust_inc(uid, pts)`.  

### Access Roles

| Role | Capabilities |
|------|--------------|
| **guest** | Read-only public data |
| **user** | CRUD own adverts/media, submit reports, verify phone numbers |
| **moderator/admin** | Moderation queue, trust adjustments, user management |

### Authentication Flow

```typescript
// Server-side user context
const supabase = await supabaseServer();
const { data: { user } } = await supabase.auth.getUser();

// Service-role for privileged operations (bypasses RLS)
const supabaseAdmin = supabaseService();
// ⚠️ Always validate authorization before using service role clients.
```

---

## Database Architecture & Patterns

### Row-Level Security (RLS)

**Core principle:** Every table must have RLS enabled. Authorization is enforced at the database layer; service-role bypass requires explicit validation.

**Policy patterns:**

```sql
-- Adverts: public read active, owners manage own
CREATE POLICY "adverts_read_active" ON public.adverts
  FOR SELECT USING (status = 'active');

CREATE POLICY "adverts_owner_manage" ON public.adverts
  FOR ALL USING (auth.uid() = user_id);

-- Admin override (read/update/delete any)
CREATE POLICY "adverts_admin_all" ON public.adverts
  FOR ALL USING (public.is_admin());
```

**Helper functions:**

```sql
-- Admin role check
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN (auth.jwt() ->> 'app_metadata')::jsonb ->> 'role' = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trust score adjustment
CREATE OR REPLACE FUNCTION public.trust_inc(uid uuid, pts integer)
RETURNS void AS $$
BEGIN
  INSERT INTO public.trust_score (user_id, score)
  VALUES (uid, GREATEST(0, LEAST(100, pts)))
  ON CONFLICT (user_id)
  DO UPDATE SET
    score = GREATEST(0, LEAST(100, trust_score.score + pts)),
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Migration Strategy

- All schema changes must ship as SQL migrations in `supabase/migrations/`.  
- Regenerate types to `supabase/types/database.types.ts` after schema updates.  
- Validate alignment across migrations ↔ generated types ↔ `docs/requirements.md`.  

---

## API Design Patterns

### Response Format Contract

**Success:**

```json
{
  "ok": true,
  "data": { /* payload */ }
}
```

**Error:**

```json
{
  "ok": false,
  "error": "ERROR_CODE",
  "detail": "Human-readable description"
}
```

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Success |
| 400 | Bad request (validation failed) |
| 401 | Unauthorized (no valid session) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 429 | Rate limited |
| 500 | Internal server error |

### Validation Pattern

Use Zod for all request validation:

```typescript
import { z } from 'zod';

const requestSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(5000),
  // ...
});

const body = await request.json();
const validated = requestSchema.safeParse(body);
if (!validated.success) {
  return NextResponse.json(
    { ok: false, error: 'VALIDATION_ERROR', detail: validated.error.message },
    { status: 400 },
  );
}
```

---

## Security Principles

### Rate Limiting Blueprint

- Upstash Redis sliding window implementation.  
- Keys differentiate anonymous (IP) and authenticated (user) contexts.  
- Expose `RateLimit-Limit`, `RateLimit-Remaining`, and `Retry-After` headers on responses.  

| Endpoint | Limit | Key | Window |
|----------|-------|-----|--------|
| `/api/phone/request` | 5 per user | `otp:user:<uid>` | 15 minutes |
| `/api/phone/request` | 20 per IP | `otp:ip:<ip>` | 60 minutes |
| `/api/reports/create` | 5 per user | `report:user:<uid>` | 10 minutes |
| `/api/reports/create` | 50 per IP | `report:ip:<ip>` | 24 hours |
| `/api/admin/*` | 60 per admin | `report:admin:<uid>` | 1 minute |

### Service Role Caution

⚠️ `supabaseService()` bypasses RLS. Always validate authorization before invoking it.

```typescript
// ❌ WRONG
const adminClient = supabaseService();
await adminClient.from('adverts').delete().eq('id', advertId);

// ✅ CORRECT
const userClient = await supabaseServer();
const { data: { user } } = await userClient.auth.getUser();
if (!user || !isAdmin(user)) {
  return NextResponse.json({ ok: false, error: 'FORBIDDEN' }, { status: 403 });
}
const adminClient = supabaseService();
await adminClient.from('adverts').delete().eq('id', advertId);
```

### Secrets Management

- Local development secrets live in `.env.local`.  
- Production secrets managed via Vercel environment variables.  
- **Never** expose `SUPABASE_SERVICE_ROLE_KEY` to the client bundle.  
- Server-only imports protected by Next.js build pipeline (Edge/server split).  

---

## Media & Storage Patterns

### Upload Pipeline

1. **Signed URL issuance:** `/api/media/sign` (authenticated; verifies advert ownership).  
2. **Client upload:** Direct to Supabase Storage using the signed URL.  
3. **Metadata persistence:** Insert into `public.media` with `{ path, width, height, order_index }`.  
4. **Public delivery:** Generate signed URLs only when advert status is `active`.  

### Storage Layout

```
ad-media/
  {user_id}/
    {advert_id}/
      {timestamp}-{filename}.jpg
```

### Constraints

- Maximum 12 images per advert (~5 MB each).  
- `order_index` determines cover image (smallest value displayed first).  
- Scheduled cleanup for orphaned uploads remains on the TODO backlog.  

---

## DevOps & Deployment Practices

### Environments

- **Local:** `pnpm dev` with `.env.local`.  
- **Preview:** Vercel preview deployments per pull request.  
- **Production:** Vercel production tied to the main branch.  

### Deployment Checklist

1. `pnpm install` — ensure dependency graph resolves.  
2. `pnpm exec tsc --noEmit` — maintain type safety.  
3. Apply Supabase migrations (CLI or MCP).  
4. Ensure environment variables are synced (Vercel dashboard / CLI).  
5. Regenerate Supabase types when schema changes.  

### Monitoring & Observability

- Application audit logs stored in `public.logs`.  
- Platform observability via Vercel and Cloudflare logs.  
- Rate-limit telemetry inspected through Upstash metrics.  
- Future enhancements: integrate Sentry/Logflare, Supabase alerts for slow queries.  

### Backup Strategy

- Supabase automated daily backups.  
- Manual `supabase db dump --linked` per release for point-in-time recovery.  
- Supabase Storage replication covers media assets; consider periodic cold storage export.  
- Snapshot `pnpm-lock.yaml` alongside release tags for reproducible installs.  

---

## Core Architectural Rules

Pulled from `docs/ARCH_RULES.md`:

### Constraints

1. Database tables must keep RLS enabled (no exceptions).  
2. Admin privileges only via JWT `app_metadata.role = 'admin'`.  
3. No server-only keys in client bundles.  
4. Rate limiting is mandatory for sensitive endpoints (OTP, moderation).  
5. Media cleanup must cascade when adverts are deleted.  
6. All sensitive operations must log to `public.logs`.  

### Principles

1. **SSR/ISR first:** Prevent leaking private data to clients.  
2. **Server-side authorization:** All permission checks run on the server.  
3. **Idempotency:** OTP and moderation operations must be repeatable without adverse effects.  
4. **Observability:** Maintain audit trails for compliance.  

---

## Reference Documents

For project-specific details, consult:

- `docs/ARCHITECTURE.md` — system topology, user journeys, stack versions.  
- `docs/domains/*.md` — domain-specific business logic.  
- `docs/development/*.md` — implementation guides, feature specs, task tracking.  
- `docs/API_REFERENCE.md` — API contracts and schemas.  
- `docs/requirements.md` — comprehensive requirements, ER diagrams, environment matrix.  

---

## Maintenance Notes

- Update this document when foundational architecture, security practices, or platform-wide patterns change.  
- Keep `last_sync` aligned with the latest modification date.  
- Link back to this document when other guides rely on global technical context.  
- Cross-reference with `docs/KNOWLEDGE_MAP.md` and `PROMPT_MAIN.md` for navigation guidance.  



