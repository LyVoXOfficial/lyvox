/**
 * Catalog E2E Tests
 * 
 * End-to-end tests for complete advert creation flows across all catalog categories.
 * Tests user journey from selecting category to publishing advert.
 */

import { test, expect } from '@playwright/test';

// Test data
const testUser = {
  email: 'test@example.com',
  password: 'Test123!@#',
};

const belgiumPostcodes = {
  brussels: '1000',
  antwerp: '2000',
  ghent: '9000',
};

test.describe('Real Estate Advert Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/.*dashboard.*/);
    
    // Navigate to post advert
    await page.goto('/post');
    await expect(page).toHaveURL('/post');
  });

  test('should create apartment for sale listing', async ({ page }) => {
    // Step 1: Select category
    await page.click('text=/Real Estate/i');
    await page.click('text=/Sale/i');
    await page.click('text=/Apartments/i');
    await page.click('button:has-text("Next")');
    
    // Step 2: Select condition
    await page.click('text=/Excellent/i');
    await page.click('button:has-text("Next")');
    
    // Step 3: Basic parameters (for real estate this might be type selection)
    await page.selectOption('select[name="property_type"]', 'apartment');
    await page.click('button:has-text("Next")');
    
    // Step 4: Real Estate specific fields
    await page.fill('input[name="area_sqm"]', '85');
    await page.fill('input[name="rooms"]', '3');
    await page.fill('input[name="bedrooms"]', '2');
    await page.fill('input[name="bathrooms"]', '1');
    
    // EPC rating
    await page.selectOption('select[name="epc_rating"]', 'B');
    
    // Location
    await page.fill('input[name="postcode"]', belgiumPostcodes.brussels);
    await page.fill('input[name="municipality"]', 'Brussels');
    
    // Features
    await page.check('input[name="elevator"]');
    await page.check('input[name="double_glazing"]');
    
    await page.click('button:has-text("Next")');
    
    // Step 5: Condition and Price
    await page.fill('input[name="price"]', '350000');
    await page.click('button:has-text("Next")');
    
    // Step 6: Options (might be skipped for real estate)
    await page.click('button:has-text("Next")');
    
    // Step 7: Final details
    await page.fill('input[name="title"]', 'Modern 2-Bedroom Apartment in Central Brussels');
    await page.fill('textarea[name="description"]', 
      'Beautiful modern apartment with 85m², 2 bedrooms, central location near public transport. ' +
      'Recently renovated with new kitchen and bathroom. EPC rating B.'
    );
    
    // Upload photos (mock)
    const fileInput = page.locator('input[type="file"]');
    // await fileInput.setInputFiles(['tests/fixtures/apartment-1.jpg']);
    
    await page.fill('input[name="location"]', 'Brussels, 1000');
    
    await page.click('button:has-text("Next")');
    
    // Step 8: Preview and publish
    await expect(page.locator('text=/Preview/i')).toBeVisible();
    await expect(page.locator('text=/Modern 2-Bedroom Apartment/i')).toBeVisible();
    await expect(page.locator('text=/€350,000/i')).toBeVisible();
    
    await page.click('button:has-text("Publish")');
    
    // Verify success
    await expect(page).toHaveURL(/.*adverts.*/);
    await expect(page.locator('text=/successfully published/i')).toBeVisible();
  });

  test('should create apartment for rent listing', async ({ page }) => {
    // Similar flow but with rental-specific fields
    await page.click('text=/Real Estate/i');
    await page.click('text=/Rent/i');
    await page.click('text=/Apartments/i');
    await page.click('button:has-text("Next")');
    
    await page.click('text=/Good/i');
    await page.click('button:has-text("Next")');
    
    await page.click('button:has-text("Next")'); // Skip step 3
    
    // Step 4: Real Estate fields
    await page.selectOption('select[name="listing_type"]', 'rent');
    await page.fill('input[name="area_sqm"]', '65');
    await page.fill('input[name="rooms"]', '2');
    await page.fill('input[name="bedrooms"]', '1');
    
    // Rental-specific fields
    await page.fill('input[name="rent_monthly"]', '1200');
    await page.fill('input[name="rent_charges_monthly"]', '150');
    await page.fill('input[name="deposit_months"]', '2');
    await page.selectOption('select[name="furnished"]', 'fully_furnished');
    
    await page.fill('input[name="postcode"]', belgiumPostcodes.ghent);
    await page.fill('input[name="municipality"]', 'Ghent');
    
    await page.click('button:has-text("Next")');
    
    // Continue through remaining steps...
    await page.fill('input[name="price"]', '1200'); // Monthly rent
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    await page.fill('input[name="title"]', 'Fully Furnished 1BR Apartment in Ghent Center');
    await page.fill('textarea[name="description"]', 
      'Cozy fully furnished apartment, 65m², available immediately. ' +
      'All utilities included in charges. Perfect for young professionals.'
    );
    
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Publish")');
    
    await expect(page.locator('text=/successfully published/i')).toBeVisible();
  });
});

