import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Thrown when the user owns an active business and cannot delete their account
 * until they transfer or close it. Maps to HTTP 409 at the route layer.
 */
export class ActiveBusinessError extends Error {
  constructor(message = "Transfer or close your active business before deleting your account.") {
    super(message);
    this.name = "ActiveBusinessError";
  }
}

/**
 * Orchestrates GDPR Art.17 account erasure in the required order:
 *   1. DB erasure (atomic, via SECURITY DEFINER function)
 *   2. Storage cleanup (ad-media bucket, enumerated paths only)
 *   3. Identity deletion (auth.users hard-delete, CASCADE purges remainder)
 *
 * Invariants:
 *   - Steps are strictly ordered; a failure at step 1 aborts everything.
 *   - A storage error at step 2 is logged but does NOT abort step 3:
 *     the DB erasure already succeeded and leaving a few orphaned storage
 *     objects is far better than leaving a half-deleted account that can
 *     still log in. The auth identity must be removed.
 *   - Storage cleanup is scoped ONLY to paths enumerated from the user's
 *     own media rows in the "ad-media" bucket. We never wipe by user-prefix
 *     and never touch any other bucket (e.g. "lyvox-public").
 */
export async function eraseAccount(
  service: SupabaseClient,
  userId: string,
): Promise<void> {
  // ── Step 1: DB erasure ────────────────────────────────────────────────────
  // erase_user_data() is SECURITY DEFINER and does all DB mutations atomically:
  // tombstone messages, anonymize purchases, delete advert_views, orphan-cleanup
  // verifications/badges/kyc, anonymize logs, write audit row.
  const { error: rpcError } = await service.rpc("erase_user_data", {
    p_user_id: userId,
  });

  if (rpcError) {
    // P0001 is the SQLSTATE raised by erase_user_data when the user owns an
    // active business. The route should return 409 with guidance.
    if (
      rpcError.message?.includes("ACTIVE_BUSINESS") ||
      rpcError.code === "P0001"
    ) {
      throw new ActiveBusinessError();
    }
    // Any other DB error: abort entirely — never partially erase.
    throw new Error(`Account erasure DB step failed: ${rpcError.message}`);
  }

  // ── Step 2: Storage cleanup (ad-media, enumerated paths only) ────────────
  // Must run AFTER the DB erasure (which tombstoned rows) but BEFORE deleteUser
  // so the media table rows are still present for enumeration (CASCADE via
  // auth.users → adverts → media will fire in step 3).
  try {
    const { data: advertRows, error: advertError } = await service
      .from("adverts")
      .select("id")
      .eq("user_id", userId);

    // Supabase query errors are returned on `.error` (not thrown), so the outer
    // catch would miss them — log explicitly. Non-fatal: fall through to step 3.
    if (advertError) {
      console.error("[eraseAccount] adverts enumeration failed (non-fatal):", advertError);
    }

    const advertIds = (advertRows ?? []).map((r) => r.id as string);

    if (advertIds.length > 0) {
      const { data: mediaRows, error: mediaError } = await service
        .from("media")
        .select("url")
        .in("advert_id", advertIds);

      if (mediaError) {
        console.error("[eraseAccount] media enumeration failed (non-fatal):", mediaError);
      }

      // Only storage paths — skip full http(s) URLs (those are CDN-signed
      // references, not bucket-relative paths). Mirror the convention used in
      // apps/web/src/app/api/adverts/[id]/route.ts DELETE.
      const storagePaths = (mediaRows ?? [])
        .map((r) => r.url as string | null)
        .filter((path): path is string => Boolean(path && !path.startsWith("http")));

      if (storagePaths.length > 0) {
        await service.storage.from("ad-media").remove(storagePaths);
      }
    }
  } catch (storageErr) {
    // Storage errors are non-fatal here: the DB erasure already succeeded;
    // orphaned objects in ad-media are a minor data-hygiene issue whereas a
    // half-deleted account (auth still valid) is a GDPR/security blocker.
    // The auth identity MUST be removed regardless. Log and continue.
    console.error("[eraseAccount] Storage cleanup failed (non-fatal):", storageErr);
  }

  // ── Step 3: Identity deletion (LAST) ─────────────────────────────────────
  // Hard-delete the auth.users row. This triggers CASCADE deletes for
  // profiles, phones, adverts, media rows, favorites, notifications, etc.
  const { error: deleteError } = await service.auth.admin.deleteUser(userId);

  if (deleteError) {
    throw new Error(`Account erasure identity step failed: ${deleteError.message}`);
  }
}
