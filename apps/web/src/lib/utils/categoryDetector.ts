/**
 * Category detection utilities for determining which catalog component to render
 */

export type CategoryType = 
  | 'vehicle'
  | 'real_estate'
  | 'electronics'
  | 'fashion'
  | 'jobs'
  | 'home'
  | 'baby_kids'
  | 'pets'
  | 'sports'
  | 'services'
  | 'generic';

/**
 * Detects category type based on category slug or parent hierarchy
 */
export function detectCategoryType(categorySlug: string): CategoryType {
  if (!categorySlug) {
    return "generic";
  }

  const slug = categorySlug.toLowerCase();
  const [rootSegment = "", secondSegment = ""] = slug.split("/");

  const includesAny = (value: string, needles: string[]) =>
    needles.some((needle) => value.includes(needle));

  switch (rootSegment) {
    case "transport":
      return "vehicle";
    case "nedvizhimost":
      return "real_estate";
    case "lichnye-veshchi":
      if (includesAny(secondSegment, ["detsk", "baby", "kid"])) {
        return "baby_kids";
      }
      return "fashion";
    case "elektronika-i-tehnika":
      return "electronics";
    case "dlya-doma-hobbi-i-detey":
      if (includesAny(secondSegment, ["detsk", "baby", "kid"])) {
        return "baby_kids";
      }
      if (includesAny(secondSegment, ["hobbi", "hobby", "sport"])) {
        return "sports";
      }
      return "home";
    case "uslugi-i-biznes":
      return "services";
    case "zhivotnye":
      return "pets";
    case "rabota-i-karera":
      return "jobs";
    case "osobye-kategorii":
      return "generic";
    default:
      break;
  }

  // Fallback heuristics for legacy slugs and special cases
  if (
    includesAny(slug, [
      "transport",
      "avtomobil",
      "mototekhn",
      "motorcycle",
      "truck",
      "car",
      "vehicle",
    ])
  ) {
    return "vehicle";
  }

  if (
    includesAny(slug, [
      "nedvizhimost",
      "real-estate",
      "kvartir",
      "apartment",
      "house",
      "prodazha",
      "arenda",
    ])
  ) {
    return "real_estate";
  }

  if (
    includesAny(slug, [
      "elektronika",
      "electronics",
      "phone",
      "computer",
      "laptop",
      "tv",
      "audio",
      "photo",
      "appliance",
    ])
  ) {
    return "electronics";
  }

  if (
    includesAny(slug, [
      "fashion",
      "odezhda",
      "clothing",
      "garderob",
      "obuv",
      "shoes",
      "aksessuar",
      "lichnye-veshchi",
    ])
  ) {
    return "fashion";
  }

  if (includesAny(slug, ["rabota", "jobs", "career", "vacancy"])) {
    return "jobs";
  }

  if (
    includesAny(slug, [
      "dom-i-sad",
      "home-living",
      "furniture",
      "mebel",
      "garden",
      "sad",
    ])
  ) {
    return "home";
  }

  if (includesAny(slug, ["deti", "baby", "kids", "children", "detskie"])) {
    return "baby_kids";
  }

  if (includesAny(slug, ["zhivotnye", "pets", "animals"])) {
    return "pets";
  }

  if (includesAny(slug, ["hobbi", "sport", "hobby", "fitness"])) {
    return "sports";
  }

  if (includesAny(slug, ["uslugi", "services", "service"])) {
    return "services";
  }

  return "generic";
}

/**
 * Determines if category requires specialized component or generic form
 */
export function requiresSpecializedComponent(categoryType: CategoryType): boolean {
  return ['vehicle', 'real_estate', 'electronics', 'fashion', 'jobs'].includes(categoryType);
}

/**
 * Get human-readable category type name
 */
export function getCategoryTypeName(categoryType: CategoryType): string {
  const names: Record<CategoryType, string> = {
    vehicle: 'Vehicle',
    real_estate: 'Real Estate',
    electronics: 'Electronics',
    fashion: 'Fashion & Clothing',
    jobs: 'Job Listing',
    home: 'Home & Living',
    baby_kids: 'Baby & Kids',
    pets: 'Pets & Animals',
    sports: 'Sports & Hobbies',
    services: 'Services',
    generic: 'General Item',
  };
  return names[categoryType];
}