test.describe('Electronics Advert Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.goto('/post');
  });

  test('should create smartphone listing', async ({ page }) => {
    // Step 1-3: Category and condition
    await page.click('text=/Electronics/i');
    await page.click('text=/Phones/i');
    await page.click('button:has-text("Next")');
    
    await page.click('text=/Like New/i');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    // Step 4: Electronics fields
    await page.selectOption('select[name="device_type"]', 'smartphone');
    
    // Wait for brands to load
    await page.waitForSelector('select[name="brand_id"]');
    await page.selectOption('select[name="brand_id"]', { label: /Apple/i });
    
    // Wait for models to load
    await page.waitForSelector('select[name="model_id"]');
    await page.selectOption('select[name="model_id"]', { label: /iPhone 13 Pro/i });
    
    await page.selectOption('select[name="storage_gb"]', '256');
    await page.selectOption('select[name="memory_ram_gb"]', '6');
    await page.fill('input[name="battery_health"]', '95');
    await page.selectOption('select[name="color"]', 'Graphite');
    await page.check('input[name="factory_unlocked"]');
    await page.check('input[name="original_box"]');
    await page.check('input[name="warranty_remaining"]');
    
    await page.click('button:has-text("Next")');
    
    // Price and remaining steps
    await page.fill('input[name="price"]', '850');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    await page.fill('input[name="title"]', 'iPhone 13 Pro 256GB Graphite - Like New');
    await page.fill('textarea[name="description"]', 
      'iPhone 13 Pro in excellent condition, 95% battery health. ' +
      'Factory unlocked, works with all carriers. Includes original box, charger, and unused cable.'
    );
    
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Publish")');
    
    await expect(page.locator('text=/successfully published/i')).toBeVisible();
  });

  test('should create laptop listing', async ({ page }) => {
    await page.click('text=/Electronics/i');
    await page.click('text=/Computers/i');
    await page.click('button:has-text("Next")');
    
    await page.click('text=/Good/i');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    // Laptop-specific fields
    await page.selectOption('select[name="device_type"]', 'laptop');
    await page.selectOption('select[name="brand_id"]', { label: /Dell/i });
    
    await page.fill('input[name="processor"]', 'Intel Core i7-11800H');
    await page.selectOption('select[name="memory_ram_gb"]', '16');
    await page.selectOption('select[name="storage_type"]', 'nvme');
    await page.selectOption('select[name="storage_gb"]', '512');
    await page.fill('input[name="graphics_card"]', 'NVIDIA RTX 3060');
    await page.selectOption('select[name="operating_system"]', 'windows_11');
    
    await page.click('button:has-text("Next")');
    await page.fill('input[name="price"]', '1200');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    await page.fill('input[name="title"]', 'Dell Gaming Laptop - i7, RTX 3060, 16GB RAM');
    await page.fill('textarea[name="description"]', 
      'Powerful gaming laptop in good condition. Perfect for gaming and content creation. ' +
      'Includes charger and carrying case.'
    );
    
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Publish")');
    
    await expect(page.locator('text=/successfully published/i')).toBeVisible();
  });
});

