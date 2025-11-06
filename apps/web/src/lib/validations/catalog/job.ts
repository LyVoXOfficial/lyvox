/**
 * Job Listing Validation Schema
 */

import { z } from 'zod';

export const employmentTypeSchema = z.enum(['full_time', 'part_time', 'freelance', 'internship']);

export const remoteOptionSchema = z.enum(['none', 'hybrid', 'full_remote']);

export const educationLevelSchema = z.enum(['none', 'high_school', 'bachelor', 'master', 'phd']);

export const companySizeSchema = z.enum(['startup', 'small', 'medium', 'large', 'enterprise']);

export const salaryPeriodSchema = z.enum(['hour', 'month', 'year']);

export const salaryTypeSchema = z.enum(['gross', 'net']);

// Language codes (ISO 639-1)
export const languageCodeSchema = z.enum(['nl', 'fr', 'en', 'de', 'es', 'it', 'pt', 'ru', 'ar', 'zh']);

// Driving license types (Belgium)
export const licenseTypeSchema = z.enum(['AM', 'A1', 'A2', 'A', 'B', 'BE', 'C', 'CE', 'D', 'DE', 'G']);

export const jobListingSchema = z.object({
  // Classification
  job_category: z.string().min(1, 'Job category is required'),
  cp_code: z.string().optional(), // Belgium CP code
  contract_type: z.string().min(1, 'Contract type is required'),
  employment_type: employmentTypeSchema,
  
  // Schedule
  hours_per_week: z.number().positive().max(80).optional(),
  shift_work: z.boolean().optional(),
  weekend_work: z.boolean().optional(),
  night_shifts: z.boolean().optional(),
  flexible_hours: z.boolean().optional(),
  remote_option: remoteOptionSchema.default('none'),
  
  // Compensation
  salary_min: z.number().nonnegative().optional(),
  salary_max: z.number().nonnegative().optional(),
  salary_currency: z.string().length(3).default('EUR'),
  salary_period: salaryPeriodSchema.optional(),
  salary_type: salaryTypeSchema.optional(),
  salary_negotiable: z.boolean().default(false),
  benefits: z.array(z.string()).optional(),
  
  // Requirements
  experience_years_min: z.number().int().nonnegative().optional(),
  education_level: educationLevelSchema.optional(),
  languages_required: z.array(languageCodeSchema).optional(),
  languages_preferred: z.array(languageCodeSchema).optional(),
  driving_license_required: z.boolean().default(false),
  license_types: z.array(licenseTypeSchema).optional(),
  
  // Legal (Belgium-specific)
  work_permit_required: z.boolean().default(false),
  work_permit_sponsored: z.boolean().default(false),
  
  // Company Info
  company_name: z.string().max(200).optional(),
  company_size: companySizeSchema.optional(),
  industry: z.string().max(100).optional(),
  
  // Application
  application_deadline: z.string().date().optional(),
  start_date: z.string().date().optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().optional(),
  application_url: z.string().url().optional(),
})
.refine(
  (data) => !data.salary_min || !data.salary_max || data.salary_max >= data.salary_min,
  { message: 'Maximum salary must be greater than or equal to minimum salary', path: ['salary_max'] }
)
.refine(
  (data) => {
    if (data.employment_type === 'full_time' && data.hours_per_week) {
      return data.hours_per_week >= 35 && data.hours_per_week <= 45;
    }
    return true;
  },
  { message: 'Full-time typically requires 35-45 hours per week', path: ['hours_per_week'] }
)
.refine(
  (data) => {
    if (data.employment_type === 'part_time' && data.hours_per_week) {
      return data.hours_per_week < 35;
    }
    return true;
  },
  { message: 'Part-time should be less than 35 hours per week', path: ['hours_per_week'] }
)
.refine(
  (data) => {
    // At least one contact method should be provided
    return data.contact_email || data.contact_phone || data.application_url;
  },
  { message: 'At least one contact method is required', path: ['contact_email'] }
);

export type JobListingInput = z.infer<typeof jobListingSchema>;

