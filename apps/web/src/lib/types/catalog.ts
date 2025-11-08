/**
 * Catalog Types - Category-Specific Data Structures
 * 
 * This file defines TypeScript types for category-specific advert data.
 * Each category has its own interface that extends the base ad_item_specifics.
 * 
 * Database Strategy:
 * - Complex categories (Real Estate, Jobs, Vehicles) have dedicated tables
 * - Simpler categories (Electronics, Fashion, etc.) use JSONB in ad_item_specifics
 * 
 * See: docs/catalog/DATABASE_STRATEGY.md
 */

// =============================================================================
// BASE TYPES
// =============================================================================

export type ConditionType = 
  | 'new'
  | 'like_new'
  | 'good'
  | 'fair'
  | 'for_parts';

export type DeliveryOption = 
  | 'pickup_only'
  | 'delivery_available'
  | 'shipping_national'
  | 'shipping_international';

// =============================================================================
// REAL ESTATE TYPES (Specialized Table: property_listings)
// =============================================================================

export type PropertyListingType = 'sale' | 'rent';

export type PropertyType =
  | 'apartment'
  | 'house'
  | 'villa'
  | 'townhouse'
  | 'studio'
  | 'loft'
  | 'duplex'
  | 'penthouse'
  | 'land'
  | 'commercial'
  | 'office'
  | 'garage'
  | 'parking_space'
  | 'storage';

export type EPCRating = 'A++' | 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';

export type HeatingType = 
  | 'gas'
  | 'electric'
  | 'oil'
  | 'heat_pump'
  | 'solar'
  | 'wood'
  | 'district'
  | 'none';

export type FurnishedType = 'unfurnished' | 'semi_furnished' | 'fully_furnished';

export interface PropertyListing {
  // Classification
  property_type: PropertyType;
  listing_type: PropertyListingType;
  
  // Dimensions (REQUIRED)
  area_sqm: number;
  land_area_sqm?: number;
  rooms?: number;
  bedrooms?: number;
  bathrooms?: number;
  
  // Building Info
  year_built?: number;
  renovation_year?: number;
  floor?: number;
  total_floors?: number;
  
  // Energy & Compliance (Belgium-specific)
  epc_rating?: EPCRating;
  epc_cert_number?: string; // Format: YYYYMMDD-NNNNNNN-NN
  epc_kwh_per_sqm_year?: number;
  peb_url?: string;
  
  // Heating & Utilities
  heating_type?: HeatingType[];
  water_heater_type?: 'instant' | 'tank' | 'solar';
  double_glazing?: boolean;
  
  // Rental-Specific (NULL if for sale)
  rent_monthly?: number;
  rent_charges_monthly?: number;
  syndic_cost_monthly?: number;
  deposit_months?: number; // Max 3 per Belgium law
  lease_duration_months?: number;
  available_from?: string; // ISO date
  furnished?: FurnishedType;
  
  // Location Details
  postcode: string; // 4-digit Belgian postcode
  municipality: string;
  neighborhood?: string;
  
  // Parking
  parking_spaces?: number;
  parking_type?: Array<'garage' | 'carport' | 'street' | 'underground'>;
  
  // Outdoor Space
  terrace_sqm?: number;
  garden_sqm?: number;
  garden_orientation?: 'north' | 'south' | 'east' | 'west';
  
  // Building Features
  elevator?: boolean;
  cellar?: boolean;
  attic?: boolean;
  
  // Policies (for rentals)
  pet_friendly?: boolean;
  smoking_allowed?: boolean;
}

// =============================================================================
// JOBS TYPES (Specialized Table: job_listings)
// =============================================================================

export type EmploymentType = 'full_time' | 'part_time' | 'freelance' | 'internship';

export type RemoteOption = 'none' | 'hybrid' | 'full_remote';

export type EducationLevel = 'none' | 'high_school' | 'bachelor' | 'master' | 'phd';

export type CompanySize = 'startup' | 'small' | 'medium' | 'large' | 'enterprise';

export type SalaryPeriod = 'hour' | 'month' | 'year';

export type SalaryType = 'gross' | 'net';

export interface JobListing {
  // Classification
  job_category: string; // Reference to job_categories.slug
  cp_code?: string; // Belgium CP code
  contract_type: string; // Reference to job_contract_types.slug
  employment_type: EmploymentType;
  
  // Schedule
  hours_per_week?: number;
  shift_work?: boolean;
  weekend_work?: boolean;
  night_shifts?: boolean;
  flexible_hours?: boolean;
  remote_option: RemoteOption;
  