test.describe('Fashion Advert Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.goto('/post');
  });

  test('should create women clothing listing', async ({ page }) => {
    await page.click('text=/Fashion/i');
    await page.click('text=/Women/i');
    await page.click('text=/Dresses/i');
    await page.click('button:has-text("Next")');
    
    await page.click('text=/Like New/i');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    // Fashion fields
    await page.selectOption('select[name="item_type"]', 'dresses');
    await page.selectOption('select[name="gender"]', 'women');
    await page.selectOption('select[name="age_group"]', 'adult');
    await page.fill('input[name="brand"]', 'Zara');
    
    // Size
    await page.selectOption('select[name="size_eu"]', 'M');
    await page.fill('input[name="size_uk"]', '10');
    await page.fill('input[name="size_us"]', '6');
    
    // Material and style
    await page.selectOption('select[name="material"]', 'cotton');
    await page.fill('input[name="color"]', 'Navy Blue');
    await page.selectOption('select[name="season"]', 'spring_summer');
    await page.selectOption('select[name="pattern"]', 'floral');
    
    // Condition
    await page.check('input[name="original_tags"]');
    await page.check('input[name="never_worn"]');
    
    await page.click('button:has-text("Next")');
    await page.fill('input[name="price"]', '45');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    await page.fill('input[name="title"]', 'Zara Floral Summer Dress - Size M - New with Tags');
    await page.fill('textarea[name="description"]', 
      'Beautiful navy blue summer dress with floral pattern. Never worn, still has original tags. ' +
      '100% cotton, perfect for spring/summer season.'
    );
    
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Publish")');
    
    await expect(page.locator('text=/successfully published/i')).toBeVisible();
  });

  test('should create shoes listing', async ({ page }) => {
    await page.click('text=/Fashion/i');
    await page.click('text=/Women/i');
    await page.click('text=/Shoes/i');
    await page.click('button:has-text("Next")');
    
    await page.click('text=/Good/i');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    await page.selectOption('select[name="item_type"]', 'shoes');
    await page.selectOption('select[name="gender"]', 'women');
    await page.fill('input[name="brand"]', 'Nike');
    
    // Shoe sizes
    await page.selectOption('select[name="size_eu"]', '39');
    await page.fill('input[name="size_uk"]', '6');
    await page.fill('input[name="size_us"]', '8');
    
    await page.fill('input[name="color"]', 'White/Black');
    
    await page.click('button:has-text("Next")');
    await page.fill('input[name="price"]', '75');
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    await page.fill('input[name="title"]', 'Nike Air Max Sneakers - Size EU 39 - Good Condition');
    await page.fill('textarea[name="description"]', 
      'Nike Air Max sneakers in white/black colorway. Worn a few times, still in great shape. ' +
      'Very comfortable for daily wear or light sports.'
    );
    
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Publish")');
    
    await expect(page.locator('text=/successfully published/i')).toBeVisible();
  });
});

