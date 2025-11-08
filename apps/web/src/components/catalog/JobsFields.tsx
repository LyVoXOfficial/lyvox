"use client";

import { useState, useEffect } from "react";
import { useI18n } from "@/i18n";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiFetch } from "@/lib/fetcher";

type JobsFormData = Record<string, any>;

interface JobsFieldsProps {
  formData: JobsFormData;
  onChange: (field: string, value: any) => void;
  locale?: string;
}

export function JobsFields({
  formData,
  onChange,
  locale = "en",
}: JobsFieldsProps) {
  const { t } = useI18n();
  
  // Reference data
  const [jobCategories, setJobCategories] = useState<any[]>([]);
  const [contractTypes, setContractTypes] = useState<any[]>([]);
  const [cpCodes, setCpCodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load reference data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [categoriesRes, contractsRes, cpRes] = await Promise.all([
          apiFetch(`/api/catalog/job-categories?lang=${locale}`),
          apiFetch(`/api/catalog/contract-types?lang=${locale}`),
          apiFetch(`/api/catalog/cp-codes?lang=${locale}`),
        ]);
        
        if (categoriesRes.ok) {
          setJobCategories(await categoriesRes.json());
        }
        if (contractsRes.ok) {
          setContractTypes(await contractsRes.json());
        }
        if (cpRes.ok) {
          setCpCodes(await cpRes.json());
        }
      } catch (error) {
        console.error("Failed to load job data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [locale]);

  // Employment type options
  const employmentTypes = [
    { value: 'full_time', label: 'Full-Time' },
    { value: 'part_time', label: 'Part-Time' },
    { value: 'freelance', label: 'Freelance / Self-Employed' },
    { value: 'internship', label: 'Internship' },
    { value: 'temporary', label: 'Temporary / Seasonal' },
    { value: 'volunteer', label: 'Volunteer' },
  ];

  // Experience level
  const experienceLevels = [
    { value: 'entry', label: 'Entry Level (0-2 years)' },
    { value: 'mid', label: 'Mid Level (2-5 years)' },
    { value: 'senior', label: 'Senior (5+ years)' },
    { value: 'lead', label: 'Lead / Manager' },
    { value: 'executive', label: 'Executive / Director' },
  ];

  // Education level
  const educationLevels = [
    { value: 'none', label: 'No requirement' },
    { value: 'high_school', label: 'High School Diploma' },
    { value: 'bachelor', label: "Bachelor's Degree" },
    { value: 'master', label: "Master's Degree" },
    { value: 'phd', label: 'PhD / Doctorate' },
    { value: 'vocational', label: 'Vocational Training' },
  ];

  // Language requirements (Belgium specific)
  const languageOptions = ['Dutch', 'French', 'English', 'German', 'Other'];

  return (
    <div className="space-y-8">
      {/* Job Category & Type */}
      <Card>
        <CardHeader>
          <CardTitle>Job Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Job Category */}
            <div className="space-y-2">
              <Label htmlFor="job_category_id">
                Job Category <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.job_category_id || ''}
                onValueChange={(val) => onChange('job_category_id', val)}
              >
                <SelectTrigger id="job_category_id">
                  <SelectValue placeholder="Select category..." />
                </SelectTrigger>
                <SelectContent>
                  {jobCategories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      {category.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Employment Type */}
            <div className="space-y-2">
              <Label htmlFor="employment_type">
                Employment Type <span className="text-red-500">*</span>
              </Label>
              <Select
                value={formData.employment_type || ''}
                onValueChange={(val) => onChange('employment_type', val)}
              >
                <SelectTrigger id="employment_type">
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {employmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Job Title */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="job_title">
                Job Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="job_title"
                type="text"
                maxLength={200}
                placeholder="e.g., Senior Software Engineer"
                value={formData.job_title || ''}
                onChange={(e) => onChange('job_title', e.target.value)}
                required
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contract & Compensation */}
      <Card>
        <CardHeader>
          <CardTitle>Contract & Compensation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Contract Type (Belgium CP Code) */}
            <div className="space-y-2">
              <Label htmlFor="contract_type_id">Contract Type (Belgium CP Code)</Label>
              <Select
                value={formData.contract_type_id || ''}
                onValueChange={(val) => onChange('contract_type_id', val)}
              >
                <SelectTrigger id="contract_type_id">
                  <SelectValue placeholder="Select contract..." />
                </SelectTrigger>
                <SelectContent>
                  {contractTypes.map((contract) => (
                    <SelectItem key={contract.id} value={contract.id}>
                      {contract.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Optional but recommended for Belgium</p>
            </div>

            {/* CP Code (Joint Committee) */}
            <div className="space-y-2">
              <Label htmlFor="cp_code_id">CP Code (Paritair Comité)</Label>
              <Select
                value={formData.cp_code_id || ''}
                onValueChange={(val) => onChange('cp_code_id', val)}
              >
                <SelectTrigger id="cp_code_id">
                  <SelectValue placeholder="Select CP..." />
                </SelectTrigger>
                <SelectContent>
                  {cpCodes.map((cp) => (
                    <SelectItem key={cp.id} value={cp.id}>
                      CP {cp.code} - {cp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">Sector-specific labor agreement</p>
            </div>

            {/* Salary Range */}
            <div className="space-y-2">
              <Label htmlFor="salary_min">Minimum Salary (€/month)</Label>
              <Input
                id="salary_min"
                type="number"
                min={0}
                step={100}
                placeholder="e.g., 2500"
                value={formData.salary_min ?? ''}
                onChange={(e) => onChange('salary_min', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="salary_max">Maximum Salary (€/month)</Label>
              <Input
                id="salary_max"
                type="number"
                min={0}
                step={100}
                placeholder="e.g., 3500"
                value={formData.salary_max ?? ''}
                onChange={(e) => onChange('salary_max', e.target.value ? parseFloat(e.target.value) : null)}
              />
            </div>

            {/* Salary Type */}
            <div className="space-y-2">
              <Label htmlFor="salary_type">Salary Type</Label>
              <Select
                value={formData.salary_type || ''}
                onValueChange={(val) => onChange('salary_type', val)}
              >
                <SelectTrigger id="salary_type">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gross">Gross (Bruto)</SelectItem>
                  <SelectItem value="net">Net (Netto)</SelectItem>
                  <SelectItem value="hourly">Hourly Rate</SelectItem>
                  <SelectItem value="negotiable">Negotiable</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Additional Benefits */}
            <div className="space-y-2">
              <Label htmlFor="benefits">Additional Benefits</Label>
              <Input
                id="benefits"
                type="text"
                maxLength={300}
                placeholder="e.g., Company car, meal vouchers, insurance"
                value={formData.benefits || ''}
                onChange={(e) => onChange('benefits', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Experience Level */}
            <div className="space-y-2">
              <Label htmlFor="experience_level">Experience Level</Label>
              <Select
                value={formData.experience_level || ''}
                onValueChange={(val) => onChange('experience_level', val)}
              >
                <SelectTrigger id="experience_level">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {experienceLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Education Level */}
            <div className="space-y-2">
              <Label htmlFor="education_level">Education Level</Label>
              <Select
                value={formData.education_level || ''}
                onValueChange={(val) => onChange('education_level', val)}
              >
                <SelectTrigger id="education_level">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {educationLevels.map((level) => (
                    <SelectItem key={level.value} value={level.value}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Language Requirements */}
            <div className="space-y-2 md:col-span-2">
              <Label>Language Requirements</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 border rounded-md">
                {languageOptions.map((lang) => {
                  const langValue = lang.toLowerCase();
                  const languages = formData.languages_required || [];
                  return (
                    <div key={langValue} className="flex items-center space-x-2">
                      <Checkbox
                        id={`lang-${langValue}`}
                        checked={languages.includes(langValue)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            onChange('languages_required', [...languages, langValue]);
                          } else {
                            onChange('languages_required', languages.filter((l: string) => l !== langValue));
                          }
                        }}
                      />
                      <Label htmlFor={`lang-${langValue}`} className="text-sm font-normal cursor-pointer">
                        {lang}
                      </Label>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Required Skills */}
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="required_skills">Required Skills</Label>
              <Textarea
                id="required_skills"
                rows={3}
                maxLength={500}
                placeholder="e.g., JavaScript, React, Node.js, SQL (comma-separated)"
                value={formData.required_skills || ''}
                onChange={(e) => onChange('required_skills', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Work Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Work Conditions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Remote Work */}
            <div className="space-y-2">
              <Label htmlFor="remote_option">Remote Work</Label>
              <Select
                value={formData.remote_option || ''}
                onValueChange={(val) => onChange('remote_option', val)}
              >
                <SelectTrigger id="remote_option">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">On-site Only</SelectItem>
                  <SelectItem value="hybrid">Hybrid (Partial Remote)</SelectItem>
                  <SelectItem value="full">Fully Remote</SelectItem>
                  <SelectItem value="flexible">Flexible</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Work Schedule */}
            <div className="space-y-2">
              <Label htmlFor="work_schedule">Work Schedule</Label>
              <Select
                value={formData.work_schedule || ''}
                onValueChange={(val) => onChange('work_schedule', val)}
              >
                <SelectTrigger id="work_schedule">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="9_to_5">9-to-5 / Day Shift</SelectItem>
                  <SelectItem value="flexible">Flexible Hours</SelectItem>
                  <SelectItem value="shifts">Rotating Shifts</SelectItem>
                  <SelectItem value="night">Night Shift</SelectItem>
                  <SelectItem value="weekend">Weekends Included</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date */}
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => onChange('start_date', e.target.value)}
              />
            </div>

            {/* Application Deadline */}
            <div className="space-y-2">
              <Label htmlFor="application_deadline">Application Deadline</Label>
              <Input
                id="application_deadline"
                type="date"
                value={formData.application_deadline || ''}
                onChange={(e) => onChange('application_deadline', e.target.value)}
              />
            </div>

            {/* Checkboxes */}
            <div className="md:col-span-2 space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="work_permit_required"
                  checked={formData.work_permit_required === true}
                  onCheckedChange={(checked) => onChange('work_permit_required', checked)}
                />
                <Label htmlFor="work_permit_required" className="cursor-pointer">
                  EU Work Permit Required for Non-EU Citizens
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="driver_license_required"
                  checked={formData.driver_license_required === true}
                  onCheckedChange={(checked) => onChange('driver_license_required', checked)}
                />
                <Label htmlFor="driver_license_required" className="cursor-pointer">
                  Driver's License Required
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="background_check_required"
                  checked={formData.background_check_required === true}
                  onCheckedChange={(checked) => onChange('background_check_required', checked)}
                />
                <Label htmlFor="background_check_required" className="cursor-pointer">
                  Background Check Required
                </Label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="company_name">Company Name</Label>
              <Input
                id="company_name"
                type="text"
                maxLength={200}
                placeholder="Your company name"
                value={formData.company_name || ''}
                onChange={(e) => onChange('company_name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company_size">Company Size</Label>
              <Select
                value={formData.company_size || ''}
                onValueChange={(val) => onChange('company_size', val)}
              >
                <SelectTrigger id="company_size">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 employees</SelectItem>
                  <SelectItem value="11-50">11-50 employees</SelectItem>
                  <SelectItem value="51-200">51-200 employees</SelectItem>
                  <SelectItem value="201-500">201-500 employees</SelectItem>
                  <SelectItem value="500+">500+ employees</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company_website">Company Website</Label>
              <Input
                id="company_website"
                type="url"
                placeholder="https://example.com"
                value={formData.company_website || ''}
                onChange={(e) => onChange('company_website', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Person */}
      <Card>
        <CardHeader>
          <CardTitle>HR Contact (Optional)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="hr_contact_name">Contact Name</Label>
              <Input
                id="hr_contact_name"
                type="text"
                maxLength={100}
                placeholder="HR Manager name"
                value={formData.hr_contact_name || ''}
                onChange={(e) => onChange('hr_contact_name', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="hr_contact_email">Contact Email</Label>
              <Input
                id="hr_contact_email"
                type="email"
                maxLength={100}
                placeholder="hr@company.com"
                value={formData.hr_contact_email || ''}
                onChange={(e) => onChange('hr_contact_email', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}




