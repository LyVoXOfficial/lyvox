# Reviews & Ratings (chat-gated) — Build Note

**Status:** Build-ready, company-free, ACTIVE. The last remaining growth feature. **Gating decision made here
(default, adjustable by founder): CHAT-GATED** — a reviewer may review a seller for a listing only if they had a
CONVERSATION about that listing. Rationale: contact-only marketplace has no on-platform transaction to gate on;
chat-gating is contact-aware and far harder to fake than open reviews or a gameable seller "mark-as-sold"
self-declaration. The founder can later tighten (e.g. require a mark-as-sold record) — the gate lives in ONE rpc.

## 0. Existing state
- `ProfileReviewsList.tsx` already RENDERS reviews; `ProfileReview = {id, rating, comment|null, created_at, author{display_name}|null}`; `/user/[id]` already expects `reviews: ProfileReview[]|null` (currently null — Phase B).
- `profiles.rating numeric default 5.0`, `profiles.total_deals int default 0`. `conversations.advert_id` links a chat to a listing. No `reviews` table yet.

## 1. Migration (T1) — `20260627270000_reviews.sql`
- **Table:** `reviews(id uuid pk default gen_random_uuid(), advert_id uuid not null references adverts(id) on delete cascade, reviewer_id uuid not null references auth.users(id) on delete cascade, subject_id uuid not null references auth.users(id) on delete cascade, rating int not null check (rating between 1 and 5), comment text, created_at timestamptz not null default now(), unique(advert_id, reviewer_id))`. (reviewer_id/subject_id CASCADE so erasure of a user removes their reviews — keeps the FK-to-auth.users graph all cascade/setnull; the rating trigger will refresh on delete.)
- **RLS:** enable. `reviews_public_read` SELECT `using(true)` (reviews are public). NO authenticated INSERT policy (insert ONLY via the rpc). `reviews_owner_update` UPDATE `using(reviewer_id=auth.uid())` `with check(reviewer_id=auth.uid())`; `reviews_owner_delete` DELETE `using(reviewer_id=auth.uid())`.
- **Grants (column-lock lesson):** `revoke insert on public.reviews from authenticated, anon;` (rpc-only insert). `revoke update on public.reviews from authenticated, anon; grant update (rating, comment) on public.reviews to authenticated;` (owner can edit only rating/comment, never reviewer_id/subject_id/advert_id). DELETE stays (RLS gates to own).
- **`create_review(p_advert_id uuid, p_rating int, p_comment text) returns uuid` SECURITY DEFINER, search_path=public,pg_temp:**
  - `v_reviewer := auth.uid()`; null → raise 'auth required'.
  - rating 1..5 else raise 'INVALID_RATING' (P0001).
  - `select user_id into v_subject from adverts where id=p_advert_id`; null → 'ADVERT_NOT_FOUND'.
  - `v_subject = v_reviewer` → 'CANNOT_REVIEW_SELF'.
  - **CHAT GATE:** `if not exists (select 1 from conversations c join conversation_participants cp on cp.conversation_id=c.id where c.advert_id=p_advert_id and cp.user_id=v_reviewer)` → raise 'NO_CONVERSATION'.
  - `insert into reviews(advert_id, reviewer_id, subject_id, rating, comment) values (p_advert_id, v_reviewer, v_subject, p_rating, nullif(trim(p_comment),''))` returning id. On `unique_violation` → raise 'ALREADY_REVIEWED'.
  - Uses `auth.uid()` (NOT a caller-supplied id) → safe to `grant execute … to authenticated` (revoke from anon). (Verify execute: authenticated=true, anon=false.)
