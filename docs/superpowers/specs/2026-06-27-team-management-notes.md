# Business Team Management (invite / accept / remove) — Build Note

**Status:** Build-ready, company-free, ACTIVE (growth feature, not a launch-blocker). The `business_members` table +
anti-escalation RLS already exist; this adds the invite-by-email / accept / remove flows + UI on top.

## 0. Existing model (verified on prod)
- `business_members(business_id, user_id, role['owner'|'admin'|'member'], invited_by, accepted_at, created_at)`.
- `create_business` makes the creator an accepted `owner`. `is_business_member(id, min_role)` = numeric hierarchy
  (owner3≥admin2≥member1) AND `accepted_at is not null` — so a PENDING invite (accepted_at null) does NOT yet grant
  membership permissions.
- RLS already supports the flows (no RLS changes needed):
  - `bm_admin_manage` (INSERT, authenticated): `is_business_member(business_id,'admin') AND role <> 'owner'` — an
    accepted owner/admin can insert a pending member/admin (never an owner).
  - `bm_admin_remove` (DELETE, authenticated): same gate — owner/admin can remove non-owner rows.
  - `bm_invitee_accept` (UPDATE, authenticated): invitee sets their own row's `accepted_at`; role is PINNED (no escalation).
  - `bm_self_read` (SELECT): user reads own membership; accepted members read the team.

## 1. Pieces
### 1.1 Migration — `find_user_by_email` (email → user_id lookup; auth.users isn't PostgREST-exposed)
- `create function public.find_user_by_email(p_email text) returns uuid` SECURITY DEFINER, `search_path=public, pg_temp`:
  `select id from auth.users where lower(email) = lower(trim(p_email)) limit 1;`
- **APPLY THE FUNCTION-GRANT LESSON:** `revoke execute on function public.find_user_by_email(text) from public, authenticated, anon; grant execute … to service_role;` (Supabase default-grants EXECUTE to authenticated+anon — a `revoke from public` alone is insufficient; otherwise any user could enumerate emails). Verify `has_function_privilege('authenticated', fn, 'execute')=false`.
- Dry-run (inline, rolled back — NEVER `\i` a migration inside a manual BEGIN) then apply; verify the grant.

### 1.2 API
- **`POST /api/business/[id]/members`** (invite). Auth required (401). Gate: requester must be an accepted admin/owner of the
  business — verify via the cookie client `is_business_member`-equivalent (query `business_members` where business_id=id,
  user_id=requester, accepted_at not null, role in ('owner','admin')) → else 403. Body (zod): `{ email: string(email),
  role: 'member'|'admin' }` (NOT 'owner' → 400). Look up `user_id` via `service.rpc('find_user_by_email', {p_email:email})`:
  - not found → 404 `USER_NOT_FOUND` (detail: invitee must register first).
  - found but already a member (accepted or pending) of this business → 409 `ALREADY_MEMBER`.
  - else INSERT (service-role) `{ business_id:id, user_id, role, invited_by: requester.id, accepted_at: null }` → 200.
  - Optionally create a `notifications` row for the invitee (service-role) — nice-to-have; include if trivial.
- **`POST /api/business/[id]/members/accept`** (invitee accepts). Auth required. The invitee updates THEIR pending row's
  `accepted_at=now()` via the cookie client (RLS `bm_invitee_accept` allows it). 404 if no pending invite. 200.
- **`DELETE /api/business/[id]/members/[userId]`** (remove). Auth required. Gate: requester is accepted admin/owner. Cannot
  remove an `owner` row (400/403). Cannot remove self if sole owner. Delete via cookie client (RLS `bm_admin_remove` allows
  non-owner deletes) or service-role after the gate. 200.
- (Role-change PATCH = follow-up; not in this slice — keep it tight.)
- Validation lib `lib/validations/teamMembers.ts` (zod: email + role enum member|admin). Reuse `createErrorResponse`/envelope.
- Tests for each route: auth 401; non-admin requester 403; invite happy (pending row inserted, invited_by set); email
  not-found 404; already-member 409; role='owner' rejected; accept sets accepted_at; remove non-owner ok; remove owner blocked.

### 1.3 UI — BusinessCabinet team section (extend the existing read-only team list)
- For owners/admins: an **invite form** (email + role select member/admin) posting to `POST …/members`; on success toast +
  refresh; show 404/409 errors inline. Per-member: a **Remove** button (hidden for owner rows + self) → DELETE.
- Pending vs accepted: show a "Pending" chip for rows with `accepted_at=null`.
- For an invitee with a pending invite (their own row pending): surface an **Accept invitation** affordance (in the cabinet
  or wherever they land) → POST accept. (If the invitee has no active business of their own, the cabinet may show the wizard;
  ensure pending invites are still reachable — simplest: show pending invites at the top of `/pro` regardless.)
- i18n `team.*` ×5 (invite/role/remove/accept/pending/errors). Parity guard passes.

## 2. Tasks (TDD)
- **T1** migration `20260627260000_find_user_by_email.sql` (rpc + grant lesson) + dry-run + apply + types.
- **T2** API routes (invite/accept/remove) + validations + tests.
- **T3** UI (invite form + remove + pending chip + accept) + i18n ×5.
- **T4** review + deploy + prod-verify (invite a 2nd test account by email → pending → accept → appears as member → remove;
  non-admin can't invite; owner can't be removed; find_user_by_email not executable by authenticated).

## 3. Out of scope (follow-ups)
- Role-change PATCH; email-invite to UNREGISTERED users (pending-by-email tokens); invite expiry; leave-business (self-remove);
  owner transfer (ties into the erasure business-owner block).
