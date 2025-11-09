"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { type ProfileAdvert } from "@/lib/profileTypes";

type ProfileAdvertsListProps = {
  adverts: ProfileAdvert[];
};

function pickImage(media: ProfileAdvert["media"]): string {
  if (!media?.length) return "/placeholder.svg";
  const sorted = [...media].sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
  return sorted[0]?.url ?? "/placeholder.svg";
}

export function ProfileAdvertsList({ adverts }: ProfileAdvertsListProps) {
  if (!adverts || adverts.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-10">
        <p>У пользователя нет активных объявлений.</p>
      </div>
    );
  }

  return (
    <Carousel
      opts={{
        align: "start",
      }}
      className="w-full"
    >
      <CarouselContent>
        {adverts.map((ad) => (
          <CarouselItem key={ad.id} className="md:basis-1/2 lg:basis-1/3">
            <div className="p-1">
              <Card>
                <CardContent className="flex aspect-square items-center justify-center p-0 relative">
                     <Link href={`/ad/${ad.id}`}>
                       <Image
                         src={pickImage(ad.media)}
                         alt={ad.title}
                         fill
                         className="object-cover rounded-t-lg"
                         unoptimized
                         onError={(e) => {
                           const target = e.target as HTMLImageElement;
                           target.src = "/placeholder.svg";
                         }}
                       />
                    <div className="absolute top-2 right-2">
                       {ad.status && <Badge>{ad.status}</Badge>}
                    </div>
                  </Link>
                </CardContent>
                <div className="p-4 space-y-1">
                    <h3 className="font-semibold truncate">
                        <Link href={`/ad/${ad.id}`}>{ad.title}</Link>
                    </h3>
                    <p className="text-lg font-bold">
                        {ad.price ? `${ad.price.toLocaleString()} €` : 'Цена не указана'}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{ad.location}</p>
                </div>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious />
      <CarouselNext />
    </Carousel>
  );
}