  // Compensation
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string; // Default: EUR
  salary_period?: SalaryPeriod;
  salary_type?: SalaryType;
  salary_negotiable?: boolean;
  benefits?: string[]; // ['meal_vouchers', 'company_car', 'insurance', etc.]
  
  // Requirements
  experience_years_min?: number;
  education_level?: EducationLevel;
  languages_required?: string[]; // ISO codes: ['nl', 'fr', 'en']
  languages_preferred?: string[];
  driving_license_required?: boolean;
  license_types?: string[]; // ['B', 'C', 'CE']
  
  // Legal (Belgium-specific)
  work_permit_required?: boolean;
  work_permit_sponsored?: boolean;
  
  // Company Info
  company_name?: string;
  company_size?: CompanySize;
  industry?: string;
  
  // Application
  application_deadline?: string; // ISO date
  start_date?: string; // ISO date
  contact_email?: string;
  contact_phone?: string;
  application_url?: string;
}

// =============================================================================
// ELECTRONICS TYPES (JSONB: ad_item_specifics.specifics)
// =============================================================================

export type DeviceType =
  | 'phone'
  | 'tablet'
  | 'laptop'
  | 'desktop'
  | 'camera'
  | 'tv'
  | 'audio'
  | 'console'
  | 'watch'
  | 'monitor'
  | 'printer'
  | 'other';

export type BatteryCondition = 'excellent' | 'good' | 'average' | 'poor' | 'needs_replacement';

export interface ElectronicsSpecifics {
  // Device Info
  device_type: DeviceType;
  brand: string;
  model: string;
  release_year?: number;
  
  // Technical Specs (device-specific)
  memory_gb?: number; // RAM
  storage_gb?: number;
  processor?: string;
  graphics_card?: string;
  screen_size_inch?: number;
  resolution?: string;
  
  // Condition
  condition: ConditionType;
  battery_condition?: BatteryCondition; // For phones/laptops
  hours_of_use?: number; // For TVs, monitors
  
  // Status
  factory_locked?: boolean; // For phones
  icloud_locked?: boolean; // For Apple devices
  activation_lock?: boolean;
  sim_lock_carrier?: string; // 'unlocked' or carrier name
  
  // Completeness
  original_box?: boolean;
  original_charger?: boolean;
  accessories_included?: string[]; // ['case', 'earbuds', 'stylus']
  
  // Documentation & Warranty
  purchase_receipt?: boolean;
  warranty_until?: string; // ISO date
  manufacturer_warranty?: boolean;
  
  // Hidden fields (not shown publicly)
  imei?: string; // Only for owner/serious buyers
  serial_number?: string;
  
  // Delivery
  delivery_options?: DeliveryOption[];
}

// =============================================================================
// FASHION TYPES (JSONB: ad_item_specifics.specifics)
// =============================================================================

export type Gender = 'women' | 'men' | 'unisex';

export type AgeCategory = 'baby' | 'toddler' | 'kids' | 'teens' | 'adults';

export type ClothingType =
  | 'dress'
  | 'shirt'
  | 'blouse'
  | 't_shirt'
  | 'sweater'
  | 'jacket'
  | 'coat'
  | 'pants'
  | 'jeans'
  | 'skirt'
  | 'shorts'
  | 'suit'
  | 'shoes'
  | 'boots'
  | 'sneakers'
  | 'bag'
  | 'accessory'
  | 'underwear'
  | 'swimwear'
  | 'sportswear';

export type Season = 'spring_summer' | 'autumn_winter' | 'all_season';

export interface FashionSpecifics {
  // Classification
  gender?: Gender;
  age_category?: AgeCategory;
  clothing_type: ClothingType;
  
  // Sizing (Belgium/EU standards)
  size_eu?: string; // EU standard size
  size_be?: string; // Belgium-specific size
  size_uk?: string;
  size_us?: string;
  size_label?: string; // What's on the label (XS, S, M, L, XL, etc.)
  
  // Measurements (cm)
  height_cm?: number; // For model/mannequin
  chest_bust_cm?: number;
  waist_cm?: number;
  hips_cm?: number;
  inseam_cm?: number;
  
  // Details
  brand?: string;
  color: string;
  material?: string;
  pattern?: string; // 'solid', 'striped', 'floral', 'plaid', etc.
  season?: Season;
  
  // Condition
  condition: ConditionType;
  defects?: string; // Description of any defects/stains
  
  // Care
  washing_instructions?: string;
  
