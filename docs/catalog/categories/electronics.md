# Electronics & Appliances (Elektronika)

> **Category**: Electronics  
> **Database Strategy**: JSONB + Dictionaries (Tier 2)  
> **Priority**: High  
> **Last Updated**: 2025-11-05

## Overview

Electronics marketplace covering phones, computers, cameras, TVs, audio equipment, and home appliances. Uses JSONB storage with shared dictionary tables for brands and models to enable autocomplete while maintaining flexibility.

### Subcategories

```
Electronics/
├── Phones & Tablets
│   ├── Mobile Phones
│   ├── Tablets
│   ├── Smart Watches & Bands
│   ├── Headphones & Earbuds
│   └── Accessories
├── Computers & Office
│   ├── Laptops
│   ├── Desktop Computers
│   ├── Components (CPU, GPU, RAM, Storage)
│   ├── Gaming Consoles
│   ├── Printers & Scanners
│   ├── Network Equipment
│   └── Software
├── Photo & Video
│   ├── Cameras (DSLR, Mirrorless, Compact)
│   ├── Video Cameras & Camcorders
│   ├── Lenses & Accessories
│   └── Action Cameras
├── TV, Audio & Video
│   ├── Televisions
│   ├── Audio Systems & Speakers
│   ├── Headphones
│   └── Media Players
└── Home Appliances
    ├── Kitchen Appliances
    ├── Cleaning (Vacuum, etc.)
    ├── Climate Control (AC, Heaters)
    └── Personal Care (Hair dryer, etc.)
```

## Fields (JSONB in ad_item_specifics.specifics)

### Common Electronics Fields

```json
{
  "category_type": "phone" | "laptop" | "camera" | "tv" | "appliance",
  
  // Brand & Model (with dictionary references)
  "brand_id": "uuid",
  "brand": "Apple", // Denormalized
  "model_id": "uuid", // Optional
  "model": "iPhone 13 Pro",
  
  // Basic Info
  "device_type": "smartphone" | "tablet" | "laptop" | "desktop" | "camera" | "tv",
  "year": 2021,
  "color": "graphite",
  
  // Condition
  "condition_grade": "new" | "like_new" | "excellent" | "good" | "fair" | "for_parts",
  "condition_details": "Minor scratches on back, screen perfect",
  
  // Warranty & Documentation
  "warranty": true,
  "warranty_until": "2025-12-31",
  "warranty_type": "manufacturer" | "store" | "extended",
  "original_box": true,
  "original_receipt": true,
  "manuals": true,
  
  // Accessories
  "accessories_included": ["charger", "cable", "earphones", "case"],
  
  // Purchase Info
  "original_price": 1199,
  "purchase_date": "2021-09-24",
  "purchase_location": "Apple Store Brussels"
}
```

### Phone-Specific Fields

```json
{
  "category_type": "phone",
  
  // Display
  "screen_size": "6.1 inch",
  "screen_type": "OLED" | "AMOLED" | "LCD" | "IPS",
  "resolution": "2532x1170",
  
  // Performance
  "processor": "A15 Bionic",
  "memory_ram": "6GB",
  "storage": "256GB",
  "storage_expandable": false,
  
  // Battery
  "battery_capacity": "3095 mAh",
  "battery_health": "95%", // iOS battery health metric
  "fast_charging": true,
  "wireless_charging": true,
  
  // Camera
  "rear_camera": "12MP + 12MP + 12MP (Triple)",
  "front_camera": "12MP",
  "camera_features": ["night_mode", "portrait", "4k_video"],
  
  // Connectivity
  "network": "5G",
  "sim_type": "nano-SIM + eSIM",
  "dual_sim": true,
  
  // Security & Locks
  "imei": "HIDDEN_UNTIL_CONTACT", // Masked in listings
  "serial_number": "HIDDEN_UNTIL_CONTACT",
  "factory_unlocked": true,
  "carrier": null, // or "Proximus", "Orange", "Base"
  "carrier_locked": false,
  "icloud_status": "clean", // "clean" | "locked" | "unknown"
  "google_lock": false, // For Android
  "activation_lock": false,
  
  // Condition Details
  "screen_condition": "perfect" | "minor_scratches" | "cracked",
  "body_condition": "excellent" | "good" | "fair" | "poor",
  "buttons_functional": true,
  "cameras_functional": true,
  "speakers_functional": true,
  "microphone_functional": true,
  "charging_port_functional": true,
  
  // Defects
  "known_issues": [],
  "repairs_done": [],
  
  // OS
  "os": "iOS 17.1",
  "os_updates_available": true
}
```

