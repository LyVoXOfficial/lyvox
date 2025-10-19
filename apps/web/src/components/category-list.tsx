"use client";

import Link from "next/link";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Category } from "@/lib/types";

const iconNameMap: Record<string, keyof typeof Icons> = {
  car: "Car",
  "car-front": "CarFront",
  "car-new": "BadgeCheck",
  "car-used": "Gauge",
  motor: "Bike",
  truck: "Truck",
  crane: "Hammer",
  boat: "Ship",
  wrench: "Wrench",
  tires: "LifeBuoy",
  chemistry: "FlaskConical",
  audio: "Speaker",
  luggage: "Package",
  accessories: "ShoppingBag",
  home: "Home",
  sale: "Handshake",
  apartment: "Building2",
  room: "DoorOpen",
  house: "House",
  land: "Trees",
  commercial: "Factory",
  garage: "Home",
  rent: "KeyRound",
  key: "KeySquare",
  "rent-house": "Home",
  "rent-commercial": "Building",
  wardrobe: "Shirt",
  "wardrobe-women": "Heart",
  outerwear: "Shirt",
  dress: "Shirt",
  blouse: "Shirt",
  pants: "Shirt",
  sweater: "Shirt",
  tshirt: "Shirt",
  sport: "Dumbbell",
  homewear: "Bed",
  underwear: "Layers",
  swimwear: "Waves",
  shoes: "ShoppingBag",
  hats: "Crown",
  "wardrobe-men": "UserRound",
  suit: "Briefcase",
  wallet: "Wallet",
  "wardrobe-kids": "Baby",
  baby: "Baby",
  electronics: "Smartphone",
  phones: "Smartphone",
  mobiles: "Smartphone",
  tablets: "Tablet",
  wearables: "Watch",
  chargers: "Plug",
  computers: "Monitor",
  laptop: "Laptop",
  desktop: "Monitor",
  components: "Cpu",
  gaming: "Gamepad2",
  printer: "Printer",
  network: "Server",
  software: "Code",
  photo: "Camera",
  camera: "Camera",
  video: "Video",
  lens: "Camera",
  "action-cam": "CameraOff",
  tv: "Tv",
  media: "PlaySquare",
  appliances: "Lamp",
  kitchen: "UtensilsCrossed",
  "home-tech": "Plug",
  climate: "CloudSun",
  beauty: "Sparkles",
  "home-hobby": "Armchair",
  "home-garden": "Sprout",
  furniture: "Armchair",
  textile: "Layers",
  tableware: "UtensilsCrossed",
  lighting: "Lamp",
  decor: "Gem",
  garden: "Sprout",
  household: "Broom",
  kids: "Blocks",
  toys: "Blocks",
  strollers: "Baby",
  "car-seat": "Baby",
  feeding: "BabyBottle",
  "kids-furniture": "Blocks",
  moms: "Heart",
  hygiene: "Soap",
  hobby: "Palette",
  books: "BookOpen",
  music: "Guitar",
  collecting: "Gem",
  boardgames: "Dice6",
  outdoor: "Tent",
  tickets: "Ticket",
  handmade: "PenTool",
  jewelry: "Sparkles",
  gifts: "Gift",
  crafts: "Paintbrush",
  "handmade-toys": "Blocks",
  services: "BriefcaseBusiness",
  renovation: "Hammer",
  finishing: "Paintbrush",
  delivery: "Truck",
  repair: "Wrench",
  education: "GraduationCap",
  cleaning: "Broom",
  "pet-care": "PawPrint",
  events: "PartyPopper",
  requests: "ClipboardList",
  "need-master": "Users",
  "need-education": "GraduationCap",
  "need-delivery": "Truck",
  animals: "PawPrint",
  dogs: "Dog",
  cats: "Cat",
  rodents: "PawPrint",
  birds: "Bird",
  aquarium: "Fish",
  "pet-goods": "Bone",
  "pet-food": "Bone",
  carriers: "Package",
  "pet-toys": "Puzzle",
  jobs: "BriefcaseBusiness",
  vacancies: "BriefcaseBusiness",
  "full-time": "Clock",
  "part-time": "Hourglass",
  temporary: "Calendar",
  resumes: "Users",
  specialists: "UserRound",
  labor: "Hammer",
  students: "GraduationCap",
  special: "Sparkles",
  free: "HandHeart",
  exchange: "RefreshCw",
  search: "Search",
};

const DEFAULT_ROOT_ICON = Icons.Layers as LucideIcon;
const DEFAULT_ICON = Icons.Tag as LucideIcon;

function resolveIcon(cat: Category): LucideIcon {
  const key = cat.icon?.toLowerCase() ?? "";
  const iconName = iconNameMap[key] ?? (cat.level <= 1 ? "Layers" : undefined);
  const icon = iconName ? (Icons[iconName] as LucideIcon | undefined) : undefined;
  if (icon) return icon;
  return cat.level <= 1 ? DEFAULT_ROOT_ICON : DEFAULT_ICON;
}

export default function CategoryList({ items, base = "/c" }: { items: Category[]; base?: string }) {
  if (!items?.length) {
    return <p className="text-sm text-muted-foreground">Список пуст.</p>;
  }

  return (
    <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {items.map((cat) => {
        const Icon = resolveIcon(cat);
        const href = `${base}/${cat.path}`;
        return (
          <li key={cat.id}>
            <Link
              href={href}
              className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md"
            >
              <span className="mt-1 rounded-lg bg-zinc-100 p-2 text-zinc-600">
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="space-y-1">
                <span className="block text-sm font-medium text-zinc-900">{cat.name_ru}</span>
                {cat.level <= 2 ? (
                  <span className="block text-xs text-zinc-500">Показать объявления</span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
