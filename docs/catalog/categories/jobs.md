# Jobs & Career (Rabota i Karera)

> **Category**: Jobs  
> **Database Strategy**: Specialized Tables (Tier 1)  
> **Priority**: High  
> **Last Updated**: 2025-11-05

## Overview

Job marketplace for Belgium with specialized tables to support Belgium-specific contract types (CP codes), multilingual requirements, and legal compliance. Covers vacancies and resumes/CVs.

### Belgium Labor Market Specifics

- **CP Codes** (Paritair Comité / Commission Paritaire): Mandatory joint labor committee codes
- **Trilingual Market**: NL, FR, EN language requirements critical
- **Contract Types**: CDI, CDD, Intérim, Freelance/Indépendant
- **Work Permits**: Must disclose if required for non-EU citizens
- **Salary Transparency**: Gross vs Net, annual/monthly/hourly
- **Social Security**: Different rules for employees vs freelancers

## Subcategories

```
Jobs/
├── Vacancies
│   ├── Full-Time (CDI preference)
│   ├── Part-Time
│   ├── Temporary / Interim
│   └── Freelance / Project-Based
└── Resumes / CVs
    ├── Professional Profiles
    ├── Recent Graduates
    └── Career Changers
```

## Specialized Table Fields (job_listings)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `job_category_id` | UUID | ✅ | FK to job_categories (IT, Sales, Healthcare, etc.) |
| `cp_code` | TEXT | ⚠️ | Belgium CP code (e.g., "CP 200", "CP 218") |
| `contract_type_id` | UUID | ✅ | FK to job_contract_types (CDI, CDD, etc.) |
| `employment_type` | TEXT | ✅ | full_time, part_time, freelance, internship |
| `hours_per_week` | NUMERIC | ⚠️ | 0-80 hours |
| `remote_option` | TEXT | ⚠️ | none, hybrid, full_remote |
| `salary_min` | NUMERIC | ❌ | Min salary |
| `salary_max` | NUMERIC | ❌ | Max salary |
| `salary_currency` | TEXT | ✅ | EUR (default) |
| `salary_period` | TEXT | ⚠️ | hour, month, year |
| `salary_type` | TEXT | ⚠️ | gross, net |
| `salary_negotiable` | BOOLEAN | ❌ | Default: false |
| `benefits` | TEXT[] | ❌ | ["meal_vouchers", "company_car", "insurance"] |
| `experience_years_min` | INT | ❌ | Minimum years of experience |
| `education_level` | TEXT | ❌ | high_school, bachelor, master, phd |
| `languages_required` | TEXT[] | ⚠️ | ["nl", "fr", "en"] - critical for Belgium |
| `languages_preferred` | TEXT[] | ❌ | Additional language skills |
| `driving_license_required` | BOOLEAN | ❌ | - |
| `license_types` | TEXT[] | ❌ | ["B", "C", "CE"] |
| `work_permit_required` | BOOLEAN | ❌ | For non-EU citizens |
| `work_permit_sponsored` | BOOLEAN | ❌ | Employer will sponsor |
| `company_name` | TEXT | ⚠️ | Company name (optional for privacy) |
| `company_size` | TEXT | ❌ | startup, small, medium, large, enterprise |
| `industry` | TEXT | ❌ | IT, Healthcare, Finance, etc. |
| `application_deadline` | DATE | ❌ | - |
| `start_date` | DATE | ❌ | Desired start date |
| `contact_email` | TEXT | ❌ | Application email |
| `application_url` | TEXT | ❌ | External application link |

### Additional JSONB Fields

```json
{
  // Job Details
  "job_title_localized": {
    "nl": "Software Ontwikkelaar",
    "fr": "Développeur Logiciel",
    "en": "Software Developer"
  },
  
  "responsibilities": [
    "Develop and maintain web applications",
    "Collaborate with cross-functional teams",
    "Write clean, maintainable code"
  ],
  
  "required_skills": [
    "JavaScript/TypeScript",
    "React",
    "Node.js",
    "PostgreSQL"
  ],
  
  "preferred_skills": [
    "Next.js",
    "Docker",
    "AWS"
  ],
  
  // Belgium-Specific
  "cp_code_details": {
    "code": "CP 200",
    "name": "Auxiliary services for companies",
    "sector": "Services"
  },
  
  "language_requirements": {
    "nl": "fluent",
    "fr": "fluent",
    "en": "professional"
  },
  
  // Company Info
  "company": {
    "name": "Tech Company Belgium",
    "size": "50-200 employees",
    "industry": "Software Development",
    "website": "https://company.be",
    "founded": 2015,
    "culture": ["innovative", "flexible", "diverse"]
  },
  
  // Benefits Detail
  "benefits_details": {
    "meal_vouchers": "€8/day",
    "insurance": "Hospitalization + Dental",
    "company_car": "Optional (budget plan available)",
    "pension_plan": "Group insurance",
    "vacation_days": 20,
    "extra_legal_leave": 5,
    "training_budget": "€1,500/year",
    "home_office_setup": "€500 budget"
  },
  
  // Work Environment
  "office_location": {
    "city": "Brussels",
    "neighborhood": "EU Quarter",
    "public_transport": "Metro Schuman - 200m",
    "parking": "Available",
    "bike_friendly": true
  },
  
  "remote_policy": {
    "type": "hybrid",
    "office_days_per_week": 2,
    "flexible_hours": true,
    "core_hours": "10:00-16:00"
  },
  
  // Team & Culture
  "team_info": {
    "team_size": 8,
    "team_structure": "Agile/Scrum",
    "reporting_to": "Tech Lead",
    "collaboration_tools": ["Slack", "Jira", "GitLab"]
  },
  
  // Application Process
  "application_process": {
    "steps": [
      "CV screening",
      "Technical test (take-home)",
      "Interview with Tech Lead",
      "Interview with CEO",
      "Offer"
    ],
    "estimated_duration": "2-3 weeks",
    "feedback_provided": true
  },
  
  // Equal Opportunity
  "equal_opportunity": "We are an equal opportunity employer and value diversity..."
}
```

