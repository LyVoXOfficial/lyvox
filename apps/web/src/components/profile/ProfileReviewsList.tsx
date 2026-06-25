"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { type ProfileReview } from "@/lib/profileTypes";
import { useI18n } from "@/i18n";

type ProfileReviewsListProps = {
  reviews: ProfileReview[];
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${
          i < rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"
        }`}
      />
    ))}
  </div>
);

export function ProfileReviewsList({ reviews }: ProfileReviewsListProps) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };

  if (!reviews || reviews.length === 0) {
    return (
      <div className="py-10 text-center text-muted-foreground">
        <p>{tr("profile.no_reviews", "No reviews for this user yet.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <Card key={review.id}>
          <CardHeader className="flex flex-row items-center gap-4">
             <Avatar>
              <AvatarImage src={`https://api.dicebear.com/8.x/initials/svg?seed=${review.author?.display_name}`} />
              <AvatarFallback>{review.author?.display_name?.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <p className="font-semibold text-foreground">{review.author?.display_name ?? tr("profile.anonymous", "Anonymous user")}</p>
                <StarRating rating={review.rating} />
            </div>
          </CardHeader>
          {review.comment && (
            <CardContent>
              <p className="text-sm text-muted-foreground">{review.comment}</p>
            </CardContent>
          )}
          <CardFooter className="text-xs text-muted-foreground">
            {new Date(review.created_at).toLocaleDateString()}
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}