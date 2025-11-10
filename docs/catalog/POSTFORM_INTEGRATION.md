# PostForm Integration Guide

## Overview

The PostForm has been extended to support category-specific fields in Step 4 (Technical Parameters). The form now dynamically renders appropriate field components based on the detected category type.

## Architecture

### Category Detection

Location: `apps/web/src/lib/utils/categoryDetector.ts`

```typescript
import { detectCategoryType, requiresSpecializedComponent } from '@/lib/utils/categoryDetector';

const categoryType = detectCategoryType(category.slug);
// Returns: 'vehicle' | 'real_estate' | 'electronics' | 'fashion' | 'jobs' | 'generic'
```

### Component Mapping

| Category Type | Component | Location |
|--------------|-----------|----------|
| `vehicle` | Existing VehicleFields | (already implemented) |
| `real_estate` | `RealEstateFields` | `components/catalog/RealEstateFields.tsx` |
| `electronics` | `ElectronicsFields` | `components/catalog/ElectronicsFields.tsx` |
| `fashion` | `FashionFields` | `components/catalog/FashionFields.tsx` |
| `jobs` | `JobsFields` | `components/catalog/JobsFields.tsx` |
| `generic` | `DynamicFieldRenderer` | `components/catalog/DynamicFieldRenderer.tsx` |

## Integration Steps for PostForm

### 1. Import Components

Add to `apps/web/src/app/post/PostForm.tsx`:

```typescript
import { detectCategoryType, requiresSpecializedComponent } from '@/lib/utils/categoryDetector';
import {
  RealEstateFields,
  ElectronicsFields,
  FashionFields,
  JobsFields,
  DynamicFieldRenderer,
} from '@/components/catalog';
```

### 2. Add Category Type State

```typescript
const [categoryType, setCategoryType] = useState<CategoryType>('generic');

// Update when category changes
useEffect(() => {
  if (formData.category_id && categories.length > 0) {
    const category = categories.find(c => c.id === formData.category_id);
    if (category) {
      const detectedType = detectCategoryType(category.slug);
      setCategoryType(detectedType);
    }
  }
}, [formData.category_id, categories]);
```

### 3. Modify Step 4 Rendering

Replace the existing Step 4 (Technical Parameters) section with:

```typescript
// Step 4: Category-Specific Technical Parameters
if (currentStep === 4) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("post.form.step_4_title")}</CardTitle>
        <CardDescription>
          {getCategoryTypeName(categoryType)} - Specific Information
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Render category-specific component */}
        {categoryType === 'vehicle' && (
          <div>
            {/* Existing vehicle fields implementation */}
          </div>
        )}
        
        {categoryType === 'real_estate' && (
          <RealEstateFields
            formData={formData}
            onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
            locale={locale}
          />
        )}
        
        {categoryType === 'electronics' && (
          <ElectronicsFields
            formData={formData}
            onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
            locale={locale}
          />
        )}
        
        {categoryType === 'fashion' && (
          <FashionFields
            formData={formData}
            onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
            locale={locale}
          />
        )}
        
        {categoryType === 'jobs' && (
          <JobsFields
            formData={formData}
            onChange={(field, value) => setFormData(prev => ({ ...prev, [field]: value }))}
            locale={locale}
          />
        )}
        
        {categoryType === 'generic' && (
          <div className="text-center py-8 text-muted-foreground">
            <p>Generic category - no specialized fields required.</p>
            <p className="text-sm mt-2">You can skip to the next step.</p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={() => setCurrentStep(3)}>
          {t("common.back")}
        </Button>
        <Button onClick={() => setCurrentStep(5)}>
          {t("common.next")}
        </Button>
      </CardFooter>
    </Card>
  );
}
```

### 4. Update formData Type

Extend the form data type to accommodate all category-specific fields:

```typescript
import type { 
  PropertyListing, 
  ElectronicsItem, 
  FashionItem, 
  JobListing 
} from '@/lib/types/catalog';

type FormData = 
  | VehicleFormData // existing
  | Partial<PropertyListing>
  | Partial<ElectronicsItem>
  | Partial<FashionItem>
  | Partial<JobListing>
  | Record<string, any>; // generic fallback
```

### 5. Update Save/Submit Logic

When saving to database, ensure category-specific fields are stored in:
- **Specialized tables** (for vehicles, real estate, jobs) via their respective IDs
- **`ad_item_specifics` JSONB** (for electronics, fashion, generic categories)

Example:

```typescript
const saveAdvert = async () => {
  const payload = {
    // Base advert fields
    title: formData.title,
    description: formData.description,
    price: formData.price,
    category_id: formData.category_id,
    
    // Category-specific data
    ad_item_specifics: categoryType === 'electronics' || categoryType === 'fashion'
      ? extractCategorySpecificFields(formData, categoryType)
      : null,
    
    // For specialized tables, create separate insert
    property_listing_id: categoryType === 'real_estate' ? propertyId : null,
    job_listing_id: categoryType === 'jobs' ? jobId : null,
  };
  
  // Submit to API
  await apiFetch('/api/adverts', { method: 'POST', body: JSON.stringify(payload) });
};
```

## API Integration

Each category-specific component fetches its own reference data:

- `RealEstateFields` → `/api/catalog/property-types`, `/api/catalog/epc-ratings`
- `ElectronicsFields` → `/api/catalog/device-brands`, `/api/catalog/device-models`
- `FashionFields` → Uses hardcoded EU size standards (no API calls)
- `JobsFields` → `/api/catalog/job-categories`, `/api/catalog/contract-types`, `/api/catalog/cp-codes`

All API calls include `?lang=${locale}` parameter for i18n support.

## Validation

Category-specific validation is handled by Zod schemas in `apps/web/src/lib/validations/catalog/`:

```typescript
import { propertyListingSchema } from '@/lib/validations/catalog/property';
import { electronicsItemSchema } from '@/lib/validations/catalog/electronics';
// ... etc

// Validate before submit
const result = propertyListingSchema.safeParse(formData);
if (!result.success) {
  toast.error(result.error.errors[0].message);
  return;
}
```

## Testing

To test category-specific forms:

1. Select a category that maps to the desired type (e.g., "Продажа недвижимости" → `real_estate`)
2. Progress through Steps 1-3 as normal
3. Step 4 should render the category-specific component
4. Fill in required fields and validate
5. Submit and verify data is stored correctly in DB

## Troubleshooting

### Component not rendering
- Check category slug matches patterns in `categoryDetector.ts`
- Verify imports are correct
- Check browser console for React errors

### Data not saving
- Verify API endpoints are accessible
- Check network tab for request payloads
- Ensure Supabase migrations have been applied
- Confirm RLS policies allow insert/update

### TypeScript errors
- Regenerate types: `npx supabase gen types typescript --project-id <id> > supabase/types/database.types.ts`
- Restart TypeScript server in IDE

## Next Steps

1. **Implement the actual PostForm changes** (this guide provides the template)
2. **Add i18n strings** for all new field labels (5 languages)
3. **Write tests** for each category-specific form
4. **Update SearchFilters** to include category-specific filters

---

**Status**: ✅ All components ready, awaiting PostForm integration
**Last Updated**: 2025-01-05

---

## 🔗 Related Docs

**Catalog:** [CATALOG_IMPLEMENTATION_STATUS.md](./CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](./FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) • [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) • [CATALOG_MASTER.md](./CATALOG_MASTER.md)