### Laptop/Computer Fields

```json
{
  "category_type": "laptop" | "desktop",
  
  // Display (laptops)
  "screen_size": "13.3 inch",
  "screen_resolution": "2560x1600",
  "touchscreen": false,
  
  // Performance
  "processor": "Apple M1" | "Intel Core i7-1185G7" | "AMD Ryzen 7 5800X",
  "processor_generation": "11th Gen",
  "processor_speed": "3.0 GHz",
  "cores": 8,
  
  "memory_ram": "16GB",
  "ram_type": "DDR4" | "DDR5" | "LPDDR4X",
  "ram_upgradeable": false,
  
  "storage_type": "SSD" | "HDD" | "SSD + HDD",
  "storage": "512GB",
  "storage_upgradeable": true,
  
  // Graphics
  "graphics": "Integrated" | "Dedicated",
  "gpu": "Apple M1 GPU" | "NVIDIA RTX 3060" | "AMD Radeon RX 6700 XT",
  "gpu_memory": "8GB",
  
  // Ports & Connectivity
  "ports": ["USB-C", "Thunderbolt 4", "HDMI", "3.5mm jack"],
  "wifi": "WiFi 6",
  "bluetooth": "5.0",
  "ethernet": true,
  
  // Battery (laptops)
  "battery_life": "Up to 18 hours",
  "battery_health": "90%",
  
  // OS
  "operating_system": "macOS Ventura" | "Windows 11 Pro" | "Ubuntu 22.04",
  "os_license": "genuine" | "oem" | "volume",
  
  // Gaming (if applicable)
  "gaming_capable": true,
  "rgb_lighting": true,
  "cooling": "liquid" | "air",
  
  // Use Case
  "usage": ["office", "gaming", "creative_work", "programming"],
  
  // Condition
  "keyboard_condition": "excellent",
  "trackpad_condition": "excellent",
  "hinges_condition": "good",
  "cosmetic_damage": ["minor_scratch_on_lid"]
}
```

### Camera Fields

```json
{
  "category_type": "camera",
  
  // Type
  "camera_type": "DSLR" | "Mirrorless" | "Compact" | "Action" | "Film",
  
  // Sensor
  "sensor_type": "Full Frame" | "APS-C" | "Micro Four Thirds" | "1 inch",
  "sensor_resolution": "24.2MP",
  
  // Body
  "mount": "Canon EF" | "Nikon F" | "Sony E" | "Micro Four Thirds",
  
  // Performance
  "iso_range": "100-51200",
  "shutter_speed": "30s - 1/8000s",
  "fps_burst": "10 fps",
  
  // Video
  "video_resolution": "4K @ 60fps",
  "video_codec": "H.264, H.265",
  
  // Features
  "image_stabilization": true,
  "autofocus_points": 693,
  "touchscreen": true,
  "viewfinder": "Electronic",
  "wifi": true,
  "bluetooth": true,
  
  // Shutter Count
  "shutter_count": 5230, // Important for used cameras
  "shutter_life_rated": 200000,
  
  // Accessories
  "lens_included": "18-55mm f/3.5-5.6",
  "additional_lenses": ["50mm f/1.8"],
  "bag_included": true,
  "memory_cards": ["64GB SD card"],
  "batteries": 2,
  "charger": true,
  
  // Condition
  "sensor_condition": "clean",
  "body_condition": "excellent",
  "lcd_condition": "perfect",
  "mount_condition": "excellent"
}
```

### TV Fields

