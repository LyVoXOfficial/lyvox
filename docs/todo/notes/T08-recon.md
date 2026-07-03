# T08 Recon - PostForm fast goods

Branch: `feat/post-fast-goods`

Source read:
- `apps/web/src/app/post/PostForm.tsx` in full. Current file is roughly 2.7k lines, not the older ~1.4k estimate.
- Graphify context: `PostForm.tsx`, `categoryDetector.ts`, `app/post/page.tsx`, ad detail, and i18n are the primary touch points.

## Current Step Map

The form uses absolute numeric steps with `TOTAL_STEPS = 8` and `currentStep` starting at 1.

- Step 1, category selection: `formData.category_id`, `selectedMainCategory`, grouped level-1/level-2 categories, and `handleCategorySelect`. Category changes clear `catalog_fields`. `categoryType` is detected from the selected category path/slug after selection.
- Step 2, condition: `formData.condition`. Jobs are currently handled by a render-time auto-advance that sets a default `used` condition and moves to step 4. Vehicles and electronics expose `for_parts`.
- Step 3, vehicle basics: `make_id`, `model_id`, `year`, `generation_id`, `steering_wheel`, `body_type`, `doors`, `color_id`, `color_code`, plus reference state for makes/models/years/body types/colors/doors and generation resolution state.
- Step 4, category specifics: vehicle engine/power/transmission/drive fields, plus bespoke components for real estate, electronics, fashion, jobs. Generic schema-backed categories render `FormRenderer` into `formData.catalog_fields`.
- Step 5, price and vehicle condition: all categories get `price`; vehicles also get mileage, vehicle condition, customs cleared, warranty, owners count, and VIN. Jobs are render-time skipped to step 7 because salary lives in jobs specifics.
- Step 6, vehicle options: vehicle-only `formData.options` grouped by option category. Non-vehicles are render-time skipped to step 7.
- Step 7, final details: `title`, `description`, photos via `UploadGallery`, `location`, profile phone, additional phone, and additional phone OTP verification state.
- Step 8, preview and publish: preview card, phone verification gate via `isVerified || justVerified`, save draft, delete, boost trigger for active edits, and publish.

## Navigation

- `handleNext` and `handleBack` jump over absolute step numbers.
- Jobs: `1 -> 4 -> 7 -> 8`, with back `4 -> 1` and `7 -> 4`.
- Non-vehicle non-job categories: `1 -> 2 -> 4 -> 5 -> 7 -> 8`, skipping 3 and 6.
- Vehicles: all 8 steps.
- Progress UI is not compacted by actual flow order. It displays the absolute `currentStep`, uses a hand-coded `effectiveTotal`, and computes remaining steps as `TOTAL_STEPS - currentStep`.
- Existing render-time skip blocks call `setCurrentStep` during render for jobs, non-vehicles at step 3, jobs at step 5, and non-vehicles at step 6. The remap step should remove this pattern instead of adding more of it.

## State Inventory

Core flow state:
- `currentStep`, `isLoading`, `advertId`
- `formData` initialized from `advertToEdit`
- `categoryType`
- `catalogSchemaState`
- `draftCreationInProgress`, `autoSaveTimerRef`, `lastSavedSnapshotRef`, `initialSnapshotCapturedRef`

Category and schema state:
- `selectedMainCategory`
- `catalog_fields` inside `formData`
- `schemaExcludedTypes`: vehicle, real_estate, electronics, fashion, jobs

Vehicle reference state:
- `makes`, `models`, `availableYears`, `bodyTypes`, `steeringWheels`, `colors`, `doors`
- `vehicleConditions`, `engineTypes`, `driveTypes`, `vehicleOptions`
- `makeSearchQuery`, `filteredMakes`, `availableTransmissions`, `availableFuelTypes`
- `generationStatus`, `generationCandidates`

Auto-save and verification state:
- `autoSaveStatus`, `autoSaveError`, `lastAutoSaveAt`
- `justVerified`
- `phoneVerificationOpen`, `phoneVerificationCode`, `phoneVerificationPhone`, `phoneVerificationError`, `phoneVerificationStatus`

## Validation

Step-level validation is mostly button-level:
- Step 1 next is disabled without `formData.category_id`.
- Step 2 next is disabled without `formData.condition`.
- Later steps generally allow next without local hard validation.

Publish-time validation:
- `validateSchemaFields()` checks required dynamic schema fields and number/select constraints for schema-backed categories only.
- `handlePublish()` hard-validates category, condition, description minimum length, location, and at least one uploaded media item.
- Phone verification is enforced by disabling publish through `canPublish = isVerified || justVerified`.
- Title is optional in the UI. Publish auto-generates from vehicle fields or category/price, then soft-warns when outside the SEO hint range.
- Additional phone validation is separate and requires `+32`; OTP calls `/api/phone/request` and `/api/phone/verify`.

## Draft Creation And Save Paths

- `ensureAdvertId()` creates a draft through `POST /api/adverts` and reads `result.data.advert.id`.
- Draft auto-creation currently happens only when reaching step 7, so `UploadGallery` has an `advertId`.
- `createDraftSnapshot()` serializes meaningful draft fields and sorted specifics to drive auto-save diffing.
- `saveDraftMutation()` ensures a draft, auto-generates a draft title if needed, then PATCHes `/api/adverts/{id}` with `status: "draft"`, `specifics`, and `content_locale`.
- Auto-save runs after meaningful changes with a 30 second timeout and avoids duplicate PATCHes through `lastSavedSnapshotRef`.
- `handlePublish()` ensures a draft, runs publish validation, PATCHes `status: "active"`, then routes to `/ad/{id}?published=1`.

## T08 Risk Notes

- Fast goods wants photos in required step 1. Because uploads need `advertId`, remap must create or ensure the draft earlier than the existing step-7-only draft creation.
- Fast goods wants category plus title in one step. Title currently lives in step 7 and is optional with publish fallback generation.
- Fast goods wants price plus condition in one step. Condition currently lives in step 2 and price in step 5.
- Generic schema fields currently load for non-excluded categories in step 4. T08 says fast goods should not block publish on those fields; the progressive profiling banner must preserve the path to complete them later.
- Legal/business seller gating fields are not in this component. Do not simplify any upstream legal/KYB flow while changing the step counter.
- Media gate must remain hard at publish. The fast path may move upload earlier, but it must not allow publishing with zero photos.
