"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/fetcher";

type Messages = {
  reviews: {
    leave_title: string;
    rating_label: string;
    comment_label: string;
    comment_placeholder: string;
    submit: string;
    success: string;
    must_contact: string;
    already: string;
    self: string;
    error: string;
    aggregate_count: string;
    no_reviews: string;
  };
};

type Props = {
  advertId: string;
  messages: Messages;
};

export function LeaveReviewForm({ advertId, messages }: Props) {
  const r = messages.reviews;

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
        toast.success(r.success);
        setSubmitted(true);
        return;
      }

      // Map error codes
      const code: string = body?.error ?? "";
      if (code === "NO_CONVERSATION") {
        setInlineError(r.must_contact);
      } else if (code === "ALREADY_REVIEWED") {
        setInlineError(r.already);
      } else if (code === "CANNOT_REVIEW_SELF") {
        setInlineError(r.self);
      } else {
        toast.error(r.error);
      }
    } catch {
      toast.error(r.error);
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
      <h3 className="text-base font-medium">{r.leave_title}</h3>

      {/* Star selector */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1">
          {r.rating_label}
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
          {r.comment_label}
        </label>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={r.comment_placeholder}
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
        {r.submit}
      </Button>
    </form>
  );
}
