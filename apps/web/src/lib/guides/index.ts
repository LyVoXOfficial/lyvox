export type GuideIcon =
  | "car"
  | "check"
  | "home"
  | "map-pin"
  | "message"
  | "phone"
  | "shield"
  | "smartphone";

export type Guide = {
  slug: string;
  categoryLink: string;
  icon: GuideIcon;
};

export const guides = [
  {
    slug: "herken-oplichting-tweedehands-kopen",
    categoryLink: "/search",
    icon: "shield",
  },
  {
    slug: "car-pass-controleren-tweedehands-auto",
    categoryLink: "/c/transport",
    icon: "car",
  },
  {
    slug: "imei-serienummer-elektronica-checken",
    categoryLink: "/c/elektronika-i-tehnika",
    icon: "smartphone",
  },
  {
    slug: "veilige-afspraak-tweedehands-deal",
    categoryLink: "/search",
    icon: "map-pin",
  },
  {
    slug: "epc-attest-huren-kopen",
    categoryLink: "/c/nedvizhimost",
    icon: "home",
  },
  {
    slug: "huurwaarborg-en-contract-controleren",
    categoryLink: "/c/nedvizhimost",
    icon: "check",
  },
  {
    slug: "fiets-kopen-framenummer-check",
    categoryLink: "/c/transport",
    icon: "check",
  },
  {
    slug: "jobaanbieding-scam-herkennen",
    categoryLink: "/c/rabota-i-karera",
    icon: "message",
  },
  {
    slug: "huisdier-adoptie-advertentie-check",
    categoryLink: "/c/zhivotnye",
    icon: "shield",
  },
  {
    slug: "chat-signalen-verdachte-verkoper",
    categoryLink: "/search",
    icon: "message",
  },
] as const satisfies readonly Guide[];

export type GuideSlug = (typeof guides)[number]["slug"];

export function findGuide(slug: string): Guide | undefined {
  return guides.find((guide) => guide.slug === slug);
}