```json
{
  "category_type": "tv",
  
  // Display
  "screen_size": "55 inch",
  "display_type": "OLED" | "QLED" | "LED" | "LCD",
  "resolution": "4K UHD" | "1080p Full HD" | "8K",
  "hdr": ["HDR10", "Dolby Vision", "HLG"],
  "refresh_rate": "120Hz",
  
  // Smart Features
  "smart_tv": true,
  "os": "webOS" | "Tizen" | "Android TV" | "Roku TV",
  "voice_control": ["Alexa", "Google Assistant"],
  "streaming_apps": ["Netflix", "YouTube", "Prime Video", "Disney+"],
  
  // Connectivity
  "hdmi_ports": 4,
  "hdmi_version": "HDMI 2.1",
  "usb_ports": 2,
  "optical_audio": true,
  "wifi": true,
  "bluetooth": true,
  "ethernet": true,
  
  // Audio
  "speakers": "2.0 Channel, 20W",
  "dolby_atmos": true,
  
  // Gaming (if applicable)
  "gaming_features": ["VRR", "ALLM", "Game Mode"],
  
  // Mounting
  "vesa_mount": "300x300mm",
  "wall_mount_included": false,
  "stand_included": true,
  
  // Energy
  "energy_rating": "A+",
  "power_consumption": "120W",
  
  // Condition
  "screen_condition": "perfect",
  "dead_pixels": 0,
  "backlight_bleeding": "none",
  "remote_included": true
}
```

### Appliance Fields

```json
{
  "category_type": "appliance",
  "appliance_type": "refrigerator" | "washing_machine" | "dishwasher" | "vacuum" | "microwave",
  
  // General
  "capacity": "300L" | "8kg" | "12 place settings",
  "dimensions": {
    "height_cm": 185,
    "width_cm": 60,
    "depth_cm": 65
  },
  "weight_kg": 75,
  
  // Energy (EU Label)
  "energy_rating": "A+++" | "A++" | "A+" | "A" | "B" | "C" | "D",
  "energy_consumption_year": "150 kWh",
  
  // Features
  "features": ["no_frost", "quick_freeze", "led_lighting", "water_dispenser"],
  
  // Noise
  "noise_level_db": 39,
  
  // Warranty
  "warranty_remaining": "18 months",
  
  // Condition
  "functional": true,
  "cosmetic_condition": "excellent",
  "known_issues": [],
  
  // Installation
  "delivery_available": true,
  "installation_included": false,
  "dimensions_fit_standard_space": true
}
```

## Moderation Checklist

- ✅ **IMEI/Serial**: If phone/tablet, IMEI must be hidden in listing (show only to serious buyers)
- ✅ **Activation Lock**: Reject if iCloud/Google locked (unsellable)
- ✅ **Price Sanity**: Check against market rates for brand/model/year
- ✅ **Photos**: Require actual device photos (not stock images)
  - Must show device powered on (proof of functionality)
  - Show IMEI/serial partially visible (for verification, but masked in listing)
- ✅ **Stolen Device Check**: Flag if price suspiciously low + new condition
- ✅ **Counterfeit Risk**: Flag keywords like "AAA replica", "1:1 copy"
- ✅ **Warranty Fraud**: Verify warranty claims (check dates, transferability)
- ✅ **Software**: Reject if selling pirated software, hacked devices

### Auto-Flags

- Phone price <€200 for recent iPhone/Samsung flagship
- "Factory sealed" but selling below retail
- Multiple high-value electronics from same seller in short time
- IMEI/serial blacklisted (integrate with database if available)

## SEO

**Title Template**:
```
{Brand} {Model} - {Storage/Key Spec} | LyVoX
iPhone 13 Pro - 256GB, Graphite | LyVoX
Dell XPS 13 - i7, 16GB RAM, 512GB SSD | LyVoX
```

**Schema.org**: `Product` + `Offer`

## Examples

### Example 1: iPhone (JSON)

```json
{
  "title": "iPhone 13 Pro 256GB - Graphite, Excellent Condition",
  "category_type": "phone",
  "brand": "Apple",
  "model": "iPhone 13 Pro",
  "year": 2021,
  "storage": "256GB",
  "memory_ram": "6GB",
  "color": "graphite",
  "battery_health": "95%",
  "factory_unlocked": true,
  "icloud_status": "clean",
  "screen_condition": "perfect",
  "body_condition": "excellent",
  "original_box": true,
  "accessories_included": ["charger", "cable"],
  "warranty": false,
  "price": 699,
  "condition": "excellent"
}
```

---

**End of electronics.md**

---

## 🔗 Related Docs

**Development:** [MASTER_CHECKLIST.md](../../development/MASTER_CHECKLIST.md)
**Catalog:** [CATALOG_MASTER.md](../CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../CATALOG_IMPLEMENTATION_STATUS.md) • [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md) • [AI_ENRICHMENT.md](../AI_ENRICHMENT.md)
