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
  const slug = categorySlug.toLowerCase();

  // Vehicle categories (Транспорт)
  if (
    slug.includes('transport') ||
    slug.includes('avtomobil') ||
    slug.includes('mototekhn') ||
    slug.includes('motorcycle') ||
    slug.includes('truck') ||
    slug.includes('car') ||
    slug.includes('vehicle')
  ) {
    return 'vehicle';
  }

  // Real Estate categories (Недвижимость)
  if (
    slug.includes('nedvizhimost') ||
    slug.includes('real-estate') ||
    slug.includes('kvartir') ||
    slug.includes('apartment') ||
    slug.includes('house') ||
    slug.includes('prodazha') ||
    slug.includes('arenda')
  ) {
    return 'real_estate';
  }

  // Electronics categories (Электроника)
  if (
    slug.includes('elektronika') ||
    slug.includes('electronics') ||
    slug.includes('phone') ||
    slug.includes('computer') ||
    slug.includes('laptop') ||
    slug.includes('tv') ||
    slug.includes('audio') ||
    slug.includes('photo') ||
    slug.includes('appliance')
  ) {
    return 'electronics';
  }

  // Fashion categories (Личные вещи / Одежда)
  if (
    slug.includes('lichnye-veshchi') ||
    slug.includes('fashion') ||
    slug.includes('odezhda') ||
    slug.includes('clothing') ||
    slug.includes('garderob') ||
    slug.includes('obuv') ||
    slug.includes('shoes') ||
    slug.includes('aksessuar')
  ) {
    return 'fashion';
  }

  // Jobs categories (Работа)
  if (
    slug.includes('rabota') ||
    slug.includes('jobs') ||
    slug.includes('career') ||
    slug.includes('vacancy')
  ) {
    return 'jobs';
  }

  // Home & Living categories (Дом и сад)
  if (
    slug.includes('dom-i-sad') ||
    slug.includes('home-living') ||
    slug.includes('furniture') ||
    slug.includes('mebel') ||
    slug.includes('garden') ||
    slug.includes('sad')
  ) {
    return 'home';
  }

  // Baby & Kids categories (Товары для детей)
  if (
    slug.includes('deti') ||
    slug.includes('baby') ||
    slug.includes('kids') ||
    slug.includes('children') ||
    slug.includes('detskie')
  ) {
    return 'baby_kids';
  }

  // Pets categories (Животные)
  if (
    slug.includes('zhivotnye') ||
    slug.includes('pets') ||
    slug.includes('animals')
  ) {
    return 'pets';
  }

  // Sports & Hobbies categories (Хобби и спорт)
  if (
    slug.includes('hobbi') ||
    slug.includes('sport') ||
    slug.includes('hobby') ||
    slug.includes('fitness')
  ) {
    return 'sports';
  }

  // Services categories (Услуги)
  if (
    slug.includes('uslugi') ||
    slug.includes('services') ||
    slug.includes('service')
  ) {
    return 'services';
  }

  // Default: generic JSONB-based category
  return 'generic';
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




