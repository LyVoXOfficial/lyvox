export type ViewerTrust = { signedIn: boolean; verifiedPhone: boolean; userId: string | null };

export async function fetchViewerTrust(): Promise<ViewerTrust> {
  try {
    const res = await fetch("/api/me", { cache: "no-store", credentials: "include" });
    if (!res.ok) return { signedIn: false, verifiedPhone: false, userId: null };
    const data = await res.json().catch(() => null);
    const userId = data?.user?.id ?? null;
    if (!userId) return { signedIn: false, verifiedPhone: false, userId: null };
    return { signedIn: true, verifiedPhone: data?.verifiedPhone === true, userId };
  } catch {
    return { signedIn: false, verifiedPhone: false, userId: null };
  }
}