  // Provenance
  original_tags?: boolean;
  designer?: boolean;
  vintage?: boolean;
  vintage_decade?: string; // '1950s', '1960s', etc.
  
  // Delivery
  delivery_options?: DeliveryOption[];
}

// =============================================================================
// VEHICLE TYPES (Specialized Table: vehicle_insights)
// =============================================================================
// Already defined in existing codebase, not duplicated here

// =============================================================================
// HOME & LIVING TYPES (JSONB: ad_item_specifics.specifics)
// =============================================================================

export type FurnitureType =
  | 'sofa'
  | 'chair'
  | 'table'
  | 'bed'
  | 'wardrobe'
  | 'shelf'
  | 'desk'
  | 'cabinet'
  | 'decoration'
  | 'lighting'
  | 'kitchen'
  | 'appliance';

export interface HomeSpecifics {
  furniture_type: FurnitureType;
  brand?: string;
  material?: string;
  color?: string;
  
  // Dimensions (cm)
  width_cm?: number;
  height_cm?: number;
  depth_cm?: number;
  
  condition: ConditionType;
  assembly_required?: boolean;
  
  delivery_options?: DeliveryOption[];
}

// =============================================================================
// BABY & KIDS TYPES (JSONB: ad_item_specifics.specifics)
// =============================================================================

export type BabyItemType =
  | 'stroller'
  | 'car_seat'
  | 'crib'
  | 'high_chair'
  | 'baby_carrier'
  | 'playpen'
  | 'toy'
  | 'clothing'
  | 'books'
  | 'gear';

export interface BabyKidsSpecifics {
  item_type: BabyItemType;
  age_range?: string; // '0-6 months', '6-12 months', '1-3 years', etc.
  brand?: string;
  
  // Safety (CRITICAL)
  safety_standards?: string[]; // ['EN71', 'CE', etc.]
  safety_cert_url?: string;
  recall_status?: 'safe' | 'recalled' | 'unknown';
  
  condition: ConditionType;
  
  // Hygiene
  cleanable?: boolean;
  washable?: boolean;
  sterilized?: boolean;
  
  delivery_options?: DeliveryOption[];
}

// =============================================================================
// PETS TYPES (JSONB: ad_item_specifics.specifics)
// =============================================================================

export type PetCategory = 'dog' | 'cat' | 'bird' | 'fish' | 'rodent' | 'reptile' | 'other';

export type PetListingType = 'sale' | 'adoption' | 'lost' | 'found';

export interface PetSpecifics {
  // Classification
  category: PetCategory;
  listing_type: PetListingType;
  species?: string; // 'labrador', 'persian_cat', etc.
  breed?: string;
  
  // Details
  age_years?: number;
  age_months?: number;
  gender?: 'male' | 'female' | 'unknown';
  
  // Legal (Belgium requirements)
  microchipped?: boolean;
  microchip_number?: string; // HIDDEN publicly
  vaccinated?: boolean;
  vaccination_card?: boolean;
  pet_passport?: boolean;
  registered?: boolean; // With Belgian authorities
  
  // Health
  neutered_spayed?: boolean;
  health_issues?: string;
  temperament?: string;
  
  // For adoption
  adoption_fee?: number;
  good_with_kids?: boolean;
  good_with_dogs?: boolean;
  good_with_cats?: boolean;
  
  // For lost/found
  last_seen_date?: string; // ISO date
  last_seen_location?: string;
  distinctive_marks?: string;
}

// =============================================================================
// SPORTS & HOBBIES TYPES (JSONB: ad_item_specifics.specifics)
// =============================================================================

export type SportType =
  | 'cycling'
  | 'fitness'
  | 'running'
  | 'swimming'
  | 'team_sports'
  | 'winter_sports'
  | 'water_sports'
  | 'outdoor'
  | 'combat_sports'
  | 'racket_sports'
  | 'other';

export interface SportsSpecifics {
  sport_type: SportType;
  item_type: string; // 'bicycle', 'skis', 'golf_clubs', etc.
  brand?: string;
  size?: string;
  
  condition: ConditionType;
  
  // Bike-specific
  frame_size_cm?: number;
  wheel_size_inch?: number;
  gears?: number;
  
  delivery_options?: DeliveryOption[];
}

// =============================================================================
// SERVICES TYPES (JSONB: ad_item_specifics.specifics)
// =============================================================================

export type ServiceCategory =
  | 'home_services'
  | 'beauty_wellness'
  | 'education_tutoring'
  | 'it_tech'
  | 'events'
  | 'transport_moving'
  | 'professional'
  | 'other';

