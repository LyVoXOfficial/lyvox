/**
 * Catalog Component Tests
 * 
 * Tests for catalog-specific UI components including:
 * - RealEstateFields
 * - ElectronicsFields
 * - FashionFields
 * - JobsFields
 * - DynamicFieldRenderer
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RealEstateFields } from '../RealEstateFields';
import { ElectronicsFields } from '../ElectronicsFields';
import { FashionFields } from '../FashionFields';
import { JobsFields } from '../JobsFields';
import { DynamicFieldRenderer, type FieldDefinition } from '../DynamicFieldRenderer';

// Mock i18n
vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
    locale: 'en',
  }),
}));

// Mock API fetch
global.fetch = vi.fn();

const mockFetch = (data: any) => {
  (global.fetch as any).mockResolvedValueOnce({
    ok: true,
    json: async () => data,
  });
};

describe('RealEstateFields', () => {
  it('should render basic fields', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/property type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/listing type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/living area/i)).toBeInTheDocument();
  });

  it('should call onChange when field value changes', async () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    const areaInput = screen.getByLabelText(/living area/i);
    await userEvent.type(areaInput, '150');
    
    expect(mockOnChange).toHaveBeenCalledWith('area_sqm', expect.any(Number));
  });

  it('should show rental fields when listing_type is rent', () => {
    const mockOnChange = vi.fn();
    const formData = { listing_type: 'rent' };
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/monthly rent/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/security deposit/i)).toBeInTheDocument();
  });

  it('should not show rental fields for sale listings', () => {
    const mockOnChange = vi.fn();
    const formData = { listing_type: 'sale' };
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.queryByLabelText(/monthly rent/i)).not.toBeInTheDocument();
  });

  it('should validate Belgian postcode format', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    const postcodeInput = screen.getByLabelText(/postcode/i);
    expect(postcodeInput).toHaveAttribute('pattern', '^[1-9][0-9]{3}$');
    expect(postcodeInput).toHaveAttribute('maxLength', '4');
  });

  it('should load property types from API', async () => {
    mockFetch([
      { id: '1', name: 'Apartment', slug: 'apartment' },
      { id: '2', name: 'House', slug: 'house' },
    ]);
    
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/catalog/property-types')
      );
    });
  });
});

describe('ElectronicsFields', () => {
  it('should render device type selector', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <ElectronicsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/device type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/brand/i)).toBeInTheDocument();
  });

  it('should show mobile-specific fields for smartphones', () => {
    const mockOnChange = vi.fn();
    const formData = { device_type: 'smartphone' };
    
    render(
      <ElectronicsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/storage/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/battery health/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/factory unlocked/i)).toBeInTheDocument();
  });

  it('should show computer specs for laptops', () => {
    const mockOnChange = vi.fn();
    const formData = { device_type: 'laptop' };
    
    render(
      <ElectronicsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/processor/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/graphics card/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/operating system/i)).toBeInTheDocument();
  });

  it('should show display specs for TV', () => {
    const mockOnChange = vi.fn();
    const formData = { device_type: 'tv' };
    
    render(
      <ElectronicsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/screen size/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resolution/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/smart tv/i)).toBeInTheDocument();
  });

  it('should load models when brand is selected', async () => {
    mockFetch([]); // brands
    mockFetch([
      { id: '1', name: 'iPhone 13', brand_id: 'apple-1' },
    ]); // models
    
    const mockOnChange = vi.fn();
    const formData = { brand_id: 'apple-1' };
    
    render(
      <ElectronicsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/catalog/device-models')
      );
    });
  });
});

describe('FashionFields', () => {
  it('should render size selectors', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <FashionFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/size \(eu\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/gender/i)).toBeInTheDocument();
  });

  it('should show shoe sizes for shoes', () => {
    const mockOnChange = vi.fn();
    const formData = { item_type: 'shoes' };
    
    render(
      <FashionFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    const sizeSelectors = screen.getAllByLabelText(/size/i);
    expect(sizeSelectors.length).toBeGreaterThan(0);
  });

  it('should show measurements section for clothing', () => {
    const mockOnChange = vi.fn();
    const formData = { item_type: 'tops' };
    
    render(
      <FashionFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByText(/measurements/i)).toBeInTheDocument();
  });

  it('should handle size selection', async () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <FashionFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    const sizeSelect = screen.getByLabelText(/size \(eu\)/i);
    await userEvent.click(sizeSelect);
    
    // Should show size options
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should toggle care tags checkboxes', async () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <FashionFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    const originalTagsCheckbox = screen.getByLabelText(/original tags/i);
    await userEvent.click(originalTagsCheckbox);
    
    expect(mockOnChange).toHaveBeenCalledWith('original_tags', true);
  });
});

describe('JobsFields', () => {
  beforeEach(() => {
    mockFetch([]); // job categories
    mockFetch([]); // contract types
    mockFetch([]); // cp codes
  });

  it('should render job-specific fields', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <JobsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/job title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/employment type/i)).toBeInTheDocument();
  });

  it('should show salary fields', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <JobsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/minimum salary/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/maximum salary/i)).toBeInTheDocument();
  });

  it('should show Belgium CP code selector', async () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <JobsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    await waitFor(() => {
      expect(screen.getByLabelText(/cp code/i)).toBeInTheDocument();
    });
  });

  it('should show language requirements checkboxes', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <JobsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    expect(screen.getByText(/language requirements/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dutch/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/french/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/english/i)).toBeInTheDocument();
  });

  it('should handle multiple language selection', async () => {
    const mockOnChange = vi.fn();
    const formData = { languages_required: [] };
    
    render(
      <JobsFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    const dutchCheckbox = screen.getByLabelText(/dutch/i);
    await userEvent.click(dutchCheckbox);
    
    expect(mockOnChange).toHaveBeenCalledWith(
      'languages_required',
      expect.arrayContaining(['dutch'])
    );
  });
});

describe('DynamicFieldRenderer', () => {
  it('should render text input', () => {
    const field: FieldDefinition = {
      name: 'test_field',
      type: 'text',
      label: 'Test Field',
      required: true,
    };
    const mockOnChange = vi.fn();
    
    render(
      <DynamicFieldRenderer
        field={field}
        value=""
        onChange={mockOnChange}
        formData={{}}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/test field/i)).toBeInTheDocument();
    expect(screen.getByText('*')).toBeInTheDocument(); // Required indicator
  });

  it('should render number input', () => {
    const field: FieldDefinition = {
      name: 'price',
      type: 'number',
      label: 'Price',
      min: 0,
      max: 10000,
    };
    const mockOnChange = vi.fn();
    
    render(
      <DynamicFieldRenderer
        field={field}
        value={100}
        onChange={mockOnChange}
        formData={{}}
        locale="en"
      />
    );
    
    const input = screen.getByLabelText(/price/i);
    expect(input).toHaveAttribute('type', 'number');
    expect(input).toHaveAttribute('min', '0');
    expect(input).toHaveAttribute('max', '10000');
  });

  it('should render select dropdown', () => {
    const field: FieldDefinition = {
      name: 'category',
      type: 'select',
      label: 'Category',
      options: [
        { value: 'cat1', label: 'Category 1' },
        { value: 'cat2', label: 'Category 2' },
      ],
    };
    const mockOnChange = vi.fn();
    
    render(
      <DynamicFieldRenderer
        field={field}
        value=""
        onChange={mockOnChange}
        formData={{}}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/category/i)).toBeInTheDocument();
  });

  it('should render multiselect checkboxes', () => {
    const field: FieldDefinition = {
      name: 'features',
      type: 'multiselect',
      label: 'Features',
      options: [
        { value: 'feature1', label: 'Feature 1' },
        { value: 'feature2', label: 'Feature 2' },
      ],
    };
    const mockOnChange = vi.fn();
    
    render(
      <DynamicFieldRenderer
        field={field}
        value={[]}
        onChange={mockOnChange}
        formData={{}}
        locale="en"
      />
    );
    
    expect(screen.getByLabelText(/feature 1/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/feature 2/i)).toBeInTheDocument();
  });

  it('should handle multiselect value changes', async () => {
    const field: FieldDefinition = {
      name: 'features',
      type: 'multiselect',
      label: 'Features',
      options: [
        { value: 'feature1', label: 'Feature 1' },
        { value: 'feature2', label: 'Feature 2' },
      ],
    };
    const mockOnChange = vi.fn();
    
    render(
      <DynamicFieldRenderer
        field={field}
        value={[]}
        onChange={mockOnChange}
        formData={{}}
        locale="en"
      />
    );
    
    const checkbox = screen.getByLabelText(/feature 1/i);
    await userEvent.click(checkbox);
    
    expect(mockOnChange).toHaveBeenCalledWith('features', ['feature1']);
  });

  it('should respect conditional logic', () => {
    const field: FieldDefinition = {
      name: 'conditional_field',
      type: 'text',
      label: 'Conditional Field',
      conditional: { field: 'type', value: 'specific' },
    };
    const mockOnChange = vi.fn();
    
    const { container } = render(
      <DynamicFieldRenderer
        field={field}
        value=""
        onChange={mockOnChange}
        formData={{ type: 'other' }}
        locale="en"
      />
    );
    
    // Field should not render when condition is not met
    expect(container).toBeEmptyDOMElement();
  });

  it('should render date input', () => {
    const field: FieldDefinition = {
      name: 'start_date',
      type: 'date',
      label: 'Start Date',
    };
    const mockOnChange = vi.fn();
    
    render(
      <DynamicFieldRenderer
        field={field}
        value=""
        onChange={mockOnChange}
        formData={{}}
        locale="en"
      />
    );
    
    const input = screen.getByLabelText(/start date/i);
    expect(input).toHaveAttribute('type', 'date');
  });

  it('should render checkbox', () => {
    const field: FieldDefinition = {
      name: 'agree',
      type: 'checkbox',
      label: 'I agree',
    };
    const mockOnChange = vi.fn();
    
    render(
      <DynamicFieldRenderer
        field={field}
        value={false}
        onChange={mockOnChange}
        formData={{}}
        locale="en"
      />
    );
    
    const checkbox = screen.getByLabelText(/i agree/i);
    expect(checkbox).toBeInTheDocument();
    expect(checkbox).toHaveAttribute('type', 'checkbox');
  });
});

describe('Integration Tests', () => {
  it('should handle complete real estate form flow', async () => {
    mockFetch([{ id: '1', name: 'Apartment' }]); // property types
    mockFetch([{ code: 'A++', name: 'A++' }]); // epc ratings
    
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    // Wait for data to load
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
    
    // Fill in area
    const areaInput = screen.getByLabelText(/living area/i);
    await userEvent.type(areaInput, '150');
    
    // Fill in rooms
    const roomsInput = screen.getByLabelText(/total rooms/i);
    await userEvent.type(roomsInput, '3');
    
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('should validate Belgium-specific fields', () => {
    const mockOnChange = vi.fn();
    const formData = {};
    
    render(
      <RealEstateFields
        formData={formData}
        onChange={mockOnChange}
        locale="en"
      />
    );
    
    // Postcode should have Belgian format validation
    const postcodeInput = screen.getByLabelText(/postcode/i);
    expect(postcodeInput).toHaveAttribute('pattern', '^[1-9][0-9]{3}$');
    
    // EPC certificate should have format validation
    const epcInput = screen.getByLabelText(/epc certificate/i);
    expect(epcInput).toHaveAttribute('pattern', expect.stringContaining('\\d'));
  });
});




