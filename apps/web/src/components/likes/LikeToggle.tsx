"use client";

import { useState } from "react";
import { ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { useLikes } from "@/components/likes/LikesProvider";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

type Props = { advertId: string; initialCount?: number; className?: string; variant?: "overlay" | "inline" };

export default function LikeToggle({ advertId, initialCount = 0, className, variant = "inline" }: Props) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => { const v = t(k); return v === k ? fb : v; };
  const { isLiked, addLike, removeLike, isLoading } = useLikes();
  const [pending, setPending] = useState(false);
  const [count, setCount] = useState(initialCount);
  const liked = isLiked(advertId);

  const onClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); e.stopPropagation();
    if (pending || isLoading) return;
    setPending(true);
    const wasLiked = liked;
    setCount((c) => Math.max(0, c + (wasLiked ? -1 : 1))); // optimistic
    try {
      const result = wasLiked ? await removeLike(advertId) : await addLike(advertId);
      if (!result.ok) {
        setCount((c) => Math.max(0, c + (wasLiked ? 1 : -1))); // revert
        if (result.error === "unauthorized") toast.info(tr("likes.login_required", "Sign in to like listings"));
        else toast.error(tr("likes.failed", "Could not update like"));
      }
    } finally { setPending(false); }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={liked}
      aria-label={liked ? tr("likes.remove", "Remove like") : tr("likes.add", "Like")}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full text-sm font-semibold transition",
        variant === "overlay"
          ? "size-10 justify-center bg-card/90 shadow-[var(--shadow-soft)] backdrop-blur"
          : "px-2.5 py-1 border border-border/70 bg-secondary/60",
        liked ? "text-primary" : "text-muted-foreground hover:text-primary",
        className,
      )}
    >
      <ThumbsUp className={cn("h-4 w-4", liked && "fill-current")} aria-hidden="true" />
      {count > 0 ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}
