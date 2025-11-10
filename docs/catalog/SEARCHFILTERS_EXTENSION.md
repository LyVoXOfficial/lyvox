# SearchFilters Extension Guide

## Overview

Extend `SearchFilters.tsx` to support category-specific filters that adapt based on the selected category. When user selects a category, show relevant filters for that category type.

## Current State

`SearchFiltersState` includes:
```typescript
{
  category_id: string | null;
  price_min: number | null;
  price_max: number | null;
  location: string | null;
}
```

## Extension Strategy

### 1. Extend SearchFiltersState Type

```typescript
export type SearchFiltersState = {
  // Base filters
  category_id: string | null;
  price_min: number | null;
  price_max: number | null;
  location: string | null;
  
  // Category-specific filters (optional)
  category_filters?: Record<string, any>;
};
```

### 2. Category Filter Definitions

Create `apps/web/src/lib/search/categoryFilters.ts`:

```typescript
import { detectCategoryType, CategoryType } from '@/lib/utils/categoryDetector';

export interface CategoryFilter {
  name: string;
  label: string;
  type: 'range' | 'select' | 'multiselect' | 'checkbox';
  options?: Array<{ value: string; label: string }>;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export function getCategoryFilters(category: Category): CategoryFilter[] {
  const categoryType = detectCategoryType(category.slug);
  
  switch (categoryType) {
    case 'vehicle':
      return [
        {
          name: 'mileage_max',
          label: 'Max Mileage',
          type: 'range',
          min: 0,
          max: 500000,
          step: 10000,
          unit: 'km',
        },
        {
          name: 'year_min',
          label: 'Min Year',
          type: 'range',
          min: 1990,
          max: new Date().getFullYear(),
          step: 1,
        },
        {
          name: 'fuel_type',
          label: 'Fuel Type',
          type: 'multiselect',
          options: [
            { value: 'petrol', label: 'Petrol' },
            { value: 'diesel', label: 'Diesel' },
            { value: 'electric', label: 'Electric' },
            { value: 'hybrid', label: 'Hybrid' },
          ],
        },
        {
          name: 'transmission',
          label: 'Transmission',
          type: 'multiselect',
          options: [
            { value: 'manual', label: 'Manual' },
            { value: 'automatic', label: 'Automatic' },
          ],
        },
      ];
    
    case 'real_estate':
      return [
        {
          name: 'area_sqm_min',
          label: 'Min Area',
          type: 'range',
          min: 20,
          max: 500,
          step: 10,
          unit: 'm²',
        },
        {
          name: 'area_sqm_max',
          label: 'Max Area',
          type: 'range',
          min: 20,
          max: 500,
          step: 10,
          unit: 'm²',
        },
        {
          name: 'rooms_min',
          label: 'Min Rooms',
          type: 'select',
          options: [
            { value: '1', label: '1+' },
            { value: '2', label: '2+' },
            { value: '3', label: '3+' },
            { value: '4', label: '4+' },
            { value: '5', label: '5+' },
          ],
        },
        {
          name: 'bedrooms_min',
          label: 'Min Bedrooms',
          type: 'select',
          options: [
            { value: '1', label: '1+' },
            { value: '2', label: '2+' },
            { value: '3', label: '3+' },
            { value: '4', label: '4+' },
          ],
        },
        {
          name: 'epc_rating',
          label: 'EPC Rating',
          type: 'multiselect',
          options: [
            { value: 'A++', label: 'A++ (Best)' },
            { value: 'A+', label: 'A+' },
            { value: 'A', label: 'A' },
            { value: 'B', label: 'B' },
            { value: 'C', label: 'C' },
            { value: 'D', label: 'D' },
            { value: 'E', label: 'E' },
            { value: 'F', label: 'F' },
            { value: 'G', label: 'G (Worst)' },
          ],
        },
        {
          name: 'listing_type',
          label: 'Type',
          type: 'select',
          options: [
            { value: 'all', label: 'All' },
            { value: 'sale', label: 'For Sale' },
            { value: 'rent', label: 'For Rent' },
          ],
        },
        {
          name: 'pet_friendly',
          label: 'Pet Friendly',
          type: 'checkbox',
        },
        {
          name: 'elevator',
          label: 'Elevator',
          type: 'checkbox',
        },
      ];
    
    case 'electronics':
      return [
        {
          name: 'brand',
          label: 'Brand',
          type: 'select',
          // Dynamically load from /api/catalog/device-brands
          options: [],
        },
        {
          name: 'storage_gb_min',
          label: 'Min Storage',
          type: 'select',
          options: [
            { value: '16', label: '16 GB' },
            { value: '32', label: '32 GB' },
            { value: '64', label: '64 GB' },
            { value: '128', label: '128 GB' },
            { value: '256', label: '256 GB' },
            { value: '512', label: '512 GB' },
            { value: '1024', label: '1 TB' },
          ],
        },
        {
          name: 'memory_ram_min',
          label: 'Min RAM',
          type: 'select',
          options: [
            { value: '2', label: '2 GB' },
            { value: '4', label: '4 GB' },
            { value: '8', label: '8 GB' },
            { value: '16', label: '16 GB' },
            { value: '32', label: '32 GB' },
          ],
        },
        {
          name: 'factory_unlocked',
          label: 'Factory Unlocked',
          type: 'checkbox',
        },
        {
          name: 'warranty_remaining',
          label: 'Warranty Remaining',
          type: 'checkbox',
        },
      ];
    
    case 'fashion':
      return [
        {
          name: 'gender',
          label: 'Gender',
          type: 'multiselect',
          options: [
            { value: 'women', label: 'Women' },
            { value: 'men', label: 'Men' },
            { value: 'unisex', label: 'Unisex' },
          ],
        },
        {
          name: 'size_eu',
          label: 'Size (EU)',
          type: 'multiselect',
          options: [
            { value: 'XXS', label: 'XXS' },
            { value: 'XS', label: 'XS' },
            { value: 'S', label: 'S' },
            { value: 'M', label: 'M' },
            { value: 'L', label: 'L' },
            { value: 'XL', label: 'XL' },
            { value: 'XXL', label: 'XXL' },
          ],
        },
        {
          name: 'brand',
          label: 'Brand',
          type: 'select',
          options: [], // Populate dynamically or with common brands
        },
        {
          name: 'season',
          label: 'Season',
          type: 'multiselect',
          options: [
            { value: 'spring_summer', label: 'Spring/Summer' },
            { value: 'fall_winter', label: 'Fall/Winter' },
            { value: 'all_season', label: 'All Season' },
          ],
        },
        {
          name: 'original_tags',
          label: 'Original Tags',
          type: 'checkbox',
        },
        {
          name: 'never_worn',
          label: 'Never Worn',
          type: 'checkbox',
        },
      ];
    
    case 'jobs':
      return [
        {
          name: 'employment_type',
          label: 'Employment Type',
          type: 'multiselect',
          options: [
            { value: 'full_time', label: 'Full-Time' },
            { value: 'part_time', label: 'Part-Time' },
            { value: 'freelance', label: 'Freelance' },
            { value: 'internship', label: 'Internship' },
            { value: 'temporary', label: 'Temporary' },
          ],
        },
        {
          name: 'salary_min',
          label: 'Min Salary (€/month)',
          type: 'range',
          min: 0,
          max: 10000,
          step: 500,
        },
        {
          name: 'remote_option',
          label: 'Remote Work',
          type: 'multiselect',
          options: [
            { value: 'no', label: 'On-site Only' },
            { value: 'hybrid', label: 'Hybrid' },
            { value: 'full', label: 'Fully Remote' },
            { value: 'flexible', label: 'Flexible' },
          ],
        },
        {
          name: 'experience_level',
          label: 'Experience Level',
          type: 'multiselect',
          options: [
            { value: 'entry', label: 'Entry Level' },
            { value: 'mid', label: 'Mid Level' },
            { value: 'senior', label: 'Senior' },
            { value: 'lead', label: 'Lead / Manager' },
          ],
        },
      ];
    
    default:
      return [];
  }
}
```

