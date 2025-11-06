"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PropertyListing } from "@/lib/types/catalog";
import { apiFetch } from "@/lib/fetcher";

interface RealEstateFieldsProps {
  formData: Partial<PropertyListing>;
  onChange: (field: keyof PropertyListing, value: any) => void;
  locale?: string;
}

export function RealEstateFields({
  formData,
  onChange,
  locale = "en",
}: RealEstateFieldsProps) {
  const { t } = useI18n();
  
  // Reference data
  const [propertyTypes, setPropertyTypes] = useState<any[]>([]);
  const [epcRatings, setEpcRatings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [typesRes, epcRes] = await Promise.all([
          apiFetch(`/api/catalog/property-types?lang=${locale}`),
          apiFetch(`/api/catalog/epc-ratings?lang=${locale}`),
        ]);
        
        if (typesRes.ok) {
          setPropertyTypes(await typesRes.json());
        }
        if (epcRes.ok) {
          setEpcRatings(await epcRes.json());
        }
      } catch (error) {
        console.error("Failed to load real estate data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [locale]);

  const isRental = formData.listing_type === 'rent';

  return (
    <div className="space-y-8">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Property Type */}
            <div className="space-y-2">
              <Label htmlFor="property_type_id">
                Property Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.property_type_id || ''}
                onValueChange={(val) => onChange('property_type_id', val)}
              >
                <SelectTrigger id="property_type_id">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {propertyTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Listing Type */}
            <div className="space-y-2">
              <Label htmlFor="listing_type">
                Listing Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.listing_type || ''}
                onValueChange={(val) => onChange('listing_type', val as 'sale' | 'rent')}
              >
                <SelectTrigger id="listing_type">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">For Sale</SelectItem>
                  <SelectItem value="rent">For Rent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle>Dimensions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="area_sqm">
                Living Area (m²) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="area_sqm"
                type="number"
                min={1}
                max={10000}
                step={0.1}
                value={formData.area_sqm ?? ''}
                onChange={(e) => onChange('area_sqm', e.target.value ? parseFloat(e.target.value) : null)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="rooms">Total Rooms</Label>
              <Input
                id="rooms"
                type="number"
                min={0}
                max={20}
                value={formData.rooms ?? ''}
                onChange={(e) => onChange('rooms', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                min={0}
                max={15}
                value={formData.bedrooms ?? ''}
                onChange={(e) => onChange('bedrooms', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                min={0}
                max={10}
                step={0.5}
                value={formData.bathrooms ?? ''}
                onChange={(e) => onChange('bathrooms', e.target.value ? parseFloat(e.target.value) : null)}
              />
              <p className="text-sm text-muted-foreground">Use 0.5 for half bathrooms</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="land_area_sqm">Land Area (m²)</Label>
              <Input
                id="land_area_sqm"
                type="number"
                min={0}
                step={0.1}
                value={formData.land_area_sqm ?? ''}
                onChange={(e) => onChange('land_area_sqm', e.target.value ? parseFloat(e.target.value) : null)}
              />
              <p className="text-sm text-muted-foreground">For houses and land</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Energy Performance (Belgium EPC) */}
      <Card>
        <CardHeader>
          <CardTitle>Energy Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="epc_rating">EPC Rating</Label>
              <Select
                value={formData.epc_rating || ''}
                onValueChange={(val) => onChange('epc_rating', val)}
              >
                <SelectTrigger id="epc_rating">
                  <SelectValue placeholder="Select rating..." />
                </SelectTrigger>
                <SelectContent>
                  {epcRatings.map((rating) => (
                    <SelectItem key={rating.code} value={rating.code}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-4 h-4 rounded" 
                          style={{ backgroundColor: rating.color }}
                        />
                        {rating.name} ({rating.max_kwh_per_sqm_year ? `≤${rating.max_kwh_per_sqm_year}` : 'No limit'} kWh/m²/year)
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="epc_cert_number">EPC Certificate Number</Label>
              <Input
                id="epc_cert_number"
                type="text"
                placeholder="YYYYMMDD-NNNNNNN-NN"
                pattern="^[0-9]{8}-[0-9]{7}-[0-9]{2}$"
                value={formData.epc_cert_number || ''}
                onChange={(e) => onChange('epc_cert_number', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="epc_kwh_per_sqm_year">Energy Consumption (kWh/m²/year)</Label>
              <Input
                id="epc_kwh_per_sqm_year"
                type="number"
                min={0}
                value={formData.epc_kwh_per_sqm_year ?? ''}
                onChange={(e) => onChange('epc_kwh_per_sqm_year', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="double_glazing"
                checked={formData.double_glazing === true}
                onCheckedChange={(checked) => onChange('double_glazing', checked)}
              />
              <Label htmlFor="double_glazing" className="cursor-pointer">
                Double Glazing
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rental-Specific Fields */}
      {isRental && (
        <Card>
          <CardHeader>
            <CardTitle>Rental Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="rent_monthly">
                  Monthly Rent (€) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="rent_monthly"
                  type="number"
                  min={0}
                  value={formData.rent_monthly ?? ''}
                  onChange={(e) => onChange('rent_monthly', e.target.value ? parseFloat(e.target.value) : null)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rent_charges_monthly">Monthly Charges (€)</Label>
                <Input
                  id="rent_charges_monthly"
                  type="number"
                  min={0}
                  value={formData.rent_charges_monthly ?? ''}
                  onChange={(e) => onChange('rent_charges_monthly', e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="deposit_months">Security Deposit (months)</Label>
                <Input
                  id="deposit_months"
                  type="number"
                  min={0}
                  max={3}
                  step={0.5}
                  value={formData.deposit_months ?? ''}
                  onChange={(e) => onChange('deposit_months', e.target.value ? parseFloat(e.target.value) : null)}
                />
                <p className="text-sm text-muted-foreground">Maximum 3 months (Belgium law)</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="available_from">Available From</Label>
                <Input
                  id="available_from"
                  type="date"
                  value={formData.available_from || ''}
                  onChange={(e) => onChange('available_from', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="furnished">Furnished Status</Label>
                <Select
                  value={formData.furnished || ''}
                  onValueChange={(val) => onChange('furnished', val)}
                >
                  <SelectTrigger id="furnished">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unfurnished">Unfurnished</SelectItem>
                    <SelectItem value="semi_furnished">Semi-Furnished</SelectItem>
                    <SelectItem value="fully_furnished">Fully Furnished</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Location */}
      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="postcode">
                Postcode <span className="text-red-500">*</span>
              </Label>
              <Input
                id="postcode"
                type="text"
                pattern="^[1-9][0-9]{3}$"
                placeholder="1000"
                maxLength={4}
                value={formData.postcode || ''}
                onChange={(e) => onChange('postcode', e.target.value)}
                required
              />
              <p className="text-sm text-muted-foreground">4-digit Belgian postcode</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="municipality">
                Municipality <span className="text-red-500">*</span>
              </Label>
              <Input
                id="municipality"
                type="text"
                maxLength={100}
                value={formData.municipality || ''}
                onChange={(e) => onChange('municipality', e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="neighborhood">Neighborhood</Label>
              <Input
                id="neighborhood"
                type="text"
                maxLength={100}
                value={formData.neighborhood || ''}
                onChange={(e) => onChange('neighborhood', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Features */}
      <Card>
        <CardHeader>
          <CardTitle>Features</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="parking_spaces">Parking Spaces</Label>
              <Input
                id="parking_spaces"
                type="number"
                min={0}
                max={10}
                value={formData.parking_spaces ?? 0}
                onChange={(e) => onChange('parking_spaces', e.target.value ? parseInt(e.target.value) : 0)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="terrace_sqm">Terrace Area (m²)</Label>
              <Input
                id="terrace_sqm"
                type="number"
                min={0}
                step={0.1}
                value={formData.terrace_sqm ?? ''}
                onChange={(e) => onChange('terrace_sqm', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="garden_sqm">Garden Area (m²)</Label>
              <Input
                id="garden_sqm"
                type="number"
                min={0}
                step={0.1}
                value={formData.garden_sqm ?? ''}
                onChange={(e) => onChange('garden_sqm', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="elevator"
                  checked={formData.elevator === true}
                  onCheckedChange={(checked) => onChange('elevator', checked)}
                />
                <Label htmlFor="elevator" className="cursor-pointer">Elevator</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cellar"
                  checked={formData.cellar === true}
                  onCheckedChange={(checked) => onChange('cellar', checked)}
                />
                <Label htmlFor="cellar" className="cursor-pointer">Cellar/Storage</Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="pet_friendly"
                  checked={formData.pet_friendly === true}
                  onCheckedChange={(checked) => onChange('pet_friendly', checked)}
                />
                <Label htmlFor="pet_friendly" className="cursor-pointer">Pet Friendly</Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


