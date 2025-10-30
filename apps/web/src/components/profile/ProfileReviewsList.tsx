"use client";

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Star } from "lucide-react";
import { type ProfileReview } from "@/lib/profileTypes";

type ProfileReviewsListProps = {
  reviews: ProfileReview[];
};

const StarRating = ({ rating }: { rating: number }) => (
  <div className="flex items-center">
    {[...Array(5)].map((_, i) => (
      <Star
        key={i}
        className={`h-5 w-5 ${
          i < rating ? "text-yellow-400 fill-yellow-400" : "text-gray-300"
        }`}
      />
    ))}
  </div>
);

export function ProfileReviewsList({ reviews }: ProfileReviewsListProps) {
  if (!reviews || reviews.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        <p>На этого пользователя пока нет отзывов.</p>
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
                <p className="font-semibold">{review.author?.display_name ?? 'Аноним'}</p>
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