- **Aggregate trigger:** `refresh_seller_rating()` SECURITY DEFINER — `after insert or update or delete on reviews for each row`: `update profiles set rating = coalesce((select round(avg(rating)::numeric,2) from public.reviews where subject_id = coalesce(NEW.subject_id, OLD.subject_id)), 5.0) where id = coalesce(NEW.subject_id, OLD.subject_id);` (SECURITY DEFINER bypasses the profiles column-lock; keeps the rating cache fresh). Also maintain a review count if useful (reuse total_deals? NO — total_deals is a separate concept; expose count via the API query instead).
- Dry-run (inline, rolled back — never `\i` inside manual BEGIN) proving: table+RLS+rpc+trigger created; authenticated can't INSERT directly (has_table_privilege INSERT=false); a fixture (rolled back) where a reviewer WITH a conversation about the advert can `create_review` and one WITHOUT gets NO_CONVERSATION; the trigger updates profiles.rating. Then apply. Hand-edit database.types.ts (reviews Row/Insert/Update + create_review fn).

## 2. API (T2)
- `POST /api/reviews` (nodejs): auth 401; body zod `{ advert_id: uuid, rating: int 1..5, comment?: string ≤1000 }`; call `supabase.rpc('create_review', {...})` on the COOKIE client (rpc uses auth.uid()); map raised errors: NO_CONVERSATION→403, ALREADY_REVIEWED→409, CANNOT_REVIEW_SELF→403, ADVERT_NOT_FOUND→404, INVALID_RATING→400; success→200 `{review_id}`. Rate-limit.
- `GET /api/reviews?subject=<userId>` (or fold into the profile loader): return the subject's reviews mapped to `ProfileReview` (join reviewer display_name as author). Public.
- Wire `/user/[id]` loader to populate `reviews` (it already renders them) + the aggregate (profiles.rating + count) — replace the Phase-B null.
- Tests: create — 401; not-chatted→403 NO_CONVERSATION; self→403; dup→409; happy→200 (mock rpc). list — returns mapped reviews.

## 3. UI (T3)
- On `/user/[id]` (seller profile): show the aggregate **rating** (stars + count) near the trust card; render `ProfileReviewsList` with the loaded reviews.
- **Leave-a-review affordance:** show a small review form (rating stars + comment) when the viewer is ELIGIBLE — i.e. signed in, not the seller, has chatted about one of the seller's adverts, hasn't already reviewed that advert. Compute eligibility server-side (does a conversation exist between viewer and this seller? pick the most recent such advert) OR show the form and let the API gate (simpler: show "Leave a review" to signed-in non-self viewers; on submit the rpc gates → show NO_CONVERSATION error inline "you can review a seller after contacting them"). Keep it simple: the API is the gate; the UI shows the form to signed-in non-self viewers + handles the gating errors. POST to `/api/reviews` with the advert_id (the listing they chatted about — for a profile-level review, pick the advert; simplest is a per-advert review from the AD page instead).
  - **Decision:** put the review entry point on the **ad page** (`/ad/[id]`) — "Leave a review for this seller" shown to signed-in non-owner viewers who have contacted the seller about THIS advert; that maps cleanly to `create_review(advert_id)`. The `/user/[id]` profile shows the aggregate + the list (read).
- i18n `reviews.*` ×5 (leave_review, rating, comment, submit, already_reviewed, must_contact, self, success). Parity guard passes.

## 4. Tasks
- **T1** migration (table+RLS+grants+create_review rpc+rating trigger) — dry-run-proven (incl. the chat-gate fixture) + applied + types.
- **T2** API (POST /api/reviews + reviews loading on /user/[id]) + tests.
- **T3** UI (ad-page review form + profile aggregate/list + i18n).
- **T4** whole-slice review + deploy + prod-verify (rpc gating proven on DB: chatted→ok, not-chatted→NO_CONVERSATION, self→blocked, dup→ALREADY_REVIEWED; authenticated can't direct-insert; rating trigger refreshes profiles.rating).

## 5. Out of scope / founder-adjustable
- **Gating model is adjustable:** to require a stronger signal (mark-as-sold), add a check in `create_review` only.
- Review replies (seller responds), review moderation/reporting, performance badges (Highly Rated) wiring, helpfulness votes.
