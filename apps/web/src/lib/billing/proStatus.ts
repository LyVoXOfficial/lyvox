export function isPro(p: { pro_until?: string | null }, now?: Date): boolean {
  return !!p.pro_until && new Date(p.pro_until) > (now ?? new Date());
}
