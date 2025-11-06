"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ElectronicsItem } from "@/lib/types/catalog";
import { apiFetch } from "@/lib/fetcher";

interface ElectronicsFieldsProps {
  formData: Partial<ElectronicsItem>;
  onChange: (field: keyof ElectronicsItem, value: any) => void;
  locale?: string;
}

export function ElectronicsFields({
  formData,
  onChange,
  locale = "en",
}: ElectronicsFieldsProps) {
  const { t } = useI18n();
  
  // Reference data
  const [brands, setBrands] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [isLoadingBrands, setIsLoadingBrands] = useState(true);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  // Load brands
  useEffect(() => {
    const loadBrands = async () => {
      try {
        const res = await apiFetch(`/api/catalog/device-brands?lang=${locale}`);
        if (res.ok) {
          setBrands(await res.json());
        }
      } catch (error) {
        console.error("Failed to load brands:", error);
      } finally {
        setIsLoadingBrands(false);
      }
    };
    loadBrands();
  }, [locale]);

  // Load models when brand changes
  useEffect(() => {
    if (!formData.brand_id) {
      setModels([]);
      return;
    }

    const loadModels = async () => {
      setIsLoadingModels(true);
      try {
        const res = await apiFetch(
          `/api/catalog/device-models?brand_id=${formData.brand_id}&lang=${locale}`
        );
        if (res.ok) {
          setModels(await res.json());
        }
      } catch (error) {
        console.error("Failed to load models:", error);
      } finally {
        setIsLoadingModels(false);
      }
    };
    loadModels();
  }, [formData.brand_id, locale]);

  // Device types based on electronics subcategory
  const deviceTypes = [
    { value: 'smartphone', label: 'Smartphone' },
    { value: 'tablet', label: 'Tablet' },
    { value: 'laptop', label: 'Laptop' },
    { value: 'desktop', label: 'Desktop PC' },
    { value: 'monitor', label: 'Monitor' },
    { value: 'tv', label: 'TV' },
    { value: 'camera', label: 'Camera' },
    { value: 'lens', label: 'Lens' },
    { value: 'audio', label: 'Audio Equipment' },
    { value: 'smartwatch', label: 'Smartwatch' },
    { value: 'console', label: 'Gaming Console' },
    { value: 'appliance', label: 'Home Appliance' },
    { value: 'other', label: 'Other' },
  ];

  const isMobileDevice = ['smartphone', 'tablet'].includes(formData.device_type || '');
  const isComputer = ['laptop', 'desktop'].includes(formData.device_type || '');
  const isDisplay = ['monitor', 'tv'].includes(formData.device_type || '');

  return (
    <div className="space-y-8">
      {/* Basic Device Info */}
      <Card>
        <CardHeader>
          <CardTitle>Device Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Device Type */}
            <div className="space-y-2">
              <Label htmlFor="device_type">
                Device Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.device_type || ''}
                onValueChange={(val) => onChange('device_type', val)}
              >
                <SelectTrigger id="device_type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {deviceTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Brand */}
            <div className="space-y-2">
              <Label htmlFor="brand_id">
                Brand <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.brand_id || ''}
                onValueChange={(val) => {
                  onChange('brand_id', val);
                  onChange('model_id', null); // Reset model when brand changes
                }}
                disabled={isLoadingBrands}
              >
                <SelectTrigger id="brand_id">
                  <SelectValue placeholder="Select brand..." />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((brand) => (
                    <SelectItem key={brand.id} value={brand.id}>
                      {brand.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            {formData.brand_id && (
              <div className="space-y-2">
                <Label htmlFor="model_id">Model</Label>
                <Select
                  value={formData.model_id || ''}
                  onValueChange={(val) => onChange('model_id', val)}
                  disabled={isLoadingModels || models.length === 0}
                >
                  <SelectTrigger id="model_id">
                    <SelectValue placeholder={isLoadingModels ? "Loading..." : "Select model..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!isLoadingModels && models.length === 0 && (
                  <p className="text-sm text-muted-foreground">No models available for this brand</p>
                )}
              </div>
            )}

            {/* Year */}
            <div className="space-y-2">
              <Label htmlFor="year_manufactured">Year</Label>
              <Input
                id="year_manufactured"
                type="number"
                min={1990}
                max={new Date().getFullYear() + 1}
                value={formData.year_manufactured ?? ''}
                onChange={(e) => onChange('year_manufactured', e.target.value ? parseInt(e.target.value) : null)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile-Specific Fields */}
      {isMobileDevice && (
        <Card>
          <CardHeader>
            <CardTitle>Mobile Device Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="storage_gb">Storage (GB)</Label>
                <Select
                  value={formData.storage_gb?.toString() || ''}
                  onValueChange={(val) => onChange('storage_gb', parseInt(val))}
                >
                  <SelectTrigger id="storage_gb">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[16, 32, 64, 128, 256, 512, 1024].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} GB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="memory_ram_gb">RAM (GB)</Label>
                <Select
                  value={formData.memory_ram_gb?.toString() || ''}
                  onValueChange={(val) => onChange('memory_ram_gb', parseInt(val))}
                >
                  <SelectTrigger id="memory_ram_gb">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 6, 8, 12, 16].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} GB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="battery_health">Battery Health (%)</Label>
                <Input
                  id="battery_health"
                  type="number"
                  min={0}
                  max={100}
                  value={formData.battery_health ?? ''}
                  onChange={(e) => onChange('battery_health', e.target.value ? parseInt(e.target.value) : null)}
                />
                <p className="text-sm text-muted-foreground">Check in Settings → Battery</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Input
                  id="color"
                  type="text"
                  maxLength={50}
                  value={formData.color || ''}
                  onChange={(e) => onChange('color', e.target.value)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="factory_unlocked"
                  checked={formData.factory_unlocked === true}
                  onCheckedChange={(checked) => onChange('factory_unlocked', checked)}
                />
                <Label htmlFor="factory_unlocked" className="cursor-pointer">
                  Factory Unlocked (No SIM Lock)
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Computer-Specific Fields */}
      {isComputer && (
        <Card>
          <CardHeader>
            <CardTitle>Computer Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="processor">Processor</Label>
                <Input
                  id="processor"
                  type="text"
                  placeholder="e.g., Intel Core i7-12700K"
                  maxLength={100}
                  value={formData.processor || ''}
                  onChange={(e) => onChange('processor', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="memory_ram_gb">RAM (GB)</Label>
                <Select
                  value={formData.memory_ram_gb?.toString() || ''}
                  onValueChange={(val) => onChange('memory_ram_gb', parseInt(val))}
                >
                  <SelectTrigger id="memory_ram_gb">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[4, 8, 16, 32, 64, 128].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size} GB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storage_type">Storage Type</Label>
                <Select
                  value={formData.storage_type || ''}
                  onValueChange={(val) => onChange('storage_type', val)}
                >
                  <SelectTrigger id="storage_type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hdd">HDD</SelectItem>
                    <SelectItem value="ssd">SSD</SelectItem>
                    <SelectItem value="nvme">NVMe SSD</SelectItem>
                    <SelectItem value="hybrid">Hybrid (HDD + SSD)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="storage_gb">Storage Capacity (GB)</Label>
                <Select
                  value={formData.storage_gb?.toString() || ''}
                  onValueChange={(val) => onChange('storage_gb', parseInt(val))}
                >
                  <SelectTrigger id="storage_gb">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[128, 256, 512, 1024, 2048, 4096].map((size) => (
                      <SelectItem key={size} value={size.toString()}>
                        {size >= 1024 ? `${size / 1024} TB` : `${size} GB`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="graphics_card">Graphics Card</Label>
                <Input
                  id="graphics_card"
                  type="text"
                  placeholder="e.g., NVIDIA RTX 4080"
                  maxLength={100}
                  value={formData.graphics_card || ''}
                  onChange={(e) => onChange('graphics_card', e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="operating_system">Operating System</Label>
                <Select
                  value={formData.operating_system || ''}
                  onValueChange={(val) => onChange('operating_system', val)}
                >
                  <SelectTrigger id="operating_system">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="windows_11">Windows 11</SelectItem>
                    <SelectItem value="windows_10">Windows 10</SelectItem>
                    <SelectItem value="macos">macOS</SelectItem>
                    <SelectItem value="linux">Linux</SelectItem>
                    <SelectItem value="chrome_os">Chrome OS</SelectItem>
                    <SelectItem value="none">None / DOS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Display-Specific Fields */}
      {isDisplay && (
        <Card>
          <CardHeader>
            <CardTitle>Display Specifications</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="screen_size_inches">Screen Size (inches)</Label>
                <Input
                  id="screen_size_inches"
                  type="number"
                  min={10}
                  max={120}
                  step={0.1}
                  value={formData.screen_size_inches ?? ''}
                  onChange={(e) => onChange('screen_size_inches', e.target.value ? parseFloat(e.target.value) : null)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resolution">Resolution</Label>
                <Select
                  value={formData.resolution || ''}
                  onValueChange={(val) => onChange('resolution', val)}
                >
                  <SelectTrigger id="resolution">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hd">HD (1366x768)</SelectItem>
                    <SelectItem value="full_hd">Full HD (1920x1080)</SelectItem>
                    <SelectItem value="2k">2K (2560x1440)</SelectItem>
                    <SelectItem value="4k">4K UHD (3840x2160)</SelectItem>
                    <SelectItem value="8k">8K (7680x4320)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="panel_type">Panel Type</Label>
                <Select
                  value={formData.panel_type || ''}
                  onValueChange={(val) => onChange('panel_type', val)}
                >
                  <SelectTrigger id="panel_type">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="lcd">LCD</SelectItem>
                    <SelectItem value="led">LED</SelectItem>
                    <SelectItem value="oled">OLED</SelectItem>
                    <SelectItem value="qled">QLED</SelectItem>
                    <SelectItem value="ips">IPS</SelectItem>
                    <SelectItem value="va">VA</SelectItem>
                    <SelectItem value="tn">TN</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="refresh_rate_hz">Refresh Rate (Hz)</Label>
                <Select
                  value={formData.refresh_rate_hz?.toString() || ''}
                  onValueChange={(val) => onChange('refresh_rate_hz', parseInt(val))}
                >
                  <SelectTrigger id="refresh_rate_hz">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {[50, 60, 75, 120, 144, 165, 240, 360].map((rate) => (
                      <SelectItem key={rate} value={rate.toString()}>
                        {rate} Hz
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="smart_tv"
                  checked={formData.smart_tv === true}
                  onCheckedChange={(checked) => onChange('smart_tv', checked)}
                />
                <Label htmlFor="smart_tv" className="cursor-pointer">
                  Smart TV
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* General Condition & Warranty */}
      <Card>
        <CardHeader>
          <CardTitle>Condition & Warranty</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="original_box"
                  checked={formData.original_box === true}
                  onCheckedChange={(checked) => onChange('original_box', checked)}
                />
                <Label htmlFor="original_box" className="cursor-pointer">
                  Original Box Included
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="warranty_remaining"
                  checked={formData.warranty_remaining === true}
                  onCheckedChange={(checked) => onChange('warranty_remaining', checked)}
                />
                <Label htmlFor="warranty_remaining" className="cursor-pointer">
                  Warranty Remaining
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="original_accessories"
                  checked={formData.original_accessories === true}
                  onCheckedChange={(checked) => onChange('original_accessories', checked)}
                />
                <Label htmlFor="original_accessories" className="cursor-pointer">
                  Original Accessories Included
                </Label>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accessories_included">Accessories Included</Label>
              <Input
                id="accessories_included"
                type="text"
                placeholder="e.g., Charger, cable, case"
                maxLength={200}
                value={formData.accessories_included || ''}
                onChange={(e) => onChange('accessories_included', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">List all included accessories</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