export interface ServiceSpecifics {
  service_category: ServiceCategory;
  service_type: string;
  
  // Pricing
  price_per_hour?: number;
  price_per_session?: number;
  price_negotiable?: boolean;
  
  // Provider
  provider_certified?: boolean;
  certifications?: string[];
  experience_years?: number;
  
  // Legal (Belgium)
  vat_registered?: boolean;
  vat_number?: string;
  insurance?: boolean;
  
  // Availability
  available_days?: string[]; // ['monday', 'tuesday', etc.]
  available_hours?: string; // '9:00-17:00'
  
  location_service?: 'client_location' | 'provider_location' | 'remote' | 'flexible';
}

// =============================================================================
// UNION TYPE FOR ALL SPECIFICS
// =============================================================================

export type CatalogSpecifics =
  | PropertyListing
  | JobListing
  | ElectronicsSpecifics
  | FashionSpecifics
  | HomeSpecifics
  | BabyKidsSpecifics
  | PetSpecifics
  | SportsSpecifics
  | ServiceSpecifics;

// =============================================================================
// CATEGORY-TO-TYPE MAPPING
// =============================================================================

export const CATEGORY_TYPE_MAP = {
  // Real Estate
  'real-estate': 'property',
  'real-estate-sale': 'property',
  'real-estate-rent': 'property',
  'real-estate-apartments': 'property',
  'real-estate-houses': 'property',
  'real-estate-land': 'property',
  'real-estate-commercial': 'property',
  'real-estate-garages': 'property',
  
  // Jobs
  'jobs': 'job',
  'jobs-vacancies': 'job',
  'jobs-vacancies-full-time': 'job',
  'jobs-vacancies-part-time': 'job',
  'jobs-vacancies-temporary': 'job',
  'jobs-resumes': 'job',
  
  // Electronics (JSONB)
  'electronics': 'electronics',
  'electronics-phones-tablets': 'electronics',
  'electronics-computers': 'electronics',
  'electronics-photo-video': 'electronics',
  'electronics-tv-audio': 'electronics',
  'electronics-home-appliances': 'electronics',
  
  // Fashion (JSONB)
  'fashion': 'fashion',
  'fashion-women': 'fashion',
  'fashion-men': 'fashion',
  'fashion-kids': 'fashion',
  
  // Home (JSONB)
  'home': 'home',
  'home-furniture': 'home',
  'home-decoration': 'home',
  'home-appliances': 'home',
  
  // Baby & Kids (JSONB)
  'baby-kids': 'baby_kids',
  'baby-kids-clothing': 'baby_kids',
  'baby-kids-toys': 'baby_kids',
  'baby-kids-gear': 'baby_kids',
  
  // Pets (JSONB)
  'pets': 'pets',
  'pets-dogs': 'pets',
  'pets-cats': 'pets',
  'pets-accessories': 'pets',
  
  // Sports (JSONB)
  'sports': 'sports',
  'sports-cycling': 'sports',
  'sports-fitness': 'sports',
  'sports-team-sports': 'sports',
  
  // Services (JSONB)
  'services': 'services',
  'services-home': 'services',
  'services-beauty': 'services',
  'services-tutoring': 'services',

  // Vehicles (Specialized table)
  'transport': 'vehicle',
  'transport-cars': 'vehicle',
  'transport-cars-new': 'vehicle',
  'transport-cars-used': 'vehicle',
  'transport-motorcycles': 'vehicle',
  'transport-trucks': 'vehicle',
  'transport-special-equipment': 'vehicle',
  'transport-water': 'vehicle',
  'transport-parts': 'vehicle',
} as const;

export type CategoryTypeKey = keyof typeof CATEGORY_TYPE_MAP;
export type CategoryTypeValue = typeof CATEGORY_TYPE_MAP[CategoryTypeKey];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get the specifics type for a given category slug
 */
export function getCategoryType(categorySlug: string): CategoryTypeValue | null {
  return CATEGORY_TYPE_MAP[categorySlug as CategoryTypeKey] ?? null;
}

/**
 * Check if category uses specialized table vs JSONB
 */
export function usesSpecializedTable(categorySlug: string): boolean {
  const type = getCategoryType(categorySlug);
  return type === 'property' || type === 'job' || type === 'vehicle';
}

/**
 * Check if category uses JSONB storage
 */
export function usesJSONB(categorySlug: string): boolean {
  return !usesSpecializedTable(categorySlug);
}

