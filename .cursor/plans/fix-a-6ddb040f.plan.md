<!-- 6ddb040f-3879-48d9-9cd7-3c74c3a5b005 14f83e49-fb77-4b70-813a-6fc541583952 -->
# Fix Media Loading & Add Advert Comparison

## Phase 1: Centralized Media URL Utility

Create a reusable utility function to ensure consistent signed URL generation across all pages.

**Create `apps/web/src/lib/media/signMediaUrls.ts`:**

- Export `signMediaUrls(mediaItems: Array<{url: string}>, ttlSeconds?: number): Promise<Array<{url: string, signedUrl: string | null}>>`
- Check if URL starts with `http://` or `https://` → return as-is
- Otherwise generate signed URL via `supabaseService().storage.from("ad-media").createSignedUrl()`
- Default TTL: 15 minutes (900 seconds)
- Handle errors gracefully (log warning, return null for failed URLs)

**Create `apps/web/src/lib/media/getFirstImage.ts`:**

- Export `getFirstImage(mediaItems: Array<{url: string, sort?: number | null}>): string | null`
- Sort by `sort` field (ascending)
- Return first valid signed URL or null

## Phase 2: Fix Favorites API

**Update `apps/web/src/app/api/favorites/route.ts` (lines 122-139):**

- Import `signMediaUrls` utility
- After fetching media from database, call `signMediaUrls()` on all media items
- Update `mediaMap` to use signed URLs instead of raw storage paths
- Add error logging for failed signed URL generation

## Phase 3: Fix Profile Adverts Rendering

**Update `apps/web/src/app/(protected)/profile/page.tsx` (line 86-108):**

- Import `signMediaUrls` utility
- Replace inline signed URL generation with utility function call
- Ensure media URLs are properly signed before attaching to adverts

**Update `apps/web/src/components/profile/ProfileAdvertsList.tsx` (line 20-24):**

- Import `signMediaUrls` if needed
- Ensure `pickImage()` function handles signed URLs correctly

## Phase 4: Update All Other Media Loading Points

Apply the centralized utility across all remaining pages:

**Files to update:**

1. `apps/web/src/app/page.tsx` (lines 76-114, 128-220) - Replace inline signing logic
2. `apps/web/src/app/c/[...path]/page.tsx` (lines 132-168) - Replace inline signing logic
3. `apps/web/src/app/ad/[id]/page.tsx` (loadSimilarAdverts function) - Already uses signing, verify consistency
4. `apps/web/src/app/api/profile/adverts/route.ts` (lines 85-120) - Replace inline signing logic

## Phase 5: Profile Favorites Tab - Inline Display

**Update `apps/web/src/app/(protected)/profile/page.tsx`:**

**Modify `loadProfileData` function (add after line 108):**

- Fetch user's favorites from `public.favorites` table
- Join with `adverts` table to get advert details
- Fetch media for favorite adverts
- Sign media URLs using centralized utility
- Return favorites array as part of ProfileData

**Update ProfileData type in `apps/web/src/lib/profileTypes.ts`:**

- Add `favorites: Array<{advertId: string, favoritedAt: string, advert: {...}}>` field

**Update Favorites TabsContent (lines 360-380):**

- Replace empty state with conditional rendering
- If `favorites.length === 0` → show empty state
- Otherwise → render `<AdsGrid items={favoriteItems} />` inline
- Keep the "View all" button linking to `/profile/favorites` for pagination

## Phase 6: Comparison Feature - Data Structures

**Create `apps/web/src/lib/types/comparison.ts`:**

```typescript
export type ComparableAdvert = {
  id: string;
  title: string;
  price: number | null;
  currency: string | null;
  location: string | null;
  categoryId: string | null;
  categoryName: string | null;
  condition: string | null; // "new", "used", "like-new", etc.
  image: string | null;
  createdAt: string;
  sellerVerified: boolean;
  sellerTrustScore: number; // 0-100
  specifics: Record<string, any>; // Category-specific attributes
};

export type ComparisonScores = {
  priceScore: number; // 0-100
  conditionScore: number; // 0-100
  trustScore: number; // 0-100
  ageScore: number; // 0-100
  totalScore: number; // weighted average
};

export type ComparisonResult = {
  advert: ComparableAdvert;
  scores: ComparisonScores;
};
```

## Phase 7: Comparison Scoring Logic

**Create `apps/web/src/lib/comparison/scoring.ts`:**

Implement deterministic scoring functions:

**`calculatePriceScore(price: number | null, allPrices: (number | null)[]): number`**

- If price is null → return 50 (neutral)
- Find min/max among non-null prices
- Lower price = higher score (inverse linear scale 0-100)

**`calculateConditionScore(condition: string | null): number`**

- Map conditions: "new" → 100, "like-new" → 85, "excellent" → 70, "good" → 55, "fair" → 40, "used" → 30, null → 50

**`calculateTrustScore(trustScore: number): number`**

- Direct mapping: trust score is already 0-100

**`calculateAgeScore(createdAt: string): number`**

- Calculate days since posted
- 0-1 day → 100, 1-3 days → 90, 3-7 days → 75, 7-14 days → 60, 14-30 days → 40, 30+ days → 20

**`calculateTotalScore(scores: Omit<ComparisonScores, 'totalScore'>): number`**

- Weighted: price 40% + condition 20% + trust 25% + age 15%

**`compareAdverts(adverts: ComparableAdvert[]): ComparisonResult[]`**

- Calculate all scores for each advert
- Return array with adverts + scores

## Phase 8: Comparison Summary Component

**Create `apps/web/src/components/comparison/ComparisonSummary.tsx`:**

Client component that renders deterministic summary:

