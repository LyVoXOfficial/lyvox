export type ViewerTrust = { signedIn: boolean; verifiedPhone: boolean; userId: string | null };

export async function fetchViewerTrust(): Promise<ViewerTrust> {
  try {
    const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
    if (!res.ok) return { signedIn: false, verifiedPhone: false, userId: null };
    const json = await res.json().catch(() => null);
    const payload = json?.data ?? json;          // unwrap createSuccessResponse {ok,data}
    const userId = payload?.user?.id ?? null;
    if (!userId) return { signedIn: false, verifiedPhone: false, userId: null };
    return { signedIn: true, verifiedPhone: payload?.verifiedPhone === true, userId };
  } catch {
    return { signedIn: false, verifiedPhone: false, userId: null };
  }
}
