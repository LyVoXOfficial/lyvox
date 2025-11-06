"use client";

import { useI18n } from "@/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FashionItem } from "@/lib/types/catalog";

interface FashionFieldsProps {
  formData: Partial<FashionItem>;
  onChange: (field: keyof FashionItem, value: any) => void;
  locale?: string;
}

export function FashionFields({
  formData,
  onChange,
  locale = "en",
}: FashionFieldsProps) {
  const { t } = useI18n();

  // Gender & Age Group options
  const genderOptions = [
    { value: 'women', label: 'Women' },
    { value: 'men', label: 'Men' },
    { value: 'unisex', label: 'Unisex' },
  ];

  const ageGroupOptions = [
    { value: 'adult', label: 'Adult' },
    { value: 'kids', label: 'Kids (3-12)' },
    { value: 'baby', label: 'Baby (0-2)' },
  ];

  // Item type options
  const itemTypeOptions = [
    { value: 'tops', label: 'Tops / Shirts' },
    { value: 'bottoms', label: 'Bottoms / Pants' },
    { value: 'dresses', label: 'Dresses' },
    { value: 'outerwear', label: 'Outerwear / Jackets' },
    { value: 'shoes', label: 'Shoes' },
    { value: 'accessories', label: 'Accessories' },
    { value: 'underwear', label: 'Underwear' },
    { value: 'sportswear', label: 'Sportswear' },
  ];

  // EU Size mappings
  const euSizesClothing = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const euSizesNumeric = Array.from({ length: 25 }, (_, i) => (32 + i * 2).toString()); // 32-80

  const shoeSizesEU = Array.from({ length: 30 }, (_, i) => (i + 19).toString()); // 19-48

  // Material options
  const materialOptions = [
    'Cotton',
    'Polyester',
    'Wool',
    'Leather',
    'Denim',
    'Silk',
    'Linen',
    'Synthetic',
    'Mixed',
  ];

  // Season options
  const seasonOptions = [
    { value: 'spring_summer', label: 'Spring/Summer' },
    { value: 'fall_winter', label: 'Fall/Winter' },
    { value: 'all_season', label: 'All Season' },
  ];

  const isShoes = formData.item_type === 'shoes';
  const isAccessory = formData.item_type === 'accessories';

  return (
    <div className="space-y-8">
      {/* Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Item Type */}
            <div className="space-y-2">
              <Label htmlFor="item_type">
                Item Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.item_type || ''}
                onValueChange={(val) => onChange('item_type', val)}
              >
                <SelectTrigger id="item_type">
                  <SelectValue placeholder="Select type..." />
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
                Gender <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.gender || ''}
                onValueChange={(val) => onChange('gender', val)}
              >
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Select gender..." />
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
              <Label htmlFor="age_group">Age Group</Label>
              <Select
                value={formData.age_group || ''}
                onValueChange={(val) => onChange('age_group', val)}
              >
                <SelectTrigger id="age_group">
                  <SelectValue placeholder="Select..." />
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
              <Label htmlFor="brand">Brand</Label>
              <Input
                id="brand"
                type="text"
                maxLength={100}
                placeholder="e.g., Nike, Zara, H&M"
                value={formData.brand || ''}
                onChange={(e) => onChange('brand', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Size Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Size</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {isShoes ? (
              // Shoe sizes
              <>
                <div className="space-y-2">
                  <Label htmlFor="size_eu">
                    EU Size <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={formData.size_eu || ''}
                    onValueChange={(val) => onChange('size_eu', val)}
                  >
                    <SelectTrigger id="size_eu">
                      <SelectValue placeholder="Select EU size..." />
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
                  <Label htmlFor="size_uk">UK Size</Label>
                  <Input
                    id="size_uk"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 8.5"
                    value={formData.size_uk || ''}
                    onChange={(e) => onChange('size_uk', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size_us">US Size</Label>
                  <Input
                    id="size_us"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 9"
                    value={formData.size_us || ''}
                    onChange={(e) => onChange('size_us', e.target.value)}
                  />
                </div>
              </>
            ) : !isAccessory ? (
              // Clothing sizes
              <>
                <div className="space-y-2">
                  <Label htmlFor="size_eu">
                    Size (EU) <span className="text-red-500">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Select
                      value={formData.size_eu || ''}
                      onValueChange={(val) => onChange('size_eu', val)}
                    >
                      <SelectTrigger id="size_eu" className="flex-1">
                        <SelectValue placeholder="Select size..." />
                      </SelectTrigger>
                      <SelectContent>
                        <div className="p-2 font-semibold border-b">Letter Sizes</div>
                        {euSizesClothing.map((size) => (
                          <SelectItem key={size} value={size}>
                            {size}
                          </SelectItem>
                        ))}
                        <div className="p-2 font-semibold border-b">Numeric Sizes</div>
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
                  <Label htmlFor="size_uk">UK Size</Label>
                  <Input
                    id="size_uk"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 10, M"
                    value={formData.size_uk || ''}
                    onChange={(e) => onChange('size_uk', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="size_us">US Size</Label>
                  <Input
                    id="size_us"
                    type="text"
                    maxLength={10}
                    placeholder="e.g., 6, M"
                    value={formData.size_us || ''}
                    onChange={(e) => onChange('size_us', e.target.value)}
                  />
                </div>
              </>
            ) : null}

            {/* Measurements (for non-accessories) */}
            {!isAccessory && (
              <div className="md:col-span-2">
                <Label>Measurements (cm) - Optional but recommended</Label>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                  <div className="space-y-1">
                    <Label htmlFor="measurement_chest" className="text-sm text-muted-foreground">
                      Chest/Bust
                    </Label>
                    <Input
                      id="measurement_chest"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_chest ?? ''}
                      onChange={(e) => onChange('measurement_chest', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="measurement_waist" className="text-sm text-muted-foreground">
                      Waist
                    </Label>
                    <Input
                      id="measurement_waist"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_waist ?? ''}
                      onChange={(e) => onChange('measurement_waist', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="measurement_hips" className="text-sm text-muted-foreground">
                      Hips
                    </Label>
                    <Input
                      id="measurement_hips"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_hips ?? ''}
                      onChange={(e) => onChange('measurement_hips', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="measurement_length" className="text-sm text-muted-foreground">
                      Length
                    </Label>
                    <Input
                      id="measurement_length"
                      type="number"
                      min={0}
                      max={200}
                      placeholder="cm"
                      value={formData.measurement_length ?? ''}
                      onChange={(e) => onChange('measurement_length', e.target.value ? parseFloat(e.target.value) : null)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Material & Style */}
      <Card>
        <CardHeader>
          <CardTitle>Material & Style</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Material */}
            <div className="space-y-2">
              <Label htmlFor="material">Material</Label>
              <Select
                value={formData.material || ''}
                onValueChange={(val) => onChange('material', val)}
              >
                <SelectTrigger id="material">
                  <SelectValue placeholder="Select material..." />
                </SelectTrigger>
                <SelectContent>
                  {materialOptions.map((material) => (
                    <SelectItem key={material} value={material.toLowerCase()}>
                      {material}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Color */}
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="text"
                maxLength={50}
                placeholder="e.g., Black, Navy Blue"
                value={formData.color || ''}
                onChange={(e) => onChange('color', e.target.value)}
              />
            </div>

            {/* Season */}
            <div className="space-y-2">
              <Label htmlFor="season">Season</Label>
              <Select
                value={formData.season || ''}
                onValueChange={(val) => onChange('season', val)}
              >
                <SelectTrigger id="season">
                  <SelectValue placeholder="Select season..." />
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
              <Label htmlFor="pattern">Pattern</Label>
              <Select
                value={formData.pattern || ''}
                onValueChange={(val) => onChange('pattern', val)}
              >
                <SelectTrigger id="pattern">
                  <SelectValue placeholder="Select pattern..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="striped">Striped</SelectItem>
                  <SelectItem value="checked">Checked/Plaid</SelectItem>
                  <SelectItem value="floral">Floral</SelectItem>
                  <SelectItem value="printed">Printed/Graphic</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Care & Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Care & Condition</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-6">
            <div className="space-y-2">
              <Label htmlFor="care_instructions">Care Instructions</Label>
              <Input
                id="care_instructions"
                type="text"
                maxLength={200}
                placeholder="e.g., Machine wash at 30°C, do not tumble dry"
                value={formData.care_instructions || ''}
                onChange={(e) => onChange('care_instructions', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Copy from garment care label</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="original_tags"
                  checked={formData.original_tags === true}
                  onCheckedChange={(checked) => onChange('original_tags', checked)}
                />
                <Label htmlFor="original_tags" className="cursor-pointer">
                  Original Tags Attached
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="never_worn"
                  checked={formData.never_worn === true}
                  onCheckedChange={(checked) => onChange('never_worn', checked)}
                />
                <Label htmlFor="never_worn" className="cursor-pointer">
                  Never Worn (New without Tags)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="authentic_guaranteed"
                  checked={formData.authentic_guaranteed === true}
                  onCheckedChange={(checked) => onChange('authentic_guaranteed', checked)}
                />
                <Label htmlFor="authentic_guaranteed" className="cursor-pointer">
                  Authenticity Guaranteed
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="defects">Known Defects or Wear</Label>
              <Input
                id="defects"
                type="text"
                maxLength={300}
                placeholder="e.g., Small stain on left sleeve, minor pilling"
                value={formData.defects || ''}
                onChange={(e) => onChange('defects', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">Honesty builds trust with buyers</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