## Belgium CP Codes (Examples)

Dictionary table: `cp_codes`

| Code | Name (EN) | Sector |
|------|-----------|--------|
| CP 100 | Auxiliary services to persons | Services |
| CP 200 | Auxiliary services to companies | Services |
| CP 202 | Metal | Manufacturing |
| CP 218 | Hospitality (Horeca) | Hospitality |
| CP 220 | Food industry | Manufacturing |
| CP 302 | Hotels | Hospitality |
| CP 317 | Security services | Services |
| CP 330 | Healthcare | Healthcare |

## Contract Types (Belgium)

Dictionary table: `job_contract_types`

| Code | Name NL | Name FR | Name EN | Description |
|------|---------|---------|---------|-------------|
| CDI | Onbepaalde duur | Durée indéterminée | Permanent contract | Open-ended employment |
| CDD | Bepaalde duur | Durée déterminée | Fixed-term contract | Temporary, max 2 years typically |
| INTERIM | Uitzendarbeid | Travail intérimaire | Temporary work | Via temp agency |
| FREELANCE | Zelfstandige | Indépendant | Self-employed | Independent contractor |
| STAGE | Stage | Stage | Internship | Student/training position |

## Moderation Checklist

- ✅ **Salary Disclosure**: Encouraged but not always required
  - Flag if salary seems unrealistic (too high/low for role)
  - Must specify gross/net and period (hour/month/year)
- ✅ **Language Requirements**: Must be realistic
  - Flag if requires fluency in 5+ languages for entry-level
- ✅ **Work Permit**: Must disclose if required
  - Illegal to hide work permit requirement
- ✅ **Discrimination**: Zero tolerance
  - Reject: age limits (except legal minimums), gender preferences, nationality restrictions (except EU work permit)
  - Allowed: language requirements (justified by job), education requirements
- ✅ **Scam Indicators**:
  - "No experience required, earn €5,000/month"
  - "Work from home, flexible hours, unlimited income"
  - Requires upfront payment
  - Vague job description
  - No company name provided
- ✅ **MLM/Pyramid Schemes**: Always reject
- ✅ **Contact Info**: Must provide legitimate contact method
  - Reject if only WhatsApp with foreign number

## SEO

**Title Template**:
```
{Job Title} - {Company} | {Location} | LyVoX Jobs
Software Developer - TechCorp | Brussels | LyVoX Jobs
```

**Schema.org**: `JobPosting`

```json
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Software Developer",
  "description": "...",
  "datePosted": "2025-11-05",
  "validThrough": "2025-12-31",
  "employmentType": ["FULL_TIME"],
  "hiringOrganization": {
    "@type": "Organization",
    "name": "TechCorp",
    "sameAs": "https://techcorp.be"
  },
  "jobLocation": {
    "@type": "Place",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Hidden until application",
      "addressLocality": "Brussels",
      "postalCode": "1000",
      "addressCountry": "BE"
    }
  },
  "baseSalary": {
    "@type": "MonetaryAmount",
    "currency": "EUR",
    "value": {
      "@type": "QuantitativeValue",
      "minValue": 3500,
      "maxValue": 4500,
      "unitText": "MONTH"
    }
  },
  "workHours": "40 hours per week",
  "jobBenefits": "Meal vouchers, insurance, company car",
  "qualifications": "Bachelor degree in Computer Science or equivalent",
  "skills": "JavaScript, React, Node.js",
  "experienceRequirements": "3+ years"
}
```

## Example

```json
{
  "title": "Full-Stack Developer - Brussels (Hybrid)",
  "description": "Join our innovative team...",
  
  "job_category_id": "it-software-uuid",
  "cp_code": "CP 200",
  "contract_type_id": "cdi-uuid",
  "employment_type": "full_time",
  "hours_per_week": 40,
  "remote_option": "hybrid",
  
  "salary_min": 3500,
  "salary_max": 4500,
  "salary_currency": "EUR",
  "salary_period": "month",
  "salary_type": "gross",
  "salary_negotiable": true,
  
  "benefits": [
    "meal_vouchers",
    "company_car",
    "health_insurance",
    "pension_plan"
  ],
  
  "experience_years_min": 3,
  "education_level": "bachelor",
  
  "languages_required": ["nl", "fr", "en"],
  "driving_license_required": false,
  "work_permit_required": false,
  
  "company_name": "TechCorp Belgium",
  "company_size": "medium",
  "industry": "IT",
  
  "application_deadline": "2025-12-31",
  "start_date": "2026-02-01",
  "contact_email": "jobs@techcorp.be"
}
```

---

**End of jobs.md**

---

## 🔗 Related Docs

**Development:** [Production master](../../MASTER_PRODUCTION_TZ.md)
**Catalog:** [CATALOG_MASTER.md](../CATALOG_MASTER.md) • [CATALOG_IMPLEMENTATION_STATUS.md](../CATALOG_IMPLEMENTATION_STATUS.md) • [FINAL_COMPLETION_REPORT.md](../FINAL_COMPLETION_REPORT.md) • [IMPLEMENTATION_SUMMARY.md](../IMPLEMENTATION_SUMMARY.md)