### 3. Update SearchFilters Component

In `SearchFilters.tsx`, add dynamic filter rendering:

```typescript
// Add state for category-specific filters
const [categoryFilters, setCategoryFilters] = useState<Record<string, any>>({});
const [availableCategoryFilters, setAvailableCategoryFilters] = useState<CategoryFilter[]>([]);

// When category changes, update available filters
useEffect(() => {
  if (selectedCategory) {
    const filters = getCategoryFilters(selectedCategory);
    setAvailableCategoryFilters(filters);
  } else {
    setAvailableCategoryFilters([]);
  }
}, [selectedCategory]);

// Render category-specific filters section
{availableCategoryFilters.length > 0 && (
  <div className="mt-6 pt-6 border-t">
    <h3 className="font-semibold mb-4">{t('search.specific_filters')}</h3>
    <div className="space-y-4">
      {availableCategoryFilters.map((filter) => (
        <CategoryFilterRenderer
          key={filter.name}
          filter={filter}
          value={categoryFilters[filter.name]}
          onChange={(value) => {
            setCategoryFilters(prev => ({
              ...prev,
              [filter.name]: value,
            }));
          }}
          locale={locale}
        />
      ))}
    </div>
  </div>
)}
```

### 4. Create CategoryFilterRenderer Component

Create `apps/web/src/components/search/CategoryFilterRenderer.tsx`:

```typescript
import { CategoryFilter } from '@/lib/search/categoryFilters';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

interface CategoryFilterRendererProps {
  filter: CategoryFilter;
  value: any;
  onChange: (value: any) => void;
  locale: string;
}

export function CategoryFilterRenderer({
  filter,
  value,
  onChange,
  locale,
}: CategoryFilterRendererProps) {
  switch (filter.type) {
    case 'range':
      return (
        <div className="space-y-2">
          <Label>
            {filter.label}
            {value !== undefined && (
              <span className="ml-2 text-sm text-muted-foreground">
                {value}{filter.unit}
              </span>
            )}
          </Label>
          <Slider
            min={filter.min}
            max={filter.max}
            step={filter.step}
            value={[value || filter.min || 0]}
            onValueChange={([val]) => onChange(val)}
          />
        </div>
      );
    
    case 'select':
      return (
        <div className="space-y-2">
          <Label>{filter.label}</Label>
          <Select value={value || ''} onValueChange={onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Any" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Any</SelectItem>
              {filter.options?.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    
    case 'multiselect':
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          <Label>{filter.label}</Label>
          <div className="space-y-2">
            {filter.options?.map((opt) => (
              <div key={opt.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${filter.name}-${opt.value}`}
                  checked={selectedValues.includes(opt.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange([...selectedValues, opt.value]);
                    } else {
                      onChange(selectedValues.filter((v: string) => v !== opt.value));
                    }
                  }}
                />
                <Label htmlFor={`${filter.name}-${opt.value}`} className="text-sm cursor-pointer">
                  {opt.label}
                </Label>
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'checkbox':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={filter.name}
            checked={value === true}
            onCheckedChange={onChange}
          />
          <Label htmlFor={filter.name} className="cursor-pointer">
            {filter.label}
          </Label>
        </div>
      );
    
    default:
      return null;
  }
}
```

### 5. Update URL Parameters

When filters change, update URL to include category-specific filters:

```typescript
const applyFilters = () => {
  const params = new URLSearchParams();
  
  // Base filters
  if (selectedCategory) params.set('category_id', selectedCategory.id);
  if (priceRange[0] > 0) params.set('price_min', priceRange[0].toString());
  if (priceRange[1] < 10000) params.set('price_max', priceRange[1].toString());
  if (location) params.set('location', location);
  
  // Category-specific filters
  Object.entries(categoryFilters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      if (Array.isArray(value) && value.length > 0) {
        params.set(key, value.join(','));
      } else {
        params.set(key, String(value));
      }
    }
  });
  
  router.push(`/search?${params.toString()}`);
  
  // Notify parent
  onFiltersChange?.({
    category_id: selectedCategory?.id || null,
    price_min: priceRange[0] > 0 ? priceRange[0] : null,
    price_max: priceRange[1] < 10000 ? priceRange[1] : null,
    location: location || null,
    category_filters: categoryFilters,
  });
};
```

### 6. Update Search API

In `apps/web/src/app/search/page.tsx`, extract category-specific filters from URL and pass to search query:

```typescript
const categoryFilters: Record<string, any> = {};
searchParams.forEach((value, key) => {
  if (!['category_id', 'price_min', 'price_max', 'location', 'q'].includes(key)) {
    categoryFilters[key] = value.includes(',') ? value.split(',') : value;
  }
});
```

### 7. Update Database Query

In search logic, build dynamic WHERE clauses based on category type:

```typescript
// For Real Estate
if (categoryType === 'real_estate' && categoryFilters.area_sqm_min) {
  query = query.gte('area_sqm', parseInt(categoryFilters.area_sqm_min));
}

// For Electronics
if (categoryType === 'electronics' && categoryFilters.storage_gb_min) {
  query = query.gte('storage_gb', parseInt(categoryFilters.storage_gb_min));
}

// For JSONB categories, use containment:
if (categoryFilters.brand) {
  query = query.contains('ad_item_specifics', { brand: categoryFilters.brand });
}
```

## i18n Strings to Add

Add to `apps/web/src/i18n/locales/*.json`:

```json
{
  "search": {
    "specific_filters": "Category Filters",
    "any": "Any",
    "clear_filters": "Clear All Filters",
    "apply_filters": "Apply Filters",
    "active_filters": "Active Filters"
  }
}
```

## Testing

1. Select a category (e.g., Real Estate)
2. Verify category-specific filters appear
3. Adjust filters and click "Apply"
4. Check URL includes all filter parameters
5. Verify search results match filters
6. Switch to different category, verify filters change
7. Clear category, verify category-specific filters hide

---

**Status**: Implementation guide complete  
**Estimated Time**: 3-4 hours  
**Next**: Implement in SearchFilters.tsx following this guide

---

## 🔗 Related Docs

**Catalog:** [CATALOG_IMPLEMENTATION_STATUS.md](./CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](./FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) • [POSTFORM_INTEGRATION.md](./POSTFORM_INTEGRATION.md) • [CATALOG_MASTER.md](./CATALOG_MASTER.md)




