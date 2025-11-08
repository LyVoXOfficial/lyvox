export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      ad_item_specifics: {
        Row: {
          advert_id: string
          specifics: Json
        }
        Insert: {
          advert_id: string
          specifics?: Json
        }
        Update: {
          advert_id?: string
          specifics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ad_item_specifics_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: true
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
        ]
      }
      advert_views: {
        Row: {
          advert_id: string
          id: string
          ip_address: unknown
          user_agent: string | null
          user_id: string | null
          viewed_at: string | null
        }
        Insert: {
          advert_id: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Update: {
          advert_id?: string
          id?: string
          ip_address?: unknown
          user_agent?: string | null
          user_id?: string | null
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "advert_views_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: false
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
        ]
      }
      adverts: {
        Row: {
          category_id: string
          condition: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          location: string | null
          location_id: string | null
          price: number | null
          status: string
          title: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          category_id: string
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          location?: string | null
          location_id?: string | null
          price?: number | null
          status?: string
          title: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          category_id?: string
          condition?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          location?: string | null
          location_id?: string | null
          price?: number | null
          status?: string
          title?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "adverts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adverts_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_advert_counts"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "adverts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_field_options: {
        Row: {
          code: string
          created_at: string
          field_id: string
          id: string
          metadata: Json
          name_i18n_key: string
          sort: number | null
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          field_id: string
          id?: string
          metadata?: Json
          name_i18n_key: string
          sort?: number | null
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          field_id?: string
          id?: string
          metadata?: Json
          name_i18n_key?: string
          sort?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "catalog_field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "catalog_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      catalog_fields: {
        Row: {
          created_at: string
          description_i18n_key: string | null
          domain: string | null
          field_key: string
          field_type: string
          group_key: string | null
          id: string
          is_required: boolean
          label_i18n_key: string | null
          max_value: number | null
          metadata: Json
          min_value: number | null
          pattern: string | null
          sort: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_i18n_key?: string | null
          domain?: string | null
          field_key: string
          field_type: string
          group_key?: string | null
          id?: string
          is_required?: boolean
          label_i18n_key?: string | null
          max_value?: number | null
          metadata?: Json
          min_value?: number | null
          pattern?: string | null
          sort?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_i18n_key?: string | null
          domain?: string | null
          field_key?: string
          field_type?: string
          group_key?: string | null
          id?: string
          is_required?: boolean
          label_i18n_key?: string | null
          max_value?: number | null
          metadata?: Json
          min_value?: number | null
          pattern?: string | null
          sort?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      catalog_subcategory_schema: {
        Row: {
          category_id: string
          created_at: string
          id: string
          is_active: boolean
          steps: Json
          updated_at: string
          version: number
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          steps: Json
          updated_at?: string
          version?: number
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          steps?: Json
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "catalog_subcategory_schema_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "catalog_subcategory_schema_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "category_advert_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      categories: {
        Row: {
          icon: string | null
          id: string
          is_active: boolean | null
          level: number
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
          parent_id: string | null
          path: string
          slug: string
          sort: number | null
        }
        Insert: {
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level: number
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
          parent_id?: string | null
          path: string
          slug: string
          sort?: number | null
        }
        Update: {
          icon?: string | null
          id?: string
          is_active?: boolean | null
          level?: number
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
          parent_id?: string | null
          path?: string
          slug?: string
          sort?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "category_advert_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      clothing_sizes: {
        Row: {
          category: string
          chest_cm_max: number | null
          chest_cm_min: number | null
          hips_cm_max: number | null
          hips_cm_min: number | null
          id: string
          numeric_size: string | null
          size_eu: string | null
          size_label: string | null
          size_uk: string | null
          size_us: string | null
          waist_cm_max: number | null
          waist_cm_min: number | null
        }
        Insert: {
          category: string
          chest_cm_max?: number | null
          chest_cm_min?: number | null
          hips_cm_max?: number | null
          hips_cm_min?: number | null
          id?: string
          numeric_size?: string | null
          size_eu?: string | null
          size_label?: string | null
          size_uk?: string | null
          size_us?: string | null
          waist_cm_max?: number | null
          waist_cm_min?: number | null
        }
        Update: {
          category?: string
          chest_cm_max?: number | null
          chest_cm_min?: number | null
          hips_cm_max?: number | null
          hips_cm_min?: number | null
          id?: string
          numeric_size?: string | null
          size_eu?: string | null
          size_label?: string | null
          size_uk?: string | null
          size_us?: string | null
          waist_cm_max?: number | null
          waist_cm_min?: number | null
        }
        Relationships: []
      }
      colors: {
        Row: {
          color_family: string | null
          created_at: string | null
          hex_code: string | null
          name_de: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru: string | null
          slug: string
        }
        Insert: {
          color_family?: string | null
          created_at?: string | null
          hex_code?: string | null
          name_de?: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru?: string | null
          slug: string
        }
        Update: {
          color_family?: string | null
          created_at?: string | null
          hex_code?: string | null
          name_de?: string | null
          name_en?: string
          name_fr?: string
          name_nl?: string
          name_ru?: string | null
          slug?: string
        }
        Relationships: []
      }
      cp_codes: {
        Row: {
          code: string
          created_at: string | null
          is_active: boolean | null
          name_en: string | null
          name_fr: string
          name_nl: string
          sector: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          is_active?: boolean | null
          name_en?: string | null
          name_fr: string
          name_nl: string
          sector?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          is_active?: boolean | null
          name_en?: string | null
          name_fr?: string
          name_nl?: string
          sector?: string | null
        }
        Relationships: []
      }
      device_brands: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          slug: string
          website: string | null
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          slug: string
          website?: string | null
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          slug?: string
          website?: string | null
        }
        Relationships: []
      }
      device_models: {
        Row: {
          brand_id: string
          created_at: string | null
          device_type: string
          discontinued: boolean | null
          id: string
          name: string
          release_year: number | null
          slug: string
          specs: Json | null
        }
        Insert: {
          brand_id: string
          created_at?: string | null
          device_type: string
          discontinued?: boolean | null
          id?: string
          name: string
          release_year?: number | null
          slug: string
          specs?: Json | null
        }
        Update: {
          brand_id?: string
          created_at?: string | null
          device_type?: string
          discontinued?: boolean | null
          id?: string
          name?: string
          release_year?: number | null
          slug?: string
          specs?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "device_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "device_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      drive_types: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
        }
        Relationships: []
      }
      engine_types: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          id: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
        }
        Relationships: []
      }
      epc_ratings: {
        Row: {
          code: string
          color: string
          description_en: string | null
          description_fr: string | null
          description_nl: string | null
          label: string
          max_kwh_per_sqm_year: number | null
          sort_order: number
        }
        Insert: {
          code: string
          color: string
          description_en?: string | null
          description_fr?: string | null
          description_nl?: string | null
          label: string
          max_kwh_per_sqm_year?: number | null
          sort_order: number
        }
        Update: {
          code?: string
          color?: string
          description_en?: string | null
          description_fr?: string | null
          description_nl?: string | null
          label?: string
          max_kwh_per_sqm_year?: number | null
          sort_order?: number
        }
        Relationships: []
      }
      fashion_brands: {
        Row: {
          country: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          segment: string | null
          slug: string
        }
        Insert: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          segment?: string | null
          slug: string
        }
        Update: {
          country?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          segment?: string | null
          slug?: string
        }
        Relationships: []
      }
      favorites: {
        Row: {
          advert_id: string
          created_at: string | null
          user_id: string
        }
        Insert: {
          advert_id: string
          created_at?: string | null
          user_id: string
        }
        Update: {
          advert_id?: string
          created_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: false
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
        ]
      }
      job_categories: {
        Row: {
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_de: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru: string | null
          parent_id: string | null
          slug: string
        }
        Insert: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_de?: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru?: string | null
          parent_id?: string | null
          slug: string
        }
        Update: {
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_de?: string | null
          name_en?: string
          name_fr?: string
          name_nl?: string
          name_ru?: string | null
          parent_id?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      job_contract_types: {
        Row: {
          code: string
          created_at: string | null
          description_en: string | null
          description_fr: string | null
          description_nl: string | null
          id: string
          is_active: boolean | null
          name_de: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru: string | null
          sort_order: number
        }
        Insert: {
          code: string
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean | null
          name_de?: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru?: string | null
          sort_order: number
        }
        Update: {
          code?: string
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_nl?: string | null
          id?: string
          is_active?: boolean | null
          name_de?: string | null
          name_en?: string
          name_fr?: string
          name_nl?: string
          name_ru?: string | null
          sort_order?: number
        }
        Relationships: []
      }
      job_listings: {
        Row: {
          advert_id: string
          application_deadline: string | null
          application_url: string | null
          benefits: string[] | null
          company_name: string | null
          company_size: string | null
          contact_email: string | null
          contact_phone: string | null
          contract_type_id: string | null
          cp_code: string | null
          created_at: string | null
          driving_license_required: boolean | null
          education_level: string | null
          employment_type: string
          experience_years_min: number | null
          flexible_hours: boolean | null
          hours_per_week: number | null
          industry: string | null
          job_category_id: string | null
          languages_preferred: string[] | null
          languages_required: string[] | null
          license_types: string[] | null
          night_shifts: boolean | null
          remote_option: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_negotiable: boolean | null
          salary_period: string | null
          salary_type: string | null
          shift_work: boolean | null
          start_date: string | null
          updated_at: string | null
          weekend_work: boolean | null
          work_permit_required: boolean | null
          work_permit_sponsored: boolean | null
        }
        Insert: {
          advert_id: string
          application_deadline?: string | null
          application_url?: string | null
          benefits?: string[] | null
          company_name?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contract_type_id?: string | null
          cp_code?: string | null
          created_at?: string | null
          driving_license_required?: boolean | null
          education_level?: string | null
          employment_type: string
          experience_years_min?: number | null
          flexible_hours?: boolean | null
          hours_per_week?: number | null
          industry?: string | null
          job_category_id?: string | null
          languages_preferred?: string[] | null
          languages_required?: string[] | null
          license_types?: string[] | null
          night_shifts?: boolean | null
          remote_option?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_negotiable?: boolean | null
          salary_period?: string | null
          salary_type?: string | null
          shift_work?: boolean | null
          start_date?: string | null
          updated_at?: string | null
          weekend_work?: boolean | null
          work_permit_required?: boolean | null
          work_permit_sponsored?: boolean | null
        }
        Update: {
          advert_id?: string
          application_deadline?: string | null
          application_url?: string | null
          benefits?: string[] | null
          company_name?: string | null
          company_size?: string | null
          contact_email?: string | null
          contact_phone?: string | null
          contract_type_id?: string | null
          cp_code?: string | null
          created_at?: string | null
          driving_license_required?: boolean | null
          education_level?: string | null
          employment_type?: string
          experience_years_min?: number | null
          flexible_hours?: boolean | null
          hours_per_week?: number | null
          industry?: string | null
          job_category_id?: string | null
          languages_preferred?: string[] | null
          languages_required?: string[] | null
          license_types?: string[] | null
          night_shifts?: boolean | null
          remote_option?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_negotiable?: boolean | null
          salary_period?: string | null
          salary_type?: string | null
          shift_work?: boolean | null
          start_date?: string | null
          updated_at?: string | null
          weekend_work?: boolean | null
          work_permit_required?: boolean | null
          work_permit_sponsored?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "job_listings_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: true
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "job_contract_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_cp_code_fkey"
            columns: ["cp_code"]
            isOneToOne: false
            referencedRelation: "cp_codes"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "job_listings_job_category_id_fkey"
            columns: ["job_category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          city: string | null
          country: string | null
          id: string
          point: unknown
          postcode: string | null
          region: string | null
        }
        Insert: {
          city?: string | null
          country?: string | null
          id?: string
          point?: unknown
          postcode?: string | null
          region?: string | null
        }
        Update: {
          city?: string | null
          country?: string | null
          id?: string
          point?: unknown
          postcode?: string | null
          region?: string | null
        }
        Relationships: []
      }
      logs: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          id: number
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          id?: number
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          id?: number
          user_id?: string | null
        }
        Relationships: []
      }
      materials: {
        Row: {
          category: string | null
          created_at: string | null
          name_de: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru: string | null
          slug: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          name_de?: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru?: string | null
          slug: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          name_de?: string | null
          name_en?: string
          name_fr?: string
          name_nl?: string
          name_ru?: string | null
          slug?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          advert_id: string
          created_at: string | null
          h: number | null
          id: string
          sort: number | null
          url: string
          w: number | null
        }
        Insert: {
          advert_id: string
          created_at?: string | null
          h?: number | null
          id?: string
          sort?: number | null
          url: string
          w?: number | null
        }
        Update: {
          advert_id?: string
          created_at?: string | null
          h?: number | null
          id?: string
          sort?: number | null
          url?: string
          w?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: false
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
        ]
      }
      memory_options: {
        Row: {
          category: string
          sort_order: number
          value: string
          value_bytes: number
        }
        Insert: {
          category: string
          sort_order: number
          value: string
          value_bytes: number
        }
        Update: {
          category?: string
          sort_order?: number
          value?: string
          value_bytes?: number
        }
        Relationships: []
      }
      pet_species_legal: {
        Row: {
          breed_restrictions: boolean | null
          category: string
          common_name_en: string
          common_name_fr: string
          common_name_nl: string
          created_at: string | null
          legal_status: string
          microchip_required: boolean | null
          notes_en: string | null
          notes_fr: string | null
          notes_nl: string | null
          registration_required: boolean | null
          species: string
        }
        Insert: {
          breed_restrictions?: boolean | null
          category: string
          common_name_en: string
          common_name_fr: string
          common_name_nl: string
          created_at?: string | null
          legal_status: string
          microchip_required?: boolean | null
          notes_en?: string | null
          notes_fr?: string | null
          notes_nl?: string | null
          registration_required?: boolean | null
          species: string
        }
        Update: {
          breed_restrictions?: boolean | null
          category?: string
          common_name_en?: string
          common_name_fr?: string
          common_name_nl?: string
          created_at?: string | null
          legal_status?: string
          microchip_required?: boolean | null
          notes_en?: string | null
          notes_fr?: string | null
          notes_nl?: string | null
          registration_required?: boolean | null
          species?: string
        }
        Relationships: []
      }
      phone_otps: {
        Row: {
          attempts: number
          code_hash: string
          code_last_four: string
          code_salt: string
          created_at: string
          e164: string
          expires_at: string
          id: number
          used: boolean
          user_id: string | null
        }
        Insert: {
          attempts?: number
          code_hash: string
          code_last_four: string
          code_salt: string
          created_at?: string
          e164: string
          expires_at: string
          id?: number
          used?: boolean
          user_id?: string | null
        }
        Update: {
          attempts?: number
          code_hash?: string
          code_last_four?: string
          code_salt?: string
          created_at?: string
          e164?: string
          expires_at?: string
          id?: number
          used?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      phones: {
        Row: {
          e164: string
          lookup: Json | null
          updated_at: string
          user_id: string
          verified: boolean
        }
        Insert: {
          e164: string
          lookup?: Json | null
          updated_at?: string
          user_id: string
          verified?: boolean
        }
        Update: {
          e164?: string
          lookup?: Json | null
          updated_at?: string
          user_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          consents: Json | null
          created_at: string | null
          display_name: string | null
          id: string
          phone: string | null
          rating: number | null
          total_deals: number | null
          verified_email: boolean | null
          verified_phone: boolean | null
        }
        Insert: {
          consents?: Json | null
          created_at?: string | null
          display_name?: string | null
          id: string
          phone?: string | null
          rating?: number | null
          total_deals?: number | null
          verified_email?: boolean | null
          verified_phone?: boolean | null
        }
        Update: {
          consents?: Json | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          phone?: string | null
          rating?: number | null
          total_deals?: number | null
          verified_email?: boolean | null
          verified_phone?: boolean | null
        }
        Relationships: []
      }
      property_listings: {
        Row: {
          advert_id: string
          area_sqm: number
          attic: boolean | null
          available_from: string | null
          bathrooms: number | null
          bedrooms: number | null
          cadastral_reference: string | null
          cellar: boolean | null
          created_at: string | null
          deposit_months: number | null
          double_glazing: boolean | null
          elevator: boolean | null
          epc_cert_number: string | null
          epc_kwh_per_sqm_year: number | null
          epc_rating: string | null
          floor: number | null
          furnished: string | null
          garden_orientation: string | null
          garden_sqm: number | null
          heating_type: string[] | null
          land_area_sqm: number | null
          land_registry_number: string | null
          lease_duration_months: number | null
          listing_type: string
          municipality: string
          neighborhood: string | null
          notary_name: string | null
          parking_spaces: number | null
          parking_type: string[] | null
          peb_url: string | null
          pet_friendly: boolean | null
          postcode: string
          property_type_id: string | null
          renovation_year: number | null
          rent_charges_monthly: number | null
          rent_monthly: number | null
          rooms: number | null
          smoking_allowed: boolean | null
          syndic_cost_monthly: number | null
          terrace_sqm: number | null
          total_floors: number | null
          updated_at: string | null
          water_heater_type: string | null
          year_built: number | null
        }
        Insert: {
          advert_id: string
          area_sqm: number
          attic?: boolean | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          cadastral_reference?: string | null
          cellar?: boolean | null
          created_at?: string | null
          deposit_months?: number | null
          double_glazing?: boolean | null
          elevator?: boolean | null
          epc_cert_number?: string | null
          epc_kwh_per_sqm_year?: number | null
          epc_rating?: string | null
          floor?: number | null
          furnished?: string | null
          garden_orientation?: string | null
          garden_sqm?: number | null
          heating_type?: string[] | null
          land_area_sqm?: number | null
          land_registry_number?: string | null
          lease_duration_months?: number | null
          listing_type: string
          municipality: string
          neighborhood?: string | null
          notary_name?: string | null
          parking_spaces?: number | null
          parking_type?: string[] | null
          peb_url?: string | null
          pet_friendly?: boolean | null
          postcode: string
          property_type_id?: string | null
          renovation_year?: number | null
          rent_charges_monthly?: number | null
          rent_monthly?: number | null
          rooms?: number | null
          smoking_allowed?: boolean | null
          syndic_cost_monthly?: number | null
          terrace_sqm?: number | null
          total_floors?: number | null
          updated_at?: string | null
          water_heater_type?: string | null
          year_built?: number | null
        }
        Update: {
          advert_id?: string
          area_sqm?: number
          attic?: boolean | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          cadastral_reference?: string | null
          cellar?: boolean | null
          created_at?: string | null
          deposit_months?: number | null
          double_glazing?: boolean | null
          elevator?: boolean | null
          epc_cert_number?: string | null
          epc_kwh_per_sqm_year?: number | null
          epc_rating?: string | null
          floor?: number | null
          furnished?: string | null
          garden_orientation?: string | null
          garden_sqm?: number | null
          heating_type?: string[] | null
          land_area_sqm?: number | null
          land_registry_number?: string | null
          lease_duration_months?: number | null
          listing_type?: string
          municipality?: string
          neighborhood?: string | null
          notary_name?: string | null
          parking_spaces?: number | null
          parking_type?: string[] | null
          peb_url?: string | null
          pet_friendly?: boolean | null
          postcode?: string
          property_type_id?: string | null
          renovation_year?: number | null
          rent_charges_monthly?: number | null
          rent_monthly?: number | null
          rooms?: number | null
          smoking_allowed?: boolean | null
          syndic_cost_monthly?: number | null
          terrace_sqm?: number | null
          total_floors?: number | null
          updated_at?: string | null
          water_heater_type?: string | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_listings_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: true
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_listings_epc_rating_fkey"
            columns: ["epc_rating"]
            isOneToOne: false
            referencedRelation: "epc_ratings"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "property_listings_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      property_types: {
        Row: {
          category: string
          created_at: string | null
          icon: string | null
          id: string
          is_active: boolean | null
          name_de: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru: string | null
          slug: string
        }
        Insert: {
          category: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_de?: string | null
          name_en: string
          name_fr: string
          name_nl: string
          name_ru?: string | null
          slug: string
        }
        Update: {
          category?: string
          created_at?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean | null
          name_de?: string | null
          name_en?: string
          name_fr?: string
          name_nl?: string
          name_ru?: string | null
          slug?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          advert_id: string
          created_at: string | null
          details: string | null
          id: number
          reason: string
          reporter: string
          reviewed_by: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          advert_id: string
          created_at?: string | null
          details?: string | null
          id?: number
          reason: string
          reporter: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          advert_id?: string
          created_at?: string | null
          details?: string | null
          id?: number
          reason?: string
          reporter?: string
          reviewed_by?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: false
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_standards: {
        Row: {
          applies_to: string[] | null
          authority: string | null
          code: string
          created_at: string | null
          description_en: string | null
          description_fr: string | null
          description_nl: string | null
          name: string
          required_for: string[] | null
          url: string | null
        }
        Insert: {
          applies_to?: string[] | null
          authority?: string | null
          code: string
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_nl?: string | null
          name: string
          required_for?: string[] | null
          url?: string | null
        }
        Update: {
          applies_to?: string[] | null
          authority?: string | null
          code?: string
          created_at?: string | null
          description_en?: string | null
          description_fr?: string | null
          description_nl?: string | null
          name?: string
          required_for?: string[] | null
          url?: string | null
        }
        Relationships: []
      }
      spatial_ref_sys: {
        Row: {
          auth_name: string | null
          auth_srid: number | null
          proj4text: string | null
          srid: number
          srtext: string | null
        }
        Insert: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid: number
          srtext?: string | null
        }
        Update: {
          auth_name?: string | null
          auth_srid?: number | null
          proj4text?: string | null
          srid?: number
          srtext?: string | null
        }
        Relationships: []
      }
      steering_wheel: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
        }
        Relationships: []
      }
      storage_options: {
        Row: {
          category: string
          obsolete: boolean | null
          sort_order: number
          value: string
          value_bytes: number
        }
        Insert: {
          category: string
          obsolete?: boolean | null
          sort_order: number
          value: string
          value_bytes: number
        }
        Update: {
          category?: string
          obsolete?: boolean | null
          sort_order?: number
          value?: string
          value_bytes?: number
        }
        Relationships: []
      }
      trust_score: {
        Row: {
          score: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          score?: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          score?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      vehicle_colors: {
        Row: {
          code: string
          created_at: string | null
          hex_code: string | null
          id: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
        }
        Insert: {
          code: string
          created_at?: string | null
          hex_code?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
        }
        Update: {
          code?: string
          created_at?: string | null
          hex_code?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
        }
        Relationships: []
      }
      vehicle_conditions: {
        Row: {
          code: string
          created_at: string | null
          id: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
        }
        Relationships: []
      }
      vehicle_doors: {
        Row: {
          count: number
          created_at: string | null
          id: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
        }
        Insert: {
          count: number
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
        }
        Update: {
          count?: number
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
        }
        Relationships: []
      }
      vehicle_generation_i18n: {
        Row: {
          common_issues: string[]
          cons: string[]
          created_at: string
          generation_id: string
          inspection_tips: string[]
          locale: string
          pros: string[]
          summary: string | null
        }
        Insert: {
          common_issues?: string[]
          cons?: string[]
          created_at?: string
          generation_id: string
          inspection_tips?: string[]
          locale: string
          pros?: string[]
          summary?: string | null
        }
        Update: {
          common_issues?: string[]
          cons?: string[]
          created_at?: string
          generation_id?: string
          inspection_tips?: string[]
          locale?: string
          pros?: string[]
          summary?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_generation_i18n_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "vehicle_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_generation_insights: {
        Row: {
          common_issues: string[] | null
          cons: string[] | null
          created_at: string
          engine_examples: string[] | null
          generation_id: string
          inspection_tips: string[] | null
          notable_features: string[] | null
          popularity_score: number | null
          pros: string[] | null
          reliability_score: number | null
        }
        Insert: {
          common_issues?: string[] | null
          cons?: string[] | null
          created_at?: string
          engine_examples?: string[] | null
          generation_id: string
          inspection_tips?: string[] | null
          notable_features?: string[] | null
          popularity_score?: number | null
          pros?: string[] | null
          reliability_score?: number | null
        }
        Update: {
          common_issues?: string[] | null
          cons?: string[] | null
          created_at?: string
          engine_examples?: string[] | null
          generation_id?: string
          inspection_tips?: string[] | null
          notable_features?: string[] | null
          popularity_score?: number | null
          pros?: string[] | null
          reliability_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_generation_insights_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: true
            referencedRelation: "vehicle_generations"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_generation_insights_i18n: {
        Row: {
          common_issues: string[] | null
          cons: string[] | null
          created_at: string
          engine_examples: string[] | null
          generation_id: string
          inspection_tips: string[] | null
          locale: string
          notable_features: string[] | null
          pros: string[] | null
        }
        Insert: {
          common_issues?: string[] | null
          cons?: string[] | null
          created_at?: string
          engine_examples?: string[] | null
          generation_id: string
          inspection_tips?: string[] | null
          locale: string
          notable_features?: string[] | null
          pros?: string[] | null
        }
        Update: {
          common_issues?: string[] | null
          cons?: string[] | null
          created_at?: string
          engine_examples?: string[] | null
          generation_id?: string
          inspection_tips?: string[] | null
          locale?: string
          notable_features?: string[] | null
          pros?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_generation_insights_i18n_generation_id_fkey"
            columns: ["generation_id"]
            isOneToOne: false
            referencedRelation: "vehicle_generation_insights"
            referencedColumns: ["generation_id"]
          },
        ]
      }
      vehicle_generations: {
        Row: {
          body_types: Json | null
          code: string | null
          end_year: number | null
          facelift: boolean | null
          fuel_types: Json | null
          id: string
          model_id: string | null
          name_en: string | null
          name_ru: string | null
          production_countries: string[] | null
          start_year: number | null
          summary: string | null
          transmission_types: Json | null
        }
        Insert: {
          body_types?: Json | null
          code?: string | null
          end_year?: number | null
          facelift?: boolean | null
          fuel_types?: Json | null
          id: string
          model_id?: string | null
          name_en?: string | null
          name_ru?: string | null
          production_countries?: string[] | null
          start_year?: number | null
          summary?: string | null
          transmission_types?: Json | null
        }
        Update: {
          body_types?: Json | null
          code?: string | null
          end_year?: number | null
          facelift?: boolean | null
          fuel_types?: Json | null
          id?: string
          model_id?: string | null
          name_en?: string | null
          name_ru?: string | null
          production_countries?: string[] | null
          start_year?: number | null
          summary?: string | null
          transmission_types?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_generations_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_insights: {
        Row: {
          common_issues_by_engine: Json | null
          cons: Json | null
          engine_examples: Json | null
          inspection_tips: Json | null
          model_id: string
          notable_features: Json | null
          popularity_score: number | null
          pros: Json | null
          reliability_score: number | null
        }
        Insert: {
          common_issues_by_engine?: Json | null
          cons?: Json | null
          engine_examples?: Json | null
          inspection_tips?: Json | null
          model_id: string
          notable_features?: Json | null
          popularity_score?: number | null
          pros?: Json | null
          reliability_score?: number | null
        }
        Update: {
          common_issues_by_engine?: Json | null
          cons?: Json | null
          engine_examples?: Json | null
          inspection_tips?: Json | null
          model_id?: string
          notable_features?: Json | null
          popularity_score?: number | null
          pros?: Json | null
          reliability_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_insights_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: true
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_insights_i18n: {
        Row: {
          common_issues: string[] | null
          cons: string[] | null
          created_at: string | null
          engine_examples: string[] | null
          inspection_tips: string[] | null
          locale: string
          model_id: string
          notable_features: string[] | null
          pros: string[] | null
        }
        Insert: {
          common_issues?: string[] | null
          cons?: string[] | null
          created_at?: string | null
          engine_examples?: string[] | null
          inspection_tips?: string[] | null
          locale: string
          model_id: string
          notable_features?: string[] | null
          pros?: string[] | null
        }
        Update: {
          common_issues?: string[] | null
          cons?: string[] | null
          created_at?: string | null
          engine_examples?: string[] | null
          inspection_tips?: string[] | null
          locale?: string
          model_id?: string
          notable_features?: string[] | null
          pros?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_insights_i18n_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_make_i18n: {
        Row: {
          created_at: string
          locale: string
          make_id: string
          name: string
          synonyms: string[]
        }
        Insert: {
          created_at?: string
          locale: string
          make_id: string
          name: string
          synonyms?: string[]
        }
        Update: {
          created_at?: string
          locale?: string
          make_id?: string
          name?: string
          synonyms?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_make_i18n_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "vehicle_makes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_makes: {
        Row: {
          category_path: string | null
          country: string | null
          id: string
          is_active: boolean | null
          name_en: string
          segment_class: string | null
          slug: string
        }
        Insert: {
          category_path?: string | null
          country?: string | null
          id: string
          is_active?: boolean | null
          name_en: string
          segment_class?: string | null
          slug: string
        }
        Update: {
          category_path?: string | null
          country?: string | null
          id?: string
          is_active?: boolean | null
          name_en?: string
          segment_class?: string | null
          slug?: string
        }
        Relationships: []
      }
      vehicle_model_i18n: {
        Row: {
          created_at: string
          locale: string
          model_id: string
          name: string
          synonyms: string[]
        }
        Insert: {
          created_at?: string
          locale: string
          model_id: string
          name: string
          synonyms?: string[]
        }
        Update: {
          created_at?: string
          locale?: string
          model_id?: string
          name?: string
          synonyms?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_model_i18n_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "vehicle_models"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_models: {
        Row: {
          body_types_available: Json | null
          first_model_year: number | null
          fuel_types_available: Json | null
          id: string
          last_model_year: number | null
          make_id: string | null
          name_en: string
          popularity_score: number | null
          reliability_score: number | null
          slug: string
          transmission_available: Json | null
          years_available: number[] | null
        }
        Insert: {
          body_types_available?: Json | null
          first_model_year?: number | null
          fuel_types_available?: Json | null
          id: string
          last_model_year?: number | null
          make_id?: string | null
          name_en: string
          popularity_score?: number | null
          reliability_score?: number | null
          slug: string
          transmission_available?: Json | null
          years_available?: number[] | null
        }
        Update: {
          body_types_available?: Json | null
          first_model_year?: number | null
          fuel_types_available?: Json | null
          id?: string
          last_model_year?: number | null
          make_id?: string | null
          name_en?: string
          popularity_score?: number | null
          reliability_score?: number | null
          slug?: string
          transmission_available?: Json | null
          years_available?: number[] | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_models_make_id_fkey"
            columns: ["make_id"]
            isOneToOne: false
            referencedRelation: "vehicle_makes"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_options: {
        Row: {
          category: string
          code: string
          created_at: string | null
          id: string
          name_de: string | null
          name_en: string | null
          name_fr: string | null
          name_nl: string | null
          name_ru: string
          variants: Json | null
        }
        Insert: {
          category: string
          code: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru: string
          variants?: Json | null
        }
        Update: {
          category?: string
          code?: string
          created_at?: string | null
          id?: string
          name_de?: string | null
          name_en?: string | null
          name_fr?: string | null
          name_nl?: string | null
          name_ru?: string
          variants?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      category_advert_counts: {
        Row: {
          advert_count: number | null
          category_id: string | null
          is_active: boolean | null
          last_refreshed_at: string | null
          level: number | null
          parent_id: string | null
          slug: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "category_advert_counts"
            referencedColumns: ["category_id"]
          },
        ]
      }
      geography_columns: {
        Row: {
          coord_dimension: number | null
          f_geography_column: unknown
          f_table_catalog: unknown
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Relationships: []
      }
      geometry_columns: {
        Row: {
          coord_dimension: number | null
          f_geometry_column: unknown
          f_table_catalog: string | null
          f_table_name: unknown
          f_table_schema: unknown
          srid: number | null
          type: string | null
        }
        Insert: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Update: {
          coord_dimension?: number | null
          f_geometry_column?: unknown
          f_table_catalog?: string | null
          f_table_name?: unknown
          f_table_schema?: unknown
          srid?: number | null
          type?: string | null
        }
        Relationships: []
      }
      job_listings_public: {
        Row: {
          advert_id: string | null
          application_deadline: string | null
          benefits: string[] | null
          company_name: string | null
          company_size: string | null
          contact_email: string | null
          contract_type_id: string | null
          created_at: string | null
          driving_license_required: boolean | null
          education_level: string | null
          employment_type: string | null
          experience_years_min: number | null
          hours_per_week: number | null
          industry: string | null
          job_category_id: string | null
          languages_required: string[] | null
          remote_option: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: string | null
          salary_type: string | null
          start_date: string | null
          work_permit_required: boolean | null
          work_permit_sponsored: boolean | null
        }
        Insert: {
          advert_id?: string | null
          application_deadline?: string | null
          benefits?: string[] | null
          company_name?: string | null
          company_size?: string | null
          contact_email?: never
          contract_type_id?: string | null
          created_at?: string | null
          driving_license_required?: boolean | null
          education_level?: string | null
          employment_type?: string | null
          experience_years_min?: number | null
          hours_per_week?: number | null
          industry?: string | null
          job_category_id?: string | null
          languages_required?: string[] | null
          remote_option?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          salary_type?: string | null
          start_date?: string | null
          work_permit_required?: boolean | null
          work_permit_sponsored?: boolean | null
        }
        Update: {
          advert_id?: string | null
          application_deadline?: string | null
          benefits?: string[] | null
          company_name?: string | null
          company_size?: string | null
          contact_email?: never
          contract_type_id?: string | null
          created_at?: string | null
          driving_license_required?: boolean | null
          education_level?: string | null
          employment_type?: string | null
          experience_years_min?: number | null
          hours_per_week?: number | null
          industry?: string | null
          job_category_id?: string | null
          languages_required?: string[] | null
          remote_option?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: string | null
          salary_type?: string | null
          start_date?: string | null
          work_permit_required?: boolean | null
          work_permit_sponsored?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "job_listings_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: true
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_contract_type_id_fkey"
            columns: ["contract_type_id"]
            isOneToOne: false
            referencedRelation: "job_contract_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_listings_job_category_id_fkey"
            columns: ["job_category_id"]
            isOneToOne: false
            referencedRelation: "job_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      property_listings_public: {
        Row: {
          advert_id: string | null
          area_sqm: number | null
          available_from: string | null
          bathrooms: number | null
          bedrooms: number | null
          created_at: string | null
          deposit_months: number | null
          double_glazing: boolean | null
          elevator: boolean | null
          epc_kwh_per_sqm_year: number | null
          epc_rating: string | null
          floor: number | null
          furnished: string | null
          garden_sqm: number | null
          heating_type: string[] | null
          land_area_sqm: number | null
          listing_type: string | null
          municipality: string | null
          parking_spaces: number | null
          pet_friendly: boolean | null
          postcode_area: string | null
          property_type_id: string | null
          rent_charges_monthly: number | null
          rent_monthly: number | null
          rooms: number | null
          syndic_cost_monthly: number | null
          terrace_sqm: number | null
          year_built: number | null
        }
        Insert: {
          advert_id?: string | null
          area_sqm?: number | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          deposit_months?: number | null
          double_glazing?: boolean | null
          elevator?: boolean | null
          epc_kwh_per_sqm_year?: number | null
          epc_rating?: string | null
          floor?: number | null
          furnished?: string | null
          garden_sqm?: number | null
          heating_type?: string[] | null
          land_area_sqm?: number | null
          listing_type?: string | null
          municipality?: string | null
          parking_spaces?: number | null
          pet_friendly?: boolean | null
          postcode_area?: never
          property_type_id?: string | null
          rent_charges_monthly?: number | null
          rent_monthly?: number | null
          rooms?: number | null
          syndic_cost_monthly?: number | null
          terrace_sqm?: number | null
          year_built?: number | null
        }
        Update: {
          advert_id?: string | null
          area_sqm?: number | null
          available_from?: string | null
          bathrooms?: number | null
          bedrooms?: number | null
          created_at?: string | null
          deposit_months?: number | null
          double_glazing?: boolean | null
          elevator?: boolean | null
          epc_kwh_per_sqm_year?: number | null
          epc_rating?: string | null
          floor?: number | null
          furnished?: string | null
          garden_sqm?: number | null
          heating_type?: string[] | null
          land_area_sqm?: number | null
          listing_type?: string | null
          municipality?: string | null
          parking_spaces?: number | null
          pet_friendly?: boolean | null
          postcode_area?: never
          property_type_id?: string | null
          rent_charges_monthly?: number | null
          rent_monthly?: number | null
          rooms?: number | null
          syndic_cost_monthly?: number | null
          terrace_sqm?: number | null
          year_built?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "property_listings_advert_id_fkey"
            columns: ["advert_id"]
            isOneToOne: true
            referencedRelation: "adverts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_listings_epc_rating_fkey"
            columns: ["epc_rating"]
            isOneToOne: false
            referencedRelation: "epc_ratings"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "property_listings_property_type_id_fkey"
            columns: ["property_type_id"]
            isOneToOne: false
            referencedRelation: "property_types"
            referencedColumns: ["id"]
          },
        ]
      }
      top_sellers: {
        Row: {
          active_adverts: number | null
          avg_views: number | null
          created_at: string | null
          display_name: string | null
          id: string | null
          rating: number | null
          total_deals: number | null
          trust_score: number | null
          verified_email: boolean | null
          verified_phone: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      _postgis_deprecate: {
        Args: { newname: string; oldname: string; version: string }
        Returns: undefined
      }
      _postgis_index_extent: {
        Args: { col: string; tbl: unknown }
        Returns: unknown
      }
      _postgis_pgsql_version: { Args: never; Returns: string }
      _postgis_scripts_pgsql_version: { Args: never; Returns: string }
      _postgis_selectivity: {
        Args: { att_name: string; geom: unknown; mode?: string; tbl: unknown }
        Returns: number
      }
      _postgis_stats: {
        Args: { ""?: string; att_name: string; tbl: unknown }
        Returns: string
      }
      _st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_crosses: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      _st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      _st_intersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      _st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      _st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      _st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_sortablehash: { Args: { geom: unknown }; Returns: number }
      _st_touches: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      _st_voronoi: {
        Args: {
          clip?: unknown
          g1: unknown
          return_polygons?: boolean
          tolerance?: number
        }
        Returns: unknown
      }
      _st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      addauth: { Args: { "": string }; Returns: boolean }
      addgeometrycolumn:
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              column_name: string
              new_dim: number
              new_srid: number
              new_type: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              catalog_name: string
              column_name: string
              new_dim: number
              new_srid_in: number
              new_type: string
              schema_name: string
              table_name: string
              use_typmod?: boolean
            }
            Returns: string
          }
      archive_expired_jobs: { Args: never; Returns: undefined }
      check_price_outlier: {
        Args: { category_slug: string; price: number; threshold_sigma?: number }
        Returns: boolean
      }
      disablelongtransactions: { Args: never; Returns: string }
      dropgeometrycolumn:
        | {
            Args: {
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
        | { Args: { column_name: string; table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              column_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      dropgeometrytable:
        | { Args: { schema_name: string; table_name: string }; Returns: string }
        | { Args: { table_name: string }; Returns: string }
        | {
            Args: {
              catalog_name: string
              schema_name: string
              table_name: string
            }
            Returns: string
          }
      enablelongtransactions: { Args: never; Returns: string }
      equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      geometry: { Args: { "": string }; Returns: unknown }
      geometry_above: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_below: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_cmp: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_contained_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_contains_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_distance_box: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_distance_centroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      geometry_eq: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_ge: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_gt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_le: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_left: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_lt: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overabove: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overbelow: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overlaps_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overleft: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_overright: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_right: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_same_3d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geometry_within: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      geomfromewkt: { Args: { "": string }; Returns: unknown }
      get_advert_favorite_count: {
        Args: { advert_id_param: string }
        Returns: number
      }
      get_advert_view_count: {
        Args: { advert_id_param: string }
        Returns: number
      }
      get_epc_max_consumption: { Args: { rating: string }; Returns: number }
      get_region_from_postcode: { Args: { postcode: string }; Returns: string }
      gettransactionid: { Args: never; Returns: unknown }
      is_admin: { Args: never; Returns: boolean }
      is_favorited: {
        Args: { advert_id_param: string; user_id_param: string }
        Returns: boolean
      }
      longtransactionsenabled: { Args: never; Returns: boolean }
      populate_geometry_columns:
        | { Args: { use_typmod?: boolean }; Returns: string }
        | { Args: { tbl_oid: unknown; use_typmod?: boolean }; Returns: number }
      postgis_constraint_dims: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_srid: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: number
      }
      postgis_constraint_type: {
        Args: { geomcolumn: string; geomschema: string; geomtable: string }
        Returns: string
      }
      postgis_extensions_upgrade: { Args: never; Returns: string }
      postgis_full_version: { Args: never; Returns: string }
      postgis_geos_version: { Args: never; Returns: string }
      postgis_lib_build_date: { Args: never; Returns: string }
      postgis_lib_revision: { Args: never; Returns: string }
      postgis_lib_version: { Args: never; Returns: string }
      postgis_libjson_version: { Args: never; Returns: string }
      postgis_liblwgeom_version: { Args: never; Returns: string }
      postgis_libprotobuf_version: { Args: never; Returns: string }
      postgis_libxml_version: { Args: never; Returns: string }
      postgis_proj_version: { Args: never; Returns: string }
      postgis_scripts_build_date: { Args: never; Returns: string }
      postgis_scripts_installed: { Args: never; Returns: string }
      postgis_scripts_released: { Args: never; Returns: string }
      postgis_svn_version: { Args: never; Returns: string }
      postgis_type_name: {
        Args: {
          coord_dimension: number
          geomname: string
          use_new_name?: boolean
        }
        Returns: string
      }
      postgis_version: { Args: never; Returns: string }
      postgis_wagyu_version: { Args: never; Returns: string }
      refresh_category_advert_counts: { Args: never; Returns: undefined }
      refresh_top_sellers: { Args: never; Returns: undefined }
      search_adverts: {
        Args: {
          category_id_filter?: string
          location_filter?: string
          location_lat?: number
          location_lng?: number
          page_limit?: number
          page_offset?: number
          price_max_filter?: number
          price_min_filter?: number
          radius_km?: number
          search_query?: string
          sort_by?: string
          verified_only?: boolean
        }
        Returns: {
          category_id: string
          condition: string
          created_at: string
          currency: string
          description: string
          id: string
          location: string
          location_id: string
          price: number
          relevance_rank: number
          seller_verified: boolean | null
          status: string
          title: string
          total_count: number
          updated_at: string
          user_id: string
        }[]
      }
      search_device_models: {
        Args: {
          p_brand_slug: string
          p_device_type: string
          p_limit?: number
          p_search_term?: string
        }
        Returns: {
          brand_name: string
          device_type: string
          id: string
          model_name: string
          release_year: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      st_3dclosestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3ddistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dintersects: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_3dlongestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmakebox: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_3dmaxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_3dshortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_addpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_angle:
        | { Args: { line1: unknown; line2: unknown }; Returns: number }
        | {
            Args: { pt1: unknown; pt2: unknown; pt3: unknown; pt4?: unknown }
            Returns: number
          }
      st_area:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_asencodedpolyline: {
        Args: { geom: unknown; nprecision?: number }
        Returns: string
      }
      st_asewkt: { Args: { "": string }; Returns: string }
      st_asgeojson:
        | {
            Args: {
              geom_column?: string
              maxdecimaldigits?: number
              pretty_bool?: boolean
              r: Record<string, unknown>
            }
            Returns: string
          }
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_asgml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
              version: number
            }
            Returns: string
          }
        | {
            Args: {
              geog: unknown
              id?: string
              maxdecimaldigits?: number
              nprefix?: string
              options?: number
            }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_askml:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; nprefix?: string }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_aslatlontext: {
        Args: { geom: unknown; tmpl?: string }
        Returns: string
      }
      st_asmarc21: { Args: { format?: string; geom: unknown }; Returns: string }
      st_asmvtgeom: {
        Args: {
          bounds: unknown
          buffer?: number
          clip_geom?: boolean
          extent?: number
          geom: unknown
        }
        Returns: unknown
      }
      st_assvg:
        | {
            Args: { geom: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | {
            Args: { geog: unknown; maxdecimaldigits?: number; rel?: number }
            Returns: string
          }
        | { Args: { "": string }; Returns: string }
      st_astext: { Args: { "": string }; Returns: string }
      st_astwkb:
        | {
            Args: {
              geom: unknown[]
              ids: number[]
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
        | {
            Args: {
              geom: unknown
              prec?: number
              prec_m?: number
              prec_z?: number
              with_boxes?: boolean
              with_sizes?: boolean
            }
            Returns: string
          }
      st_asx3d: {
        Args: { geom: unknown; maxdecimaldigits?: number; options?: number }
        Returns: string
      }
      st_azimuth:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: number }
      st_boundingdiagonal: {
        Args: { fits?: boolean; geom: unknown }
        Returns: unknown
      }
      st_buffer:
        | {
            Args: { geom: unknown; options?: string; radius: number }
            Returns: unknown
          }
        | {
            Args: { geom: unknown; quadsegs: number; radius: number }
            Returns: unknown
          }
      st_centroid: { Args: { "": string }; Returns: unknown }
      st_clipbybox2d: {
        Args: { box: unknown; geom: unknown }
        Returns: unknown
      }
      st_closestpoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_collect: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_concavehull: {
        Args: {
          param_allow_holes?: boolean
          param_geom: unknown
          param_pctconvex: number
        }
        Returns: unknown
      }
      st_contains: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_containsproperly: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_coorddim: { Args: { geometry: unknown }; Returns: number }
      st_coveredby:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_covers:
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_crosses: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_curvetoline: {
        Args: { flags?: number; geom: unknown; tol?: number; toltype?: number }
        Returns: unknown
      }
      st_delaunaytriangles: {
        Args: { flags?: number; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_difference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_disjoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_distance:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geog1: unknown; geog2: unknown; use_spheroid?: boolean }
            Returns: number
          }
      st_distancesphere:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: number }
        | {
            Args: { geom1: unknown; geom2: unknown; radius: number }
            Returns: number
          }
      st_distancespheroid: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_dwithin: {
        Args: {
          geog1: unknown
          geog2: unknown
          tolerance: number
          use_spheroid?: boolean
        }
        Returns: boolean
      }
      st_equals: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_expand:
        | {
            Args: {
              dm?: number
              dx: number
              dy: number
              dz?: number
              geom: unknown
            }
            Returns: unknown
          }
        | {
            Args: { box: unknown; dx: number; dy: number; dz?: number }
            Returns: unknown
          }
        | { Args: { box: unknown; dx: number; dy: number }; Returns: unknown }
      st_force3d: { Args: { geom: unknown; zvalue?: number }; Returns: unknown }
      st_force3dm: {
        Args: { geom: unknown; mvalue?: number }
        Returns: unknown
      }
      st_force3dz: {
        Args: { geom: unknown; zvalue?: number }
        Returns: unknown
      }
      st_force4d: {
        Args: { geom: unknown; mvalue?: number; zvalue?: number }
        Returns: unknown
      }
      st_generatepoints:
        | { Args: { area: unknown; npoints: number }; Returns: unknown }
        | {
            Args: { area: unknown; npoints: number; seed: number }
            Returns: unknown
          }
      st_geogfromtext: { Args: { "": string }; Returns: unknown }
      st_geographyfromtext: { Args: { "": string }; Returns: unknown }
      st_geohash:
        | { Args: { geom: unknown; maxchars?: number }; Returns: string }
        | { Args: { geog: unknown; maxchars?: number }; Returns: string }
      st_geomcollfromtext: { Args: { "": string }; Returns: unknown }
      st_geometricmedian: {
        Args: {
          fail_if_not_converged?: boolean
          g: unknown
          max_iter?: number
          tolerance?: number
        }
        Returns: unknown
      }
      st_geometryfromtext: { Args: { "": string }; Returns: unknown }
      st_geomfromewkt: { Args: { "": string }; Returns: unknown }
      st_geomfromgeojson:
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": Json }; Returns: unknown }
        | { Args: { "": string }; Returns: unknown }
      st_geomfromgml: { Args: { "": string }; Returns: unknown }
      st_geomfromkml: { Args: { "": string }; Returns: unknown }
      st_geomfrommarc21: { Args: { marc21xml: string }; Returns: unknown }
      st_geomfromtext: { Args: { "": string }; Returns: unknown }
      st_gmltosql: { Args: { "": string }; Returns: unknown }
      st_hasarc: { Args: { geometry: unknown }; Returns: boolean }
      st_hausdorffdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_hexagon: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_hexagongrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_interpolatepoint: {
        Args: { line: unknown; point: unknown }
        Returns: number
      }
      st_intersection: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_intersects:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
        | { Args: { geog1: unknown; geog2: unknown }; Returns: boolean }
      st_isvaliddetail: {
        Args: { flags?: number; geom: unknown }
        Returns: Database["public"]["CompositeTypes"]["valid_detail"]
        SetofOptions: {
          from: "*"
          to: "valid_detail"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      st_length:
        | { Args: { geog: unknown; use_spheroid?: boolean }; Returns: number }
        | { Args: { "": string }; Returns: number }
      st_letters: { Args: { font?: Json; letters: string }; Returns: unknown }
      st_linecrossingdirection: {
        Args: { line1: unknown; line2: unknown }
        Returns: number
      }
      st_linefromencodedpolyline: {
        Args: { nprecision?: number; txtin: string }
        Returns: unknown
      }
      st_linefromtext: { Args: { "": string }; Returns: unknown }
      st_linelocatepoint: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_linetocurve: { Args: { geometry: unknown }; Returns: unknown }
      st_locatealong: {
        Args: { geometry: unknown; leftrightoffset?: number; measure: number }
        Returns: unknown
      }
      st_locatebetween: {
        Args: {
          frommeasure: number
          geometry: unknown
          leftrightoffset?: number
          tomeasure: number
        }
        Returns: unknown
      }
      st_locatebetweenelevations: {
        Args: { fromelevation: number; geometry: unknown; toelevation: number }
        Returns: unknown
      }
      st_longestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makebox2d: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makeline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_makevalid: {
        Args: { geom: unknown; params: string }
        Returns: unknown
      }
      st_maxdistance: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: number
      }
      st_minimumboundingcircle: {
        Args: { inputgeom: unknown; segs_per_quarter?: number }
        Returns: unknown
      }
      st_mlinefromtext: { Args: { "": string }; Returns: unknown }
      st_mpointfromtext: { Args: { "": string }; Returns: unknown }
      st_mpolyfromtext: { Args: { "": string }; Returns: unknown }
      st_multilinestringfromtext: { Args: { "": string }; Returns: unknown }
      st_multipointfromtext: { Args: { "": string }; Returns: unknown }
      st_multipolygonfromtext: { Args: { "": string }; Returns: unknown }
      st_node: { Args: { g: unknown }; Returns: unknown }
      st_normalize: { Args: { geom: unknown }; Returns: unknown }
      st_offsetcurve: {
        Args: { distance: number; line: unknown; params?: string }
        Returns: unknown
      }
      st_orderingequals: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_overlaps: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: boolean
      }
      st_perimeter: {
        Args: { geog: unknown; use_spheroid?: boolean }
        Returns: number
      }
      st_pointfromtext: { Args: { "": string }; Returns: unknown }
      st_pointm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
        }
        Returns: unknown
      }
      st_pointz: {
        Args: {
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_pointzm: {
        Args: {
          mcoordinate: number
          srid?: number
          xcoordinate: number
          ycoordinate: number
          zcoordinate: number
        }
        Returns: unknown
      }
      st_polyfromtext: { Args: { "": string }; Returns: unknown }
      st_polygonfromtext: { Args: { "": string }; Returns: unknown }
      st_project: {
        Args: { azimuth: number; distance: number; geog: unknown }
        Returns: unknown
      }
      st_quantizecoordinates: {
        Args: {
          g: unknown
          prec_m?: number
          prec_x: number
          prec_y?: number
          prec_z?: number
        }
        Returns: unknown
      }
      st_reduceprecision: {
        Args: { geom: unknown; gridsize: number }
        Returns: unknown
      }
      st_relate: { Args: { geom1: unknown; geom2: unknown }; Returns: string }
      st_removerepeatedpoints: {
        Args: { geom: unknown; tolerance?: number }
        Returns: unknown
      }
      st_segmentize: {
        Args: { geog: unknown; max_segment_length: number }
        Returns: unknown
      }
      st_setsrid:
        | { Args: { geom: unknown; srid: number }; Returns: unknown }
        | { Args: { geog: unknown; srid: number }; Returns: unknown }
      st_sharedpaths: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_shortestline: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_simplifypolygonhull: {
        Args: { geom: unknown; is_outer?: boolean; vertex_fraction: number }
        Returns: unknown
      }
      st_split: { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
      st_square: {
        Args: { cell_i: number; cell_j: number; origin?: unknown; size: number }
        Returns: unknown
      }
      st_squaregrid: {
        Args: { bounds: unknown; size: number }
        Returns: Record<string, unknown>[]
      }
      st_srid:
        | { Args: { geom: unknown }; Returns: number }
        | { Args: { geog: unknown }; Returns: number }
      st_subdivide: {
        Args: { geom: unknown; gridsize?: number; maxvertices?: number }
        Returns: unknown[]
      }
      st_swapordinates: {
        Args: { geom: unknown; ords: unknown }
        Returns: unknown
      }
      st_symdifference: {
        Args: { geom1: unknown; geom2: unknown; gridsize?: number }
        Returns: unknown
      }
      st_symmetricdifference: {
        Args: { geom1: unknown; geom2: unknown }
        Returns: unknown
      }
      st_tileenvelope: {
        Args: {
          bounds?: unknown
          margin?: number
          x: number
          y: number
          zoom: number
        }
        Returns: unknown
      }
      st_touches: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_transform:
        | { Args: { geom: unknown; to_proj: string }; Returns: unknown }
        | {
            Args: { from_proj: string; geom: unknown; to_srid: number }
            Returns: unknown
          }
        | {
            Args: { from_proj: string; geom: unknown; to_proj: string }
            Returns: unknown
          }
      st_triangulatepolygon: { Args: { g1: unknown }; Returns: unknown }
      st_union:
        | { Args: { geom1: unknown; geom2: unknown }; Returns: unknown }
        | {
            Args: { geom1: unknown; geom2: unknown; gridsize: number }
            Returns: unknown
          }
      st_voronoilines: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_voronoipolygons: {
        Args: { extend_to?: unknown; g1: unknown; tolerance?: number }
        Returns: unknown
      }
      st_within: { Args: { geom1: unknown; geom2: unknown }; Returns: boolean }
      st_wkbtosql: { Args: { wkb: string }; Returns: unknown }
      st_wkttosql: { Args: { "": string }; Returns: unknown }
      st_wrapx: {
        Args: { geom: unknown; move: number; wrap: number }
        Returns: unknown
      }
      trust_inc: { Args: { pts: number; uid: string }; Returns: undefined }
      unlockrows: { Args: { "": string }; Returns: number }
      updategeometrysrid: {
        Args: {
          catalogn_name: string
          column_name: string
          new_srid_in: number
          schema_name: string
          table_name: string
        }
        Returns: string
      }
      validate_belgian_phone: { Args: { phone: string }; Returns: boolean }
      validate_belgian_postcode: {
        Args: { postcode: string }
        Returns: boolean
      }
      validate_belgian_vat: { Args: { vat: string }; Returns: boolean }
      validate_cp_code: { Args: { code: string }; Returns: boolean }
      validate_epc_cert_number: {
        Args: { cert_number: string }
        Returns: boolean
      }
      validate_epc_consistency: {
        Args: { consumption: number; rating: string }
        Returns: boolean
      }
      validate_iban: { Args: { iban: string }; Returns: boolean }
      validate_imei: { Args: { imei: string }; Returns: boolean }
      validate_job_listing: {
        Args: {
          p_employment_type: string
          p_hours_per_week: number
          p_languages_required: string[]
          p_salary_max: number
          p_salary_min: number
          p_salary_period: string
          p_work_permit_required: boolean
        }
        Returns: boolean
      }
      validate_pet_species: {
        Args: { species: string }
        Returns: {
          is_legal: boolean
          legal_status: string
          notes: string
          requires_microchip: boolean
          requires_registration: boolean
        }[]
      }
      validate_property_listing: {
        Args: {
          p_area_sqm: number
          p_bedrooms: number
          p_deposit_months: number
          p_listing_type: string
          p_rent_monthly: number
          p_rooms: number
        }
        Returns: boolean
      }
      validate_safety_standards: {
        Args: { item_category: string; standards: string[] }
        Returns: boolean
      }
      vehicle_generations_localized: {
        Args: { p_locale: string; p_model_id: string }
        Returns: {
          code: string
          end_year: number
          facelift: boolean
          id: string
          model_id: string
          start_year: number
          summary: string
        }[]
      }
      vehicle_makes_localized: {
        Args: { p_locale: string }
        Returns: {
          category_path: string
          country: string
          id: string
          is_active: boolean
          name: string
          segment_class: string
          slug: string
        }[]
      }
      vehicle_models_localized: {
        Args: { p_locale: string; p_make_id?: string }
        Returns: {
          first_model_year: number
          id: string
          last_model_year: number
          make_id: string
          name: string
          slug: string
          years_available: number[]
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      geometry_dump: {
        path: number[] | null
        geom: unknown
      }
      valid_detail: {
        valid: boolean | null
        reason: string | null
        location: unknown
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
