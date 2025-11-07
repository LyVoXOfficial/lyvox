"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";

export interface FieldDefinition {
  name: string;
  type: 'text' | 'number' | 'select' | 'multiselect' | 'checkbox' | 'date' | 'textarea' | 'range';
  label: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  validation?: string; // Regex pattern
  group?: string;
  conditional?: { field: string; value: any };
  hidden?: boolean;
}

interface DynamicFieldRendererProps {
  field: FieldDefinition;
  value: any;
  onChange: (name: string, value: any) => void;
  formData: Record<string, any>; // For conditional logic
  locale?: string;
}

export function DynamicFieldRenderer({
  field,
  value,
  onChange,
  formData,
  locale = 'en',
}: DynamicFieldRendererProps) {
  const { t } = useI18n();

  // Check conditional logic
  if (field.conditional) {
    const { field: condField, value: condValue } = field.conditional;
    const currentValue = formData[condField];
    
    // Handle array of values (e.g., device_type in ['phone', 'tablet'])
    if (Array.isArray(condValue)) {
      if (!condValue.includes(currentValue)) {
        return null; // Hide field
      }
    } else if (currentValue !== condValue) {
      return null; // Hide field
    }
  }

  // Hidden fields (like IMEI, serial number)
  if (field.hidden) {
    return null;
  }

  const fieldId = `field-${field.name}`;

  // Render based on field type
  switch (field.type) {
    case 'text':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={fieldId}
            name={field.name}
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            pattern={field.validation}
            className="w-full"
          />
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case 'number':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={fieldId}
            name={field.name}
            type="number"
            value={value ?? ''}
            onChange={(e) => onChange(field.name, e.target.value ? parseFloat(e.target.value) : null)}
            placeholder={field.placeholder}
            required={field.required}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            className="w-full"
          />
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case 'select':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Select
            value={value || ''}
            onValueChange={(val) => onChange(field.name, val)}
            required={field.required}
          >
            <SelectTrigger id={fieldId} className="w-full">
              <SelectValue placeholder={field.placeholder || 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case 'multiselect':
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          <Label>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <div className="grid grid-cols-2 gap-3 p-4 border rounded-md">
            {field.options?.map((option) => (
              <div key={option.value} className="flex items-center space-x-2">
                <Checkbox
                  id={`${fieldId}-${option.value}`}
                  checked={selectedValues.includes(option.value)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onChange(field.name, [...selectedValues, option.value]);
                    } else {
                      onChange(field.name, selectedValues.filter((v: string) => v !== option.value));
                    }
                  }}
                />
                <Label
                  htmlFor={`${fieldId}-${option.value}`}
                  className="text-sm font-normal cursor-pointer"
                >
                  {option.label}
                </Label>
              </div>
            ))}
          </div>
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={fieldId}
            checked={value === true}
            onCheckedChange={(checked) => onChange(field.name, checked)}
          />
          <Label htmlFor={fieldId} className="cursor-pointer">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          {field.helpText && (
            <p className="text-sm text-muted-foreground ml-2">({field.helpText})</p>
          )}
        </div>
      );

    case 'date':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Input
            id={fieldId}
            name={field.name}
            type="date"
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            required={field.required}
            min={field.min ? new Date(field.min).toISOString().split('T')[0] : undefined}
            max={field.max ? new Date(field.max).toISOString().split('T')[0] : undefined}
            className="w-full"
          />
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case 'textarea':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <Textarea
            id={fieldId}
            name={field.name}
            value={value || ''}
            onChange={(e) => onChange(field.name, e.target.value)}
            placeholder={field.placeholder}
            required={field.required}
            rows={4}
            className="w-full"
          />
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    case 'range':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldId}>
            {field.label}: {value ?? field.min}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          <input
            id={fieldId}
            name={field.name}
            type="range"
            value={value ?? field.min ?? 0}
            onChange={(e) => onChange(field.name, parseFloat(e.target.value))}
            min={field.min}
            max={field.max}
            step={field.step || 1}
            required={field.required}
            className="w-full"
          />
          {field.helpText && (
            <p className="text-sm text-muted-foreground">{field.helpText}</p>
          )}
        </div>
      );

    default:
      console.warn(`Unknown field type: ${field.type}`);
      return null;
  }
}

/**
 * Renders a group of fields
 */
interface FieldGroupProps {
  groupName: string;
  groupLabel: string;
  fields: FieldDefinition[];
  formData: Record<string, any>;
  onChange: (name: string, value: any) => void;
  locale?: string;
}

export function FieldGroup({
  groupName,
  groupLabel,
  fields,
  formData,
  onChange,
  locale,
}: FieldGroupProps) {
  // Filter fields that belong to this group
  const groupFields = fields.filter((f) => f.group === groupName);

  if (groupFields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b pb-2">{groupLabel}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {groupFields.map((field) => (
          <DynamicFieldRenderer
            key={field.name}
            field={field}
            value={formData[field.name]}
            onChange={onChange}
            formData={formData}
            locale={locale}
          />
        ))}
      </div>
    </div>
  );
}