test.describe('Jobs Advert Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[type="email"]', testUser.email);
    await page.fill('input[type="password"]', testUser.password);
    await page.click('button[type="submit"]');
    await page.goto('/post');
  });

  test('should create full-time job listing', async ({ page }) => {
    await page.click('text=/Jobs/i');
    await page.click('text=/IT & Development/i');
    await page.click('button:has-text("Next")');
    
    await page.click('text=/Not Applicable/i'); // Condition doesn't apply to jobs
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    // Job fields
    await page.selectOption('select[name="job_category_id"]', { label: /Software Development/i });
    await page.selectOption('select[name="employment_type"]', 'full_time');
    await page.fill('input[name="job_title"]', 'Senior Full Stack Developer');
    
    // Compensation
    await page.selectOption('select[name="contract_type_id"]', { label: /Permanent/i });
    await page.selectOption('select[name="cp_code_id"]', { label: /CP 200/i });
    await page.fill('input[name="salary_min"]', '4000');
    await page.fill('input[name="salary_max"]', '6000');
    await page.selectOption('select[name="salary_type"]', 'gross');
    await page.fill('input[name="benefits"]', 'Company car, meal vouchers, insurance');
    
    // Requirements
    await page.selectOption('select[name="experience_level"]', 'senior');
    await page.selectOption('select[name="education_level"]', 'bachelor');
    
    // Languages
    await page.check('input[value="dutch"]');
    await page.check('input[value="english"]');
    
    await page.fill('textarea[name="required_skills"]', 
      'JavaScript, TypeScript, React, Node.js, PostgreSQL, Docker'
    );
    
    // Work conditions
    await page.selectOption('select[name="remote_option"]', 'hybrid');
    await page.selectOption('select[name="work_schedule"]', 'flexible');
    
    // Company info
    await page.fill('input[name="company_name"]', 'Tech Solutions Belgium');
    await page.selectOption('select[name="company_size"]', '51-200');
    await page.fill('input[name="company_website"]', 'https://techsolutions.be');
    
    await page.click('button:has-text("Next")');
    
    // Price (salary is already in specific fields, might skip this step)
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Next")');
    
    await page.fill('input[name="title"]', 'Senior Full Stack Developer - Hybrid - €4000-6000');
    await page.fill('textarea[name="description"]', 
      'We are looking for a talented Senior Full Stack Developer to join our growing team. ' +
      'You will work on exciting projects using modern technologies. Hybrid work model with ' +
      'flexible hours. Competitive salary and benefits package.'
    );
    
    await page.fill('input[name="location"]', 'Brussels, Belgium');
    
    await page.click('button:has-text("Next")');
    await page.click('button:has-text("Publish")');
    
    await expect(page.locator('text=/successfully published/i')).toBeVisible();
  });
});

test.describe('Search and Filter by Category', () => {
  test('should filter real estate by EPC rating', async ({ page }) => {
    await page.goto('/search?category_id=real-estate');
    
    await page.click('text=/Filters/i');
    await page.selectOption('select[name="epc_rating"]', 'A');
    await page.click('button:has-text("Apply")');
    
    await expect(page).toHaveURL(/.*epc_rating=A.*/);
    
    // Results should show only A-rated properties
    const results = page.locator('[data-testid="search-result"]');
    await expect(results.first()).toBeVisible();
  });

  test('should filter electronics by storage', async ({ page }) => {
    await page.goto('/search?category_id=electronics');
    
    await page.click('text=/Filters/i');
    await page.selectOption('select[name="storage_gb_min"]', '256');
    await page.click('button:has-text("Apply")');
    
    await expect(page).toHaveURL(/.*storage_gb_min=256.*/);
  });

  test('should filter fashion by size', async ({ page }) => {
    await page.goto('/search?category_id=fashion');
    
    await page.click('text=/Filters/i');
    await page.check('input[value="M"]');
    await page.click('button:has-text("Apply")');
    
    await expect(page).toHaveURL(/.*size_eu.*M.*/);
  });

  test('should filter jobs by salary and remote option', async ({ page }) => {
    await page.goto('/search?category_id=jobs');
    
    await page.click('text=/Filters/i');
    await page.fill('input[name="salary_min"]', '3000');
    await page.check('input[value="hybrid"]');
    await page.check('input[value="full"]');
    await page.click('button:has-text("Apply")');
    
    await expect(page).toHaveURL(/.*salary_min=3000.*/);
    await expect(page).toHaveURL(/.*remote_option.*hybrid.*/);
  });
});

test.describe('Validation and Error Handling', () => {
  test('should validate Belgian postcode format', async ({ page }) => {
    await page.goto('/post');
    // ... navigate to real estate form ...
    
    await page.fill('input[name="postcode"]', '00000'); // Invalid
    await page.click('button:has-text("Next")');
    
    await expect(page.locator('text=/invalid postcode/i')).toBeVisible();
  });

  test('should require mandatory fields', async ({ page }) => {
    await page.goto('/post');
    // ... select category ...
    
    await page.click('button:has-text("Publish")');
    
    // Should show validation errors
    await expect(page.locator('text=/required/i')).toBeVisible();
  });
});




