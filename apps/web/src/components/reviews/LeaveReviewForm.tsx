"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/fetcher";
import { useI18n } from "@/i18n";

type Props = {
  advertId: string;
};

export function LeaveReviewForm({ advertId }: Props) {
  const { t } = useI18n();
  const tr = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const [rating, setRating] = useState<number>(0);
  const [hovered, setHovered] = useState<number>(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating || submitting) return;

    setSubmitting(true);
    setInlineError(null);

    try {
      const res = await apiFetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          advert_id: advertId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const body = await res.json();

      if (res.ok && body.ok) {
        toast.success(tr("reviews.success", "Your review has been submitted!"));
        setSubmitted(true);
        return;
      }

      // Map error codes to inline messages or generic toast
      const code: string = body?.error ?? "";
      if (code === "NO_CONVERSATION") {
        setInlineError(tr("reviews.must_contact", "You can review this seller after contacting them about this listing."));
      } else if (code === "ALREADY_REVIEWED") {
        setInlineError(tr("reviews.already", "You've already reviewed this seller."));
      } else if (code === "CANNOT_REVIEW_SELF") {
        setInlineError(tr("reviews.self", "You cannot review your own listing."));
      } else {
        toast.error(tr("reviews.error", "Something went wrong. Please try again."));
      }
    } catch {
      toast.error(tr("reviews.error", "Something went wrong. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  const displayRating = hovered || rating;

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-md border border-border/80 bg-card p-4 shadow-sm space-y-4"
    >
      <h3 className="text-base font-medium">
        {tr("reviews.leave_title", "Leave a Review")}
      </h3>

      {/* Star selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {tr("reviews.rating_label", "Rating")}
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star`}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHovered(n)}
              onMouseLeave={() => setHovered(0)}
              className="p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
            >
              <Star
                className={`h-7 w-7 transition-colors ${
                  n <= displayRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      {/* Comment */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {tr("reviews.comment_label", "Comment (optional)")}
        </label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={tr("reviews.comment_placeholder", "Share your experience with this seller...")}
          maxLength={1000}
          rows={3}
        />
      </div>

      {/* Inline error message */}
      {inlineError && (
        <p className="text-sm text-destructive">{inlineError}</p>
      )}

      <Button
        type="submit"
        disabled={!rating || submitting}
        className="w-full"
      >
        {tr("reviews.submit", "Submit review")}
      </Button>
    </form>
  );
}
