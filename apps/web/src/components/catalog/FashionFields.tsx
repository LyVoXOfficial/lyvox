"use client";

import { useI18n } from "@/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type FashionFormData = Record<string, any>;

interface FashionFieldsProps {
  formData: FashionFormData;
  onChange: (field: string, value: any) => void;
  locale?: string;
}

export function FashionFields({
  formData,
  onChange,
  locale = "en",
}: FashionFieldsProps) {
  const { t } = useI18n();
  const tr = (k: string, fb: string) => {
    const v = t(k);
    return v === k ? fb : v;
  };
  const inputClass = "rounded-xl h-11 min-h-[44px] focus-visible:ring-4 focus-visible:ring-primary/12";
  const cardClass = "border-border/70 shadow-[var(--shadow-soft)]";

  // Gender & Age Group options
  const genderOptions = [
    { value: 'women', label: tr('catalog.fashion.women', 'Women') },
    { value: 'men', label: tr('catalog.fashion.men', 'Men') },
    { value: 'unisex', label: tr('catalog.fashion.unisex', 'Unisex') },
  ];

  const ageGroupOptions = [
    { value: 'adult', label: tr('catalog.fashion.adult', 'Adult') },
    { value: 'kids', label: tr('catalog.fashion.kids', 'Kids (3-12)') },
    { value: 'baby', label: tr('catalog.fashion.baby', 'Baby (0-2)') },
  ];

  // Item type options
  const itemTypeOptions = [
    { value: 'tops', label: tr('catalog.fashion.tops', 'Tops / Shirts') },
    { value: 'bottoms', label: tr('catalog.fashion.bottoms', 'Bottoms / Pants') },
    { value: 'dresses', label: tr('catalog.fashion.dresses', 'Dresses') },
    { value: 'outerwear', label: tr('catalog.fashion.outerwear', 'Outerwear / Jackets') },
    { value: 'shoes', label: tr('catalog.fashion.shoes', 'Shoes') },
    { value: 'accessories', label: tr('catalog.fashion.accessories', 'Accessories') },
    { value: 'underwear', label: tr('catalog.fashion.underwear', 'Underwear') },
    { value: 'sportswear', label: tr('catalog.fashion.sportswear', 'Sportswear') },
  ];

  // EU Size mappings
  const euSizesClothing = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const euSizesNumeric = Array.from({ length: 25 }, (_, i) => (32 + i * 2).toString()); // 32-80

  const shoeSizesEU = Array.from({ length: 30 }, (_, i) => (i + 19).toString()); // 19-48

  // Material options
  const materialOptions = [
    { value: 'cotton', label: tr('catalog.fashion.material_cotton', 'Cotton') },
    { value: 'polyester', label: tr('catalog.fashion.material_polyester', 'Polyester') },
    { value: 'wool', label: tr('catalog.fashion.material_wool', 'Wool') },
    { value: 'leather', label: tr('catalog.fashion.material_leather', 'Leather') },
    { value: 'denim', label: tr('catalog.fashion.material_denim', 'Denim') },
    { value: 'silk', label: tr('catalog.fashion.material_silk', 'Silk') },
    { value: 'linen', label: tr('catalog.fashion.material_linen', 'Linen') },
    { value: 'synthetic', label: tr('catalog.fashion.material_synthetic', 'Synthetic') },
    { value: 'mixed', label: tr('catalog.fashion.material_mixed', 'Mixed') },
  ];

  // Season options
  const seasonOptions = [
    { value: 'spring_summer', label: tr('catalog.fashion.season_spring_summer', 'Spring/Summer') },
    { value: 'fall_winter', label: tr('catalog.fashion.season_fall_winter', 'Fall/Winter') },
    { value: 'all_season', label: tr('catalog.fashion.season_all', 'All Season') },
  ];

  const isShoes = formData.item_type === 'shoes';
  const isAccessory = formData.item_type === 'accessories';

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="font-extrabold tracking-tight">{tr('catalog.common.basic_info', 'Basic Information')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Type */}
            <div className="space-y-2">
              <Label htmlFor="item_type">
                {tr('catalog.fashion.item_type', 'Item Type')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.item_type || ''}
                onValueChange={(val) => onChange('item_type', val)}
              >
                <SelectTrigger id="item_type" className={inputClass}>
                  <SelectValue placeholder={tr('catalog.common.select_type', 'Select type...')} />
                </SelectTrigger>
                <SelectContent>
                  {itemTypeOptions.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Gender */}
            <div className="space-y-2">
              <Label htmlFor="gender">
                {tr('catalog.fashion.gender', 'Gender')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.gender || ''}
                onValueChange={(val) => onChange('gender', val)}
              >
                <SelectTrigger id="gender" className={inputClass}>
                  <SelectValue placeholder={tr('catalog.fashion.select_gender', 'Select gender...')} />
                </SelectTrigger>
                <SelectContent>
                  {genderOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Age Group */}
            <div className="space-y-2">
              <Label htmlFor="age_group">{tr('catalog.fashion.age_group', 'Age Group')}</Label>
              <Select
                value={formData.age_group || ''}
                onValueChange={(val) => onChange('age_group', val)}
              >
                <SelectTrigger id="age_group" className={inputClass}>
                  <SelectValue placeholder={tr('catalog.common.select_placeholder', 'Select...')} />
                </SelectTrigger>
                <SelectContent>
                  {ageGroupOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand */}
            <div className="space-y-2">
              <Label htmlFor="brand">{tr('catalog.fashion.brand', 'Brand')}</Label>
              <Input
                id="brand"
                type="text"
                maxLength={100}
                placeholder={tr('catalog.fashion.brand_placeholder', 'e.g., Nike, Zara, H&M')}
                value={formData.brand || ''}
                onChange={(e) => onChange('brand', e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Size Selection */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="font-extrabold tracking-tight">{tr('catalog.fashion.size', 'Size')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isShoes ? (
              // Shoe sizes
              <>
                <div className="space-y-2">
                  <Label htmlFor="size_eu">
                    {tr('catalog.fashion.eu_size', 'EU Size')} <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.size_eu || ''}
                    onValueChange={(val) => onChange('size_eu', val)}
                  >
                    <SelectTrigger id="size_eu" className={inputClass}>
                      <SelectValue placeholder={tr('catalog.fashion.select_eu_size', 'Select EU size...')} />
                    </SelectTrigger>
                    <SelectContent>
                      {shoeSizesEU.map((size) => (
                        <SelectItem key={size} value={size}>
                          EU {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size_uk">{tr('catalog.fashion.size_uk', 'UK Size')}</Label>
                  <Input
                    id="size_uk"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 8.5"
                    value={formData.size_uk || ''}
                    onChange={(e) => onChange('size_uk', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size_us">{tr('catalog.fashion.size_us', 'US Size')}</Label>
                  <Input
                    id="size_us"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 9"
                    value={formData.size_us || ''}
                    onChange={(e) => onChange('size_us', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            ) : !isAccessory ? (
              // Clothing sizes
              <>
                <div className="space-y-2">
                  <Label htmlFor="size_eu">
                    {tr('catalog.fashion.size_eu', 'Size (EU)')} <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.size_eu || ''}
                      onValueChange={(val) => onChange('size_eu', val)}
                    >
                      <SelectTrigger id="size_eu" className={`flex-1 ${inputClass}`}>
                        <SelectValue placeholder={tr('catalog.fashion.select_size', 'Select size...')} />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 font-semibold border-b">{tr('catalog.fashion.letter_sizes', 'Letter Sizes')}</div>
                        {euSizesClothing.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                        <div className="p-2 font-semibold border-b">{tr('catalog.fashion.numeric_sizes', 'Numeric Sizes')}</div>
                        {euSizesNumeric.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size_uk">{tr('catalog.fashion.size_uk', 'UK Size')}</Label>
                  <Input
                    id="size_uk"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 10, M"
                    value={formData.size_uk || ''}
                    onChange={(e) => onChange('size_uk', e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size_us">{tr('catalog.fashion.size_us', 'US Size')}</Label>
                  <Input
                    id="size_us"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 6, M"
                    value={formData.size_us || ''}
                    onChange={(e) => onChange('size_us', e.target.value)}
                    className={inputClass}
                  />
                </div>
              </>
            ) : null}

            {/* Measurements (for non-accessories) */}
            {!isAccessory && (
              <div className="md:col-span-2">
                <Label>{tr('catalog.fashion.measurements', 'Measurements (cm) - Optional but recommended')}</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div className="space-y-1">
                    <Label htmlFor="measurement_chest" className="text-sm text-muted-foreground">
                      {tr('catalog.fashion.measurement_chest', 'Chest/Bust')}
                    </Label>
                    <Input
                      id="measurement_chest"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_chest ?? ''}
                      onChange={(e) => onChange('measurement_chest', e.target.value ? parseFloat(e.target.value) : null)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="measurement_waist" className="text-sm text-muted-foreground">
                      {tr('catalog.fashion.measurement_waist', 'Waist')}
                    </Label>
                    <Input
                      id="measurement_waist"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_waist ?? ''}
                      onChange={(e) => onChange('measurement_waist', e.target.value ? parseFloat(e.target.value) : null)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="measurement_hips" className="text-sm text-muted-foreground">
                      {tr('catalog.fashion.measurement_hips', 'Hips')}
                    </Label>
                    <Input
                      id="measurement_hips"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_hips ?? ''}
                      onChange={(e) => onChange('measurement_hips', e.target.value ? parseFloat(e.target.value) : null)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="measurement_length" className="text-sm text-muted-foreground">
                      {tr('catalog.fashion.measurement_length', 'Length')}
                    </Label>
                    <Input
                      id="measurement_length"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_length ?? ''}
                      onChange={(e) => onChange('measurement_length', e.target.value ? parseFloat(e.target.value) : null)}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Material & Style */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="font-extrabold tracking-tight">{tr('catalog.fashion.material_style', 'Material & Style')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Material */}
            <div className="space-y-2">
              <Label htmlFor="material">{tr('catalog.fashion.material', 'Material')}</Label>
              <Select
                value={formData.material || ''}
                onValueChange={(val) => onChange('material', val)}
              >
                <SelectTrigger id="material" className={inputClass}>
                  <SelectValue placeholder={tr('catalog.fashion.select_material', 'Select material...')} />
                </SelectTrigger>
                <SelectContent>
                  {materialOptions.map((material) => (
                    <SelectItem key={material.value} value={material.value}>
                      {material.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color">{tr('catalog.fashion.color', 'Color')}</Label>
              <Input
                id="color"
                type="text"
                maxLength={50}
                placeholder={tr('catalog.fashion.color_placeholder', 'e.g., Black, Navy Blue')}
                value={formData.color || ''}
                onChange={(e) => onChange('color', e.target.value)}
                className={inputClass}
              />
            </div>

            {/* Season */}
            <div className="space-y-2">
              <Label htmlFor="season">{tr('catalog.fashion.season', 'Season')}</Label>
              <Select
                value={formData.season || ''}
                onValueChange={(val) => onChange('season', val)}
              >
                <SelectTrigger id="season" className={inputClass}>
                  <SelectValue placeholder={tr('catalog.fashion.select_season', 'Select season...')} />
                </SelectTrigger>
                <SelectContent>
                  {seasonOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pattern */}
            <div className="space-y-2">
              <Label htmlFor="pattern">{tr('catalog.fashion.pattern', 'Pattern')}</Label>
              <Select
                value={formData.pattern || ''}
                onValueChange={(val) => onChange('pattern', val)}
              >
                <SelectTrigger id="pattern" className={inputClass}>
                  <SelectValue placeholder={tr('catalog.fashion.select_pattern', 'Select pattern...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">{tr('catalog.fashion.pattern_solid', 'Solid')}</SelectItem>
                  <SelectItem value="striped">{tr('catalog.fashion.pattern_striped', 'Striped')}</SelectItem>
                  <SelectItem value="checked">{tr('catalog.fashion.pattern_checked', 'Checked/Plaid')}</SelectItem>
                  <SelectItem value="floral">{tr('catalog.fashion.pattern_floral', 'Floral')}</SelectItem>
                  <SelectItem value="printed">{tr('catalog.fashion.pattern_printed', 'Printed/Graphic')}</SelectItem>
                  <SelectItem value="other">{tr('catalog.fashion.pattern_other', 'Other')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Care & Tags */}
      <Card className={cardClass}>
        <CardHeader>
          <CardTitle className="font-extrabold tracking-tight">{tr('catalog.fashion.care', 'Care & Condition')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="care_instructions">{tr('catalog.fashion.care_instructions', 'Care Instructions')}</Label>
              <Input
                id="care_instructions"
                type="text"
                maxLength={200}
                placeholder={tr('catalog.fashion.care_placeholder', 'e.g., Machine wash at 30°C, do not tumble dry')}
                value={formData.care_instructions || ''}
                onChange={(e) => onChange('care_instructions', e.target.value)}
                className={inputClass}
              />
              <p className="text-sm text-muted-foreground">{tr('catalog.fashion.care_help', 'Copy from garment care label')}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="original_tags"
                  checked={formData.original_tags === true}
                  onCheckedChange={(checked) => onChange('original_tags', checked)}
                />
                <Label htmlFor="original_tags" className="cursor-pointer">
                  {tr('catalog.fashion.original_tags', 'Original Tags Attached')}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="never_worn"
                  checked={formData.never_worn === true}
                  onCheckedChange={(checked) => onChange('never_worn', checked)}
                />
                <Label htmlFor="never_worn" className="cursor-pointer">
                  {tr('catalog.fashion.never_worn', 'Never Worn (New without Tags)')}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="authentic_guaranteed"
                  checked={formData.authentic_guaranteed === true}
                  onCheckedChange={(checked) => onChange('authentic_guaranteed', checked)}
                />
                <Label htmlFor="authentic_guaranteed" className="cursor-pointer">
                  {tr('catalog.fashion.authentic_guaranteed', 'Authenticity Guaranteed')}
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defects">{tr('catalog.fashion.defects', 'Known Defects or Wear')}</Label>
              <Input
                id="defects"
                type="text"
                maxLength={300}
                placeholder={tr('catalog.fashion.defects_placeholder', 'e.g., Small stain on left sleeve, minor pilling')}
                value={formData.defects || ''}
                onChange={(e) => onChange('defects', e.target.value)}
                className={inputClass}
              />
              <p className="text-sm text-muted-foreground">{tr('catalog.fashion.defects_help', 'Honesty builds trust with buyers')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




