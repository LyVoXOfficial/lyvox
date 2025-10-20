import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";

const ROOT_FALLBACK = Icons.Layers as LucideIcon;
const FALLBACK = Icons.Tag as LucideIcon;

export function getCategoryIcon(iconName: string | null | undefined, level: number): LucideIcon {
  if (iconName && iconName in Icons) {
    return Icons[iconName as keyof typeof Icons] as LucideIcon;
  }
  return level <= 1 ? ROOT_FALLBACK : FALLBACK;
}