**Props:** `{ results: ComparisonResult[], locale: Locale }`

**Logic:**

- Find best overall (highest totalScore)
- Find best price (highest priceScore)
- Find most trusted seller (highest trustScore)
- Find newest listing (highest ageScore)

**Render:**

- Card with bullet points:
  - "Лучшее соотношение цена/качество: {title}" (best overall)
  - "Самая выгодная цена: {title} ({formattedPrice})" (best price)
  - "Самый надёжный продавец: {title} (Trust Score {score}, verified)" (best trust)
  - "Самое свежее объявление: {title} ({relativeTime})" (newest)

Use existing i18n utilities: `formatCurrency`, `formatRelativeTime`.

## Phase 9: Comparison Table Component

**Create `apps/web/src/components/comparison/ComparisonTable.tsx`:**

Client component rendering side-by-side comparison:

**Props:** `{ adverts: ComparableAdvert[], locale: Locale, onClose: () => void }`

**UI Structure:**

- Modal/Sheet overlay (use shadcn Dialog or Sheet)
- Header: "Сравнение объявлений ({count})" + close button
- Horizontal scroll container for mobile
- Table with columns per advert + row per attribute:
  - Row: Thumbnail image
  - Row: Title (linked to `/ad/[id]`)
  - Row: Price (formatted with currency)
  - Row: Category
  - Row: Location
  - Row: Condition
  - Row: Seller trust score (with progress bar)
  - Row: Seller verification (icons for email/phone)
  - Row: Posted (relative time)
  - Row: Key specifics (category-dependent, e.g., mileage for cars)
- Footer: `<ComparisonSummary>` component

**Styling:**

- Sticky header row
- Highlight best value in each row (e.g., lowest price, highest trust)
- Mobile: cards instead of table, swipeable

## Phase 10: Selection UI in Favorites/AdsGrid

**Create `apps/web/src/components/comparison/SelectableAdsGrid.tsx`:**

Wrapper around `AdsGrid` that adds selection checkboxes:

**State:**

- `selectedIds: Set<string>`
- Max selection: 4 adverts

**UI:**

- Checkbox overlay on each `AdCard`
- Floating action bar at bottom when `selectedIds.size >= 2`:
  - "Сравнить ({count})" button
  - "Отменить" button to clear selection
- Disable checkboxes when limit (4) reached

**Integration:**

- Replace `<AdsGrid>` with `<SelectableAdsGrid>` in favorites page
- Pass `onCompare={(selectedIds) => { /* open comparison */ }}`

## Phase 11: Comparison Data Fetching

**Create `apps/web/src/app/api/comparison/route.ts`:**

POST endpoint that fetches full comparison data:

**Input:** `{ advertIds: string[] }` (2-4 IDs)

**Query:**

- Fetch adverts from `public.adverts`
- Join with `categories` for names
- Join with `trust_score` for seller scores
- Join with `profiles` for verification status
- Fetch media and sign URLs
- Fetch category-specific `specifics` if available

**Output:** `{ adverts: ComparableAdvert[] }`

**Validation:**

- Max 4 adverts
- All adverts must be active
- User must be authenticated

## Phase 12: Wire Everything Together

**Update `apps/web/src/app/(protected)/profile/favorites/page.tsx`:**

- Replace `<AdsGrid>` with `<SelectableAdsGrid>`
- Add state for comparison modal
- When user clicks "Сравнить" → fetch comparison data → open modal with `<ComparisonTable>`

**Update Favorites tab in profile page:**

- Same integration for inline favorites list

## Phase 13: Translations

**Add to all locale files (`en.json`, `ru.json`, `nl.json`, `fr.json`, `de.json`):**

```json
"comparison": {
  "title": "Compare adverts",
  "select_prompt": "Select 2-4 adverts to compare",
  "compare_button": "Compare ({count})",
  "cancel": "Cancel",
  "max_reached": "Maximum 4 adverts",
  "summary_best_overall": "Best overall value",
  "summary_best_price": "Best price",
  "summary_most_trusted": "Most trusted seller",
  "summary_newest": "Newest listing",
  "table_image": "Photo",
  "table_title": "Title",
  "table_price": "Price",
  "table_category": "Category",
  "table_location": "Location",
  "table_condition": "Condition",
  "table_trust_score": "Seller trust",
  "table_verification": "Verification",
  "table_posted": "Posted",
  "table_specifics": "Key features"
}
```

## Phase 14: Testing & Documentation

- Test image loading on all pages (homepage, categories, favorites, profile adverts, advert detail, similar adverts)
- Test comparison flow: select → compare → view table → close
- Test mobile responsiveness for comparison table
- Verify all signed URLs expire correctly (15 min TTL)
- Update `docs/development/` with new comparison feature docs
- Update `docs/domains/adverts.md` with media URL signing pattern

### To-dos

- [ ] Gather existing guidance on advert media handling from key docs (PROMPT_MAIN, KNOWLEDGE_MAP, CURSOR_KNOWLEDGE_BASE, relevant domain/development docs).
- [ ] Inspect homepage, detail page, and preview step media-loading code paths to compare filtering/ordering and expected flags.
- [ ] Review media upload flow in creation wizard (Supabase calls, DB writes) and inspect sample data for inconsistencies introduced by draft-less UX.
- [ ] Add temporary dev-only logging around media upload and retrieval layers to surface discrepancies during local testing.
- [ ] Adjust data flow and loaders so media stays consistent across creation, preview, homepage, and detail views without draft requirement.
- [ ] Document new media flow assumptions and invariants in relevant domain/development docs.
- [ ] Test end-to-end flow, remove temp logs, and provide final summary including root cause and impact.