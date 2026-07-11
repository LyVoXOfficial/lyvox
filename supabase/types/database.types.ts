export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      ad_item_specifics: {
        Row: {
          advert_id: string;
          specifics: Json;
        };
        Insert: {
          advert_id: string;
          specifics?: Json;
        };
        Update: {
          advert_id?: string;
          specifics?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ad_item_specifics_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: true;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      advert_likes: {
        Row: {
          advert_id: string;
          created_at: string;
          user_id: string;
        };
        Insert: {
          advert_id: string;
          created_at?: string;
          user_id: string;
        };
        Update: {
          advert_id?: string;
          created_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advert_likes_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      advert_translations: {
        Row: {
          advert_id: string;
          created_at: string;
          description: string | null;
          generated_by: string;
          id: string;
          model_or_provider: string;
          source_hash: string;
          source_locale: string;
          status: string;
          target_locale: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          advert_id: string;
          created_at?: string;
          description?: string | null;
          generated_by: string;
          id?: string;
          model_or_provider: string;
          source_hash: string;
          source_locale: string;
          status?: string;
          target_locale: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          advert_id?: string;
          created_at?: string;
          description?: string | null;
          generated_by?: string;
          id?: string;
          model_or_provider?: string;
          source_hash?: string;
          source_locale?: string;
          status?: string;
          target_locale?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "advert_translations_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      advert_views: {
        Row: {
          advert_id: string;
          id: string;
          ip_address: unknown;
          user_agent: string | null;
          user_id: string | null;
          view_hour: number | null;
          viewed_at: string | null;
          viewer_key: string | null;
        };
        Insert: {
          advert_id: string;
          id?: string;
          ip_address?: unknown;
          user_agent?: string | null;
          user_id?: string | null;
          view_hour?: number | null;
          viewed_at?: string | null;
          viewer_key?: string | null;
        };
        Update: {
          advert_id?: string;
          id?: string;
          ip_address?: unknown;
          user_agent?: string | null;
          user_id?: string | null;
          view_hour?: number | null;
          viewed_at?: string | null;
          viewer_key?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "advert_views_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      adverts: {
        Row: {
          ai_moderation_reason: string | null;
          ai_moderation_score: number | null;
          business_id: string | null;
          category_id: string;
          condition: string | null;
          content_locale: string | null;
          created_at: string | null;
          currency: string | null;
          description: string | null;
          generation_id: string | null;
          id: string;
          location: string | null;
          location_id: string | null;
          min_offer_cents: number | null;
          moderation_status: string | null;
          price: number | null;
          status: string;
          title: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          ai_moderation_reason?: string | null;
          ai_moderation_score?: number | null;
          business_id?: string | null;
          category_id: string;
          condition?: string | null;
          content_locale?: string | null;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          generation_id?: string | null;
          id?: string;
          location?: string | null;
          location_id?: string | null;
          min_offer_cents?: number | null;
          moderation_status?: string | null;
          price?: number | null;
          status?: string;
          title: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          ai_moderation_reason?: string | null;
          ai_moderation_score?: number | null;
          business_id?: string | null;
          category_id?: string;
          condition?: string | null;
          content_locale?: string | null;
          created_at?: string | null;
          currency?: string | null;
          description?: string | null;
          generation_id?: string | null;
          id?: string;
          location?: string | null;
          location_id?: string | null;
          min_offer_cents?: number | null;
          moderation_status?: string | null;
          price?: number | null;
          status?: string;
          title?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "adverts_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adverts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adverts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "category_advert_counts";
            referencedColumns: ["category_id"];
          },
          {
            foreignKeyName: "adverts_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_generations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "adverts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
        ];
      };
      analytics_events: {
        Row: {
          dedup_key: string | null;
          event_name: string;
          id: string;
          props: Json;
          session_id: string | null;
          ts: string;
          user_id: string | null;
        };
        Insert: {
          dedup_key?: string | null;
          event_name: string;
          id?: string;
          props?: Json;
          session_id?: string | null;
          ts?: string;
          user_id?: string | null;
        };
        Update: {
          dedup_key?: string | null;
          event_name?: string;
          id?: string;
          props?: Json;
          session_id?: string | null;
          ts?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      badges_awarded: {
        Row: {
          awarded_at: string;
          awarded_by: string | null;
          badge: string;
          subject_id: string;
          subject_type: string;
        };
        Insert: {
          awarded_at?: string;
          awarded_by?: string | null;
          badge: string;
          subject_id: string;
          subject_type: string;
        };
        Update: {
          awarded_at?: string;
          awarded_by?: string | null;
          badge?: string;
          subject_id?: string;
          subject_type?: string;
        };
        Relationships: [];
      };
      benefits: {
        Row: {
          advert_id: string | null;
          benefit_type: string;
          created_at: string | null;
          id: string;
          purchase_id: string | null;
          user_id: string;
          valid_from: string | null;
          valid_until: string;
        };
        Insert: {
          advert_id?: string | null;
          benefit_type: string;
          created_at?: string | null;
          id?: string;
          purchase_id?: string | null;
          user_id: string;
          valid_from?: string | null;
          valid_until: string;
        };
        Update: {
          advert_id?: string | null;
          benefit_type?: string;
          created_at?: string | null;
          id?: string;
          purchase_id?: string | null;
          user_id?: string;
          valid_from?: string | null;
          valid_until?: string;
        };
        Relationships: [
          {
            foreignKeyName: "benefits_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "benefits_purchase_id_fkey";
            columns: ["purchase_id"];
            isOneToOne: false;
            referencedRelation: "purchases";
            referencedColumns: ["id"];
          },
        ];
      };
      business_members: {
        Row: {
          accepted_at: string | null;
          business_id: string;
          created_at: string;
          invited_by: string | null;
          role: string;
          user_id: string;
        };
        Insert: {
          accepted_at?: string | null;
          business_id: string;
          created_at?: string;
          invited_by?: string | null;
          role?: string;
          user_id: string;
        };
        Update: {
          accepted_at?: string | null;
          business_id?: string;
          created_at?: string;
          invited_by?: string | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey";
            columns: ["business_id"];
            isOneToOne: false;
            referencedRelation: "businesses";
            referencedColumns: ["id"];
          },
        ];
      };
      businesses: {
        Row: {
          address_line: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          created_by: string | null;
          email: string;
          entity_verified: boolean;
          id: string;
          kbo_number: string | null;
          legal_form: string | null;
          legal_name: string;
          phone_e164: string | null;
          postcode: string | null;
          returns_url: string | null;
          self_certified_at: string | null;
          self_certified_ip: string | null;
          status: string;
          trade_name: string | null;
          updated_at: string;
          vat_liable: boolean;
          vat_number: string | null;
          withdrawal_terms: string | null;
        };
        Insert: {
          address_line?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          email: string;
          entity_verified?: boolean;
          id?: string;
          kbo_number?: string | null;
          legal_form?: string | null;
          legal_name: string;
          phone_e164?: string | null;
          postcode?: string | null;
          returns_url?: string | null;
          self_certified_at?: string | null;
          self_certified_ip?: string | null;
          status?: string;
          trade_name?: string | null;
          updated_at?: string;
          vat_liable?: boolean;
          vat_number?: string | null;
          withdrawal_terms?: string | null;
        };
        Update: {
          address_line?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string;
          entity_verified?: boolean;
          id?: string;
          kbo_number?: string | null;
          legal_form?: string | null;
          legal_name?: string;
          phone_e164?: string | null;
          postcode?: string | null;
          returns_url?: string | null;
          self_certified_at?: string | null;
          self_certified_ip?: string | null;
          status?: string;
          trade_name?: string | null;
          updated_at?: string;
          vat_liable?: boolean;
          vat_number?: string | null;
          withdrawal_terms?: string | null;
        };
        Relationships: [];
      };
      catalog_field_options: {
        Row: {
          code: string;
          created_at: string;
          field_id: string;
          id: string;
          metadata: Json;
          name_i18n_key: string;
          sort: number | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          field_id: string;
          id?: string;
          metadata?: Json;
          name_i18n_key: string;
          sort?: number | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          field_id?: string;
          id?: string;
          metadata?: Json;
          name_i18n_key?: string;
          sort?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_field_options_field_id_fkey";
            columns: ["field_id"];
            isOneToOne: false;
            referencedRelation: "catalog_fields";
            referencedColumns: ["id"];
          },
        ];
      };
      catalog_fields: {
        Row: {
          created_at: string;
          description_i18n_key: string | null;
          domain: string | null;
          field_key: string;
          field_type: string;
          group_key: string | null;
          id: string;
          is_required: boolean;
          label_i18n_key: string | null;
          max_value: number | null;
          metadata: Json;
          min_value: number | null;
          pattern: string | null;
          sort: number | null;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description_i18n_key?: string | null;
          domain?: string | null;
          field_key: string;
          field_type: string;
          group_key?: string | null;
          id?: string;
          is_required?: boolean;
          label_i18n_key?: string | null;
          max_value?: number | null;
          metadata?: Json;
          min_value?: number | null;
          pattern?: string | null;
          sort?: number | null;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description_i18n_key?: string | null;
          domain?: string | null;
          field_key?: string;
          field_type?: string;
          group_key?: string | null;
          id?: string;
          is_required?: boolean;
          label_i18n_key?: string | null;
          max_value?: number | null;
          metadata?: Json;
          min_value?: number | null;
          pattern?: string | null;
          sort?: number | null;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      catalog_groups: {
        Row: {
          collapsed: boolean;
          created_at: string;
          display: string;
          domain: string;
          group_key: string;
          icon: string | null;
          id: string;
          tab_key: string | null;
          tab_order: number;
        };
        Insert: {
          collapsed?: boolean;
          created_at?: string;
          display?: string;
          domain: string;
          group_key: string;
          icon?: string | null;
          id?: string;
          tab_key?: string | null;
          tab_order?: number;
        };
        Update: {
          collapsed?: boolean;
          created_at?: string;
          display?: string;
          domain?: string;
          group_key?: string;
          icon?: string | null;
          id?: string;
          tab_key?: string | null;
          tab_order?: number;
        };
        Relationships: [];
      };
      catalog_subcategory_schema: {
        Row: {
          category_id: string;
          created_at: string;
          id: string;
          is_active: boolean;
          steps: Json;
          updated_at: string;
          version: number;
        };
        Insert: {
          category_id: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          steps: Json;
          updated_at?: string;
          version?: number;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          steps?: Json;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "catalog_subcategory_schema_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "catalog_subcategory_schema_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "category_advert_counts";
            referencedColumns: ["category_id"];
          },
        ];
      };
      categories: {
        Row: {
          icon: string | null;
          id: string;
          is_active: boolean | null;
          level: number;
          name_de: string | null;
          name_en: string | null;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
          parent_id: string | null;
          path: string;
          slug: string;
          sort: number | null;
        };
        Insert: {
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          level: number;
          name_de?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
          parent_id?: string | null;
          path: string;
          slug: string;
          sort?: number | null;
        };
        Update: {
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          level?: number;
          name_de?: string | null;
          name_en?: string | null;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
          parent_id?: string | null;
          path?: string;
          slug?: string;
          sort?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "category_advert_counts";
            referencedColumns: ["category_id"];
          },
        ];
      };
      chat_offers: {
        Row: {
          advert_id: string;
          amount_cents: number;
          conversation_id: string;
          created_at: string;
          currency: string;
          id: string;
          message: string | null;
          responded_at: string | null;
          sender_id: string;
          status: string;
        };
        Insert: {
          advert_id: string;
          amount_cents: number;
          conversation_id: string;
          created_at?: string;
          currency?: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          sender_id: string;
          status?: string;
        };
        Update: {
          advert_id?: string;
          amount_cents?: number;
          conversation_id?: string;
          created_at?: string;
          currency?: string;
          id?: string;
          message?: string | null;
          responded_at?: string | null;
          sender_id?: string;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_offers_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_offers_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      clothing_sizes: {
        Row: {
          category: string;
          chest_cm_max: number | null;
          chest_cm_min: number | null;
          hips_cm_max: number | null;
          hips_cm_min: number | null;
          id: string;
          numeric_size: string | null;
          size_eu: string | null;
          size_label: string | null;
          size_uk: string | null;
          size_us: string | null;
          waist_cm_max: number | null;
          waist_cm_min: number | null;
        };
        Insert: {
          category: string;
          chest_cm_max?: number | null;
          chest_cm_min?: number | null;
          hips_cm_max?: number | null;
          hips_cm_min?: number | null;
          id?: string;
          numeric_size?: string | null;
          size_eu?: string | null;
          size_label?: string | null;
          size_uk?: string | null;
          size_us?: string | null;
          waist_cm_max?: number | null;
          waist_cm_min?: number | null;
        };
        Update: {
          category?: string;
          chest_cm_max?: number | null;
          chest_cm_min?: number | null;
          hips_cm_max?: number | null;
          hips_cm_min?: number | null;
          id?: string;
          numeric_size?: string | null;
          size_eu?: string | null;
          size_label?: string | null;
          size_uk?: string | null;
          size_us?: string | null;
          waist_cm_max?: number | null;
          waist_cm_min?: number | null;
        };
        Relationships: [];
      };
      colors: {
        Row: {
          color_family: string | null;
          created_at: string | null;
          hex_code: string | null;
          name_de: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru: string | null;
          slug: string;
        };
        Insert: {
          color_family?: string | null;
          created_at?: string | null;
          hex_code?: string | null;
          name_de?: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru?: string | null;
          slug: string;
        };
        Update: {
          color_family?: string | null;
          created_at?: string | null;
          hex_code?: string | null;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string;
          name_nl?: string;
          name_ru?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      conversation_participants: {
        Row: {
          conversation_id: string;
          created_at: string | null;
          last_read_at: string | null;
          muted: boolean | null;
          role: string;
          user_id: string;
        };
        Insert: {
          conversation_id: string;
          created_at?: string | null;
          last_read_at?: string | null;
          muted?: boolean | null;
          role: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string | null;
          last_read_at?: string | null;
          muted?: boolean | null;
          role?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          advert_id: string | null;
          created_at: string | null;
          created_by: string | null;
          id: string;
          last_message_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          advert_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          last_message_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          advert_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          last_message_at?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      cp_codes: {
        Row: {
          code: string;
          created_at: string | null;
          is_active: boolean | null;
          name_en: string | null;
          name_fr: string;
          name_nl: string;
          sector: string | null;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          is_active?: boolean | null;
          name_en?: string | null;
          name_fr: string;
          name_nl: string;
          sector?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          is_active?: boolean | null;
          name_en?: string | null;
          name_fr?: string;
          name_nl?: string;
          sector?: string | null;
        };
        Relationships: [];
      };
      device_brands: {
        Row: {
          country: string | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          logo_url: string | null;
          name: string;
          slug: string;
          website: string | null;
        };
        Insert: {
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name: string;
          slug: string;
          website?: string | null;
        };
        Update: {
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          website?: string | null;
        };
        Relationships: [];
      };
      device_models: {
        Row: {
          brand_id: string;
          created_at: string | null;
          device_type: string;
          discontinued: boolean | null;
          id: string;
          name: string;
          release_year: number | null;
          slug: string;
          specs: Json | null;
        };
        Insert: {
          brand_id: string;
          created_at?: string | null;
          device_type: string;
          discontinued?: boolean | null;
          id?: string;
          name: string;
          release_year?: number | null;
          slug: string;
          specs?: Json | null;
        };
        Update: {
          brand_id?: string;
          created_at?: string | null;
          device_type?: string;
          discontinued?: boolean | null;
          id?: string;
          name?: string;
          release_year?: number | null;
          slug?: string;
          specs?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "device_models_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "device_brands";
            referencedColumns: ["id"];
          },
        ];
      };
      drive_types: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name_de: string | null;
          name_en: string;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
        };
        Relationships: [];
      };
      engine_types: {
        Row: {
          category: string | null;
          code: string;
          created_at: string;
          id: string;
          name_de: string | null;
          name_en: string;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
        };
        Insert: {
          category?: string | null;
          code: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
        };
        Update: {
          category?: string | null;
          code?: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
        };
        Relationships: [];
      };
      epc_ratings: {
        Row: {
          code: string;
          color: string;
          description_en: string | null;
          description_fr: string | null;
          description_nl: string | null;
          label: string;
          max_kwh_per_sqm_year: number | null;
          sort_order: number;
        };
        Insert: {
          code: string;
          color: string;
          description_en?: string | null;
          description_fr?: string | null;
          description_nl?: string | null;
          label: string;
          max_kwh_per_sqm_year?: number | null;
          sort_order: number;
        };
        Update: {
          code?: string;
          color?: string;
          description_en?: string | null;
          description_fr?: string | null;
          description_nl?: string | null;
          label?: string;
          max_kwh_per_sqm_year?: number | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      fashion_brands: {
        Row: {
          country: string | null;
          created_at: string | null;
          id: string;
          is_active: boolean | null;
          logo_url: string | null;
          name: string;
          segment: string | null;
          slug: string;
        };
        Insert: {
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name: string;
          segment?: string | null;
          slug: string;
        };
        Update: {
          country?: string | null;
          created_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          logo_url?: string | null;
          name?: string;
          segment?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      favorites: {
        Row: {
          advert_id: string;
          created_at: string | null;
          user_id: string;
        };
        Insert: {
          advert_id: string;
          created_at?: string | null;
          user_id: string;
        };
        Update: {
          advert_id?: string;
          created_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "favorites_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      fraud_detection_logs: {
        Row: {
          action_taken: string;
          advert_id: string | null;
          created_at: string | null;
          details: Json | null;
          id: string;
          match_score: number;
          rule_id: string | null;
          rule_name: string;
          user_id: string | null;
        };
        Insert: {
          action_taken: string;
          advert_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          match_score: number;
          rule_id?: string | null;
          rule_name: string;
          user_id?: string | null;
        };
        Update: {
          action_taken?: string;
          advert_id?: string | null;
          created_at?: string | null;
          details?: Json | null;
          id?: string;
          match_score?: number;
          rule_id?: string | null;
          rule_name?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fraud_detection_logs_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "fraud_detection_logs_rule_id_fkey";
            columns: ["rule_id"];
            isOneToOne: false;
            referencedRelation: "fraud_rules";
            referencedColumns: ["id"];
          },
        ];
      };
      fraud_rules: {
        Row: {
          action: string;
          condition: Json;
          created_at: string | null;
          description: string | null;
          enabled: boolean | null;
          id: string;
          metadata: Json | null;
          name: string;
          priority: number | null;
          rule_type: string;
          severity: string;
          updated_at: string | null;
        };
        Insert: {
          action: string;
          condition: Json;
          created_at?: string | null;
          description?: string | null;
          enabled?: boolean | null;
          id?: string;
          metadata?: Json | null;
          name: string;
          priority?: number | null;
          rule_type: string;
          severity: string;
          updated_at?: string | null;
        };
        Update: {
          action?: string;
          condition?: Json;
          created_at?: string | null;
          description?: string | null;
          enabled?: boolean | null;
          id?: string;
          metadata?: Json | null;
          name?: string;
          priority?: number | null;
          rule_type?: string;
          severity?: string;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      integration_health: {
        Row: {
          checked_at: string;
          expires_at: string;
          integration_id: string;
          latency_ms: number | null;
          safe_error_code: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          checked_at: string;
          expires_at: string;
          integration_id: string;
          latency_ms?: number | null;
          safe_error_code?: string | null;
          status: string;
          updated_at?: string;
        };
        Update: {
          checked_at?: string;
          expires_at?: string;
          integration_id?: string;
          latency_ms?: number | null;
          safe_error_code?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      job_categories: {
        Row: {
          created_at: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name_de: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru: string | null;
          parent_id: string | null;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name_de?: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru?: string | null;
          parent_id?: string | null;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string;
          name_nl?: string;
          name_ru?: string | null;
          parent_id?: string | null;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "job_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      job_contract_types: {
        Row: {
          code: string;
          created_at: string | null;
          description_en: string | null;
          description_fr: string | null;
          description_nl: string | null;
          id: string;
          is_active: boolean | null;
          name_de: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru: string | null;
          sort_order: number;
        };
        Insert: {
          code: string;
          created_at?: string | null;
          description_en?: string | null;
          description_fr?: string | null;
          description_nl?: string | null;
          id?: string;
          is_active?: boolean | null;
          name_de?: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru?: string | null;
          sort_order: number;
        };
        Update: {
          code?: string;
          created_at?: string | null;
          description_en?: string | null;
          description_fr?: string | null;
          description_nl?: string | null;
          id?: string;
          is_active?: boolean | null;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string;
          name_nl?: string;
          name_ru?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      job_listings: {
        Row: {
          advert_id: string;
          application_deadline: string | null;
          application_url: string | null;
          benefits: string[] | null;
          company_name: string | null;
          company_size: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          contract_type_id: string | null;
          cp_code: string | null;
          created_at: string | null;
          driving_license_required: boolean | null;
          education_level: string | null;
          employment_type: string;
          experience_years_min: number | null;
          flexible_hours: boolean | null;
          hours_per_week: number | null;
          industry: string | null;
          job_category_id: string | null;
          languages_preferred: string[] | null;
          languages_required: string[] | null;
          license_types: string[] | null;
          night_shifts: boolean | null;
          remote_option: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          salary_negotiable: boolean | null;
          salary_period: string | null;
          salary_type: string | null;
          shift_work: boolean | null;
          start_date: string | null;
          updated_at: string | null;
          weekend_work: boolean | null;
          work_permit_required: boolean | null;
          work_permit_sponsored: boolean | null;
        };
        Insert: {
          advert_id: string;
          application_deadline?: string | null;
          application_url?: string | null;
          benefits?: string[] | null;
          company_name?: string | null;
          company_size?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          contract_type_id?: string | null;
          cp_code?: string | null;
          created_at?: string | null;
          driving_license_required?: boolean | null;
          education_level?: string | null;
          employment_type: string;
          experience_years_min?: number | null;
          flexible_hours?: boolean | null;
          hours_per_week?: number | null;
          industry?: string | null;
          job_category_id?: string | null;
          languages_preferred?: string[] | null;
          languages_required?: string[] | null;
          license_types?: string[] | null;
          night_shifts?: boolean | null;
          remote_option?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_negotiable?: boolean | null;
          salary_period?: string | null;
          salary_type?: string | null;
          shift_work?: boolean | null;
          start_date?: string | null;
          updated_at?: string | null;
          weekend_work?: boolean | null;
          work_permit_required?: boolean | null;
          work_permit_sponsored?: boolean | null;
        };
        Update: {
          advert_id?: string;
          application_deadline?: string | null;
          application_url?: string | null;
          benefits?: string[] | null;
          company_name?: string | null;
          company_size?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          contract_type_id?: string | null;
          cp_code?: string | null;
          created_at?: string | null;
          driving_license_required?: boolean | null;
          education_level?: string | null;
          employment_type?: string;
          experience_years_min?: number | null;
          flexible_hours?: boolean | null;
          hours_per_week?: number | null;
          industry?: string | null;
          job_category_id?: string | null;
          languages_preferred?: string[] | null;
          languages_required?: string[] | null;
          license_types?: string[] | null;
          night_shifts?: boolean | null;
          remote_option?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_negotiable?: boolean | null;
          salary_period?: string | null;
          salary_type?: string | null;
          shift_work?: boolean | null;
          start_date?: string | null;
          updated_at?: string | null;
          weekend_work?: boolean | null;
          work_permit_required?: boolean | null;
          work_permit_sponsored?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_listings_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: true;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_listings_contract_type_id_fkey";
            columns: ["contract_type_id"];
            isOneToOne: false;
            referencedRelation: "job_contract_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_listings_cp_code_fkey";
            columns: ["cp_code"];
            isOneToOne: false;
            referencedRelation: "cp_codes";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "job_listings_job_category_id_fkey";
            columns: ["job_category_id"];
            isOneToOne: false;
            referencedRelation: "job_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      kyc_records: {
        Row: {
          created_at: string;
          data_class: string;
          document_ref: string | null;
          id: string;
          legal_basis: string | null;
          meta: Json | null;
          retention_until: string;
          subject_id: string;
          subject_type: string;
        };
        Insert: {
          created_at?: string;
          data_class: string;
          document_ref?: string | null;
          id?: string;
          legal_basis?: string | null;
          meta?: Json | null;
          retention_until: string;
          subject_id: string;
          subject_type: string;
        };
        Update: {
          created_at?: string;
          data_class?: string;
          document_ref?: string | null;
          id?: string;
          legal_basis?: string | null;
          meta?: Json | null;
          retention_until?: string;
          subject_id?: string;
          subject_type?: string;
        };
        Relationships: [];
      };
      locations: {
        Row: {
          city: string | null;
          country: string | null;
          id: string;
          point: unknown;
          postcode: string | null;
          region: string | null;
        };
        Insert: {
          city?: string | null;
          country?: string | null;
          id?: string;
          point?: unknown;
          postcode?: string | null;
          region?: string | null;
        };
        Update: {
          city?: string | null;
          country?: string | null;
          id?: string;
          point?: unknown;
          postcode?: string | null;
          region?: string | null;
        };
        Relationships: [];
      };
      logs: {
        Row: {
          action: string;
          created_at: string | null;
          details: Json | null;
          id: number;
          user_id: string | null;
        };
        Insert: {
          action: string;
          created_at?: string | null;
          details?: Json | null;
          id?: number;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          created_at?: string | null;
          details?: Json | null;
          id?: number;
          user_id?: string | null;
        };
        Relationships: [];
      };
      materials: {
        Row: {
          category: string | null;
          created_at: string | null;
          name_de: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru: string | null;
          slug: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          name_de?: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru?: string | null;
          slug: string;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string;
          name_nl?: string;
          name_ru?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      media: {
        Row: {
          advert_id: string;
          created_at: string | null;
          h: number | null;
          id: string;
          preview_h: number | null;
          preview_mime: string | null;
          preview_url: string | null;
          preview_w: number | null;
          sort: number | null;
          url: string;
          w: number | null;
        };
        Insert: {
          advert_id: string;
          created_at?: string | null;
          h?: number | null;
          id?: string;
          preview_h?: number | null;
          preview_mime?: string | null;
          preview_url?: string | null;
          preview_w?: number | null;
          sort?: number | null;
          url: string;
          w?: number | null;
        };
        Update: {
          advert_id?: string;
          created_at?: string | null;
          h?: number | null;
          id?: string;
          preview_h?: number | null;
          preview_mime?: string | null;
          preview_url?: string | null;
          preview_w?: number | null;
          sort?: number | null;
          url?: string;
          w?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "media_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      memory_options: {
        Row: {
          category: string;
          sort_order: number;
          value: string;
          value_bytes: number;
        };
        Insert: {
          category: string;
          sort_order: number;
          value: string;
          value_bytes: number;
        };
        Update: {
          category?: string;
          sort_order?: number;
          value?: string;
          value_bytes?: number;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          author_id: string | null;
          body: string;
          conversation_id: string;
          created_at: string | null;
          id: number;
          updated_at: string | null;
        };
        Insert: {
          author_id?: string | null;
          body: string;
          conversation_id: string;
          created_at?: string | null;
          id?: number;
          updated_at?: string | null;
        };
        Update: {
          author_id?: string | null;
          body?: string;
          conversation_id?: string;
          created_at?: string | null;
          id?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
        ];
      };
      moderation_logs: {
        Row: {
          action_taken: string | null;
          advert_id: string;
          created_at: string | null;
          id: string;
          metadata: Json | null;
          moderation_type: string;
          moderator_id: string | null;
          reason: string | null;
          recommendation: string | null;
          score: number | null;
        };
        Insert: {
          action_taken?: string | null;
          advert_id: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          moderation_type: string;
          moderator_id?: string | null;
          reason?: string | null;
          recommendation?: string | null;
          score?: number | null;
        };
        Update: {
          action_taken?: string | null;
          advert_id?: string;
          created_at?: string | null;
          id?: string;
          metadata?: Json | null;
          moderation_type?: string;
          moderator_id?: string | null;
          reason?: string | null;
          recommendation?: string | null;
          score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "moderation_logs_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string;
          channel: string;
          created_at: string | null;
          id: string;
          payload: Json | null;
          read_at: string | null;
          sent_at: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          body: string;
          channel: string;
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          read_at?: string | null;
          sent_at?: string | null;
          title: string;
          type: string;
          user_id: string;
        };
        Update: {
          body?: string;
          channel?: string;
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          read_at?: string | null;
          sent_at?: string | null;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      pet_species_legal: {
        Row: {
          breed_restrictions: boolean | null;
          category: string;
          common_name_en: string;
          common_name_fr: string;
          common_name_nl: string;
          created_at: string | null;
          legal_status: string;
          microchip_required: boolean | null;
          notes_en: string | null;
          notes_fr: string | null;
          notes_nl: string | null;
          registration_required: boolean | null;
          species: string;
        };
        Insert: {
          breed_restrictions?: boolean | null;
          category: string;
          common_name_en: string;
          common_name_fr: string;
          common_name_nl: string;
          created_at?: string | null;
          legal_status: string;
          microchip_required?: boolean | null;
          notes_en?: string | null;
          notes_fr?: string | null;
          notes_nl?: string | null;
          registration_required?: boolean | null;
          species: string;
        };
        Update: {
          breed_restrictions?: boolean | null;
          category?: string;
          common_name_en?: string;
          common_name_fr?: string;
          common_name_nl?: string;
          created_at?: string | null;
          legal_status?: string;
          microchip_required?: boolean | null;
          notes_en?: string | null;
          notes_fr?: string | null;
          notes_nl?: string | null;
          registration_required?: boolean | null;
          species?: string;
        };
        Relationships: [];
      };
      phone_otps: {
        Row: {
          attempts: number;
          code_hash: string;
          code_last_four: string;
          code_salt: string;
          created_at: string;
          e164: string;
          expires_at: string;
          id: number;
          used: boolean;
          user_id: string | null;
        };
        Insert: {
          attempts?: number;
          code_hash: string;
          code_last_four: string;
          code_salt: string;
          created_at?: string;
          e164: string;
          expires_at: string;
          id?: number;
          used?: boolean;
          user_id?: string | null;
        };
        Update: {
          attempts?: number;
          code_hash?: string;
          code_last_four?: string;
          code_salt?: string;
          created_at?: string;
          e164?: string;
          expires_at?: string;
          id?: number;
          used?: boolean;
          user_id?: string | null;
        };
        Relationships: [];
      };
      phones: {
        Row: {
          e164: string;
          lookup: Json | null;
          updated_at: string;
          user_id: string;
          verified: boolean;
        };
        Insert: {
          e164: string;
          lookup?: Json | null;
          updated_at?: string;
          user_id: string;
          verified?: boolean;
        };
        Update: {
          e164?: string;
          lookup?: Json | null;
          updated_at?: string;
          user_id?: string;
          verified?: boolean;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          key: string;
          revision: number;
          updated_at: string;
          updated_by: string | null;
          value: Json;
        };
        Insert: {
          key: string;
          revision?: number;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Update: {
          key?: string;
          revision?: number;
          updated_at?: string;
          updated_by?: string | null;
          value?: Json;
        };
        Relationships: [];
      };
      products: {
        Row: {
          active: boolean | null;
          benefit_type: string;
          capability: string;
          code: string;
          created_at: string | null;
          currency: string | null;
          duration_days: number;
          id: string;
          name: Json;
          offer_version: number;
          price_cents: number;
          requires_advert: boolean;
          tax_behavior: string;
        };
        Insert: {
          active?: boolean | null;
          benefit_type: string;
          capability: string;
          code: string;
          created_at?: string | null;
          currency?: string | null;
          duration_days: number;
          id?: string;
          name: Json;
          offer_version?: number;
          price_cents: number;
          requires_advert?: boolean;
          tax_behavior?: string;
        };
        Update: {
          active?: boolean | null;
          benefit_type?: string;
          capability?: string;
          code?: string;
          created_at?: string | null;
          currency?: string | null;
          duration_days?: number;
          id?: string;
          name?: Json;
          offer_version?: number;
          price_cents?: number;
          requires_advert?: boolean;
          tax_behavior?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          blocked_until: string | null;
          consents: Json | null;
          created_at: string | null;
          discover_prefs: Json;
          display_name: string | null;
          flags: Json | null;
          id: string;
          is_seed: boolean;
          itsme_kyc_level: string | null;
          itsme_sub: string | null;
          itsme_verified: boolean | null;
          notification_preferences: Json | null;
          phone: string | null;
          pro_until: string | null;
          rating: number | null;
          seller_type: string;
          stripe_customer_id: string | null;
          total_deals: number | null;
          verified_email: boolean | null;
          verified_phone: boolean | null;
        };
        Insert: {
          blocked_until?: string | null;
          consents?: Json | null;
          created_at?: string | null;
          discover_prefs?: Json;
          display_name?: string | null;
          flags?: Json | null;
          id: string;
          is_seed?: boolean;
          itsme_kyc_level?: string | null;
          itsme_sub?: string | null;
          itsme_verified?: boolean | null;
          notification_preferences?: Json | null;
          phone?: string | null;
          pro_until?: string | null;
          rating?: number | null;
          seller_type?: string;
          stripe_customer_id?: string | null;
          total_deals?: number | null;
          verified_email?: boolean | null;
          verified_phone?: boolean | null;
        };
        Update: {
          blocked_until?: string | null;
          consents?: Json | null;
          created_at?: string | null;
          discover_prefs?: Json;
          display_name?: string | null;
          flags?: Json | null;
          id?: string;
          is_seed?: boolean;
          itsme_kyc_level?: string | null;
          itsme_sub?: string | null;
          itsme_verified?: boolean | null;
          notification_preferences?: Json | null;
          phone?: string | null;
          pro_until?: string | null;
          rating?: number | null;
          seller_type?: string;
          stripe_customer_id?: string | null;
          total_deals?: number | null;
          verified_email?: boolean | null;
          verified_phone?: boolean | null;
        };
        Relationships: [];
      };
      property_listings: {
        Row: {
          advert_id: string;
          area_sqm: number;
          attic: boolean | null;
          available_from: string | null;
          bathrooms: number | null;
          bedrooms: number | null;
          cadastral_reference: string | null;
          cellar: boolean | null;
          created_at: string | null;
          deposit_months: number | null;
          double_glazing: boolean | null;
          elevator: boolean | null;
          epc_cert_number: string | null;
          epc_kwh_per_sqm_year: number | null;
          epc_rating: string | null;
          floor: number | null;
          furnished: string | null;
          garden_orientation: string | null;
          garden_sqm: number | null;
          heating_type: string[] | null;
          land_area_sqm: number | null;
          land_registry_number: string | null;
          lease_duration_months: number | null;
          listing_type: string;
          municipality: string;
          neighborhood: string | null;
          notary_name: string | null;
          parking_spaces: number | null;
          parking_type: string[] | null;
          peb_url: string | null;
          pet_friendly: boolean | null;
          postcode: string;
          property_type_id: string | null;
          renovation_year: number | null;
          rent_charges_monthly: number | null;
          rent_monthly: number | null;
          rooms: number | null;
          smoking_allowed: boolean | null;
          syndic_cost_monthly: number | null;
          terrace_sqm: number | null;
          total_floors: number | null;
          updated_at: string | null;
          water_heater_type: string | null;
          year_built: number | null;
        };
        Insert: {
          advert_id: string;
          area_sqm: number;
          attic?: boolean | null;
          available_from?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          cadastral_reference?: string | null;
          cellar?: boolean | null;
          created_at?: string | null;
          deposit_months?: number | null;
          double_glazing?: boolean | null;
          elevator?: boolean | null;
          epc_cert_number?: string | null;
          epc_kwh_per_sqm_year?: number | null;
          epc_rating?: string | null;
          floor?: number | null;
          furnished?: string | null;
          garden_orientation?: string | null;
          garden_sqm?: number | null;
          heating_type?: string[] | null;
          land_area_sqm?: number | null;
          land_registry_number?: string | null;
          lease_duration_months?: number | null;
          listing_type: string;
          municipality: string;
          neighborhood?: string | null;
          notary_name?: string | null;
          parking_spaces?: number | null;
          parking_type?: string[] | null;
          peb_url?: string | null;
          pet_friendly?: boolean | null;
          postcode: string;
          property_type_id?: string | null;
          renovation_year?: number | null;
          rent_charges_monthly?: number | null;
          rent_monthly?: number | null;
          rooms?: number | null;
          smoking_allowed?: boolean | null;
          syndic_cost_monthly?: number | null;
          terrace_sqm?: number | null;
          total_floors?: number | null;
          updated_at?: string | null;
          water_heater_type?: string | null;
          year_built?: number | null;
        };
        Update: {
          advert_id?: string;
          area_sqm?: number;
          attic?: boolean | null;
          available_from?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          cadastral_reference?: string | null;
          cellar?: boolean | null;
          created_at?: string | null;
          deposit_months?: number | null;
          double_glazing?: boolean | null;
          elevator?: boolean | null;
          epc_cert_number?: string | null;
          epc_kwh_per_sqm_year?: number | null;
          epc_rating?: string | null;
          floor?: number | null;
          furnished?: string | null;
          garden_orientation?: string | null;
          garden_sqm?: number | null;
          heating_type?: string[] | null;
          land_area_sqm?: number | null;
          land_registry_number?: string | null;
          lease_duration_months?: number | null;
          listing_type?: string;
          municipality?: string;
          neighborhood?: string | null;
          notary_name?: string | null;
          parking_spaces?: number | null;
          parking_type?: string[] | null;
          peb_url?: string | null;
          pet_friendly?: boolean | null;
          postcode?: string;
          property_type_id?: string | null;
          renovation_year?: number | null;
          rent_charges_monthly?: number | null;
          rent_monthly?: number | null;
          rooms?: number | null;
          smoking_allowed?: boolean | null;
          syndic_cost_monthly?: number | null;
          terrace_sqm?: number | null;
          total_floors?: number | null;
          updated_at?: string | null;
          water_heater_type?: string | null;
          year_built?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_listings_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: true;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_listings_epc_rating_fkey";
            columns: ["epc_rating"];
            isOneToOne: false;
            referencedRelation: "epc_ratings";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "property_listings_property_type_id_fkey";
            columns: ["property_type_id"];
            isOneToOne: false;
            referencedRelation: "property_types";
            referencedColumns: ["id"];
          },
        ];
      };
      property_types: {
        Row: {
          category: string;
          created_at: string | null;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          name_de: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru: string | null;
          slug: string;
        };
        Insert: {
          category: string;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name_de?: string | null;
          name_en: string;
          name_fr: string;
          name_nl: string;
          name_ru?: string | null;
          slug: string;
        };
        Update: {
          category?: string;
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string;
          name_nl?: string;
          name_ru?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      purchases: {
        Row: {
          advert_id: string | null;
          amount_cents: number;
          created_at: string | null;
          currency: string | null;
          id: string;
          product_code: string;
          product_offer_version: number;
          provider: string;
          provider_payment_intent_id: string | null;
          provider_session_id: string | null;
          status: string;
          updated_at: string | null;
          user_id: string | null;
        };
        Insert: {
          advert_id?: string | null;
          amount_cents: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          product_code: string;
          product_offer_version?: number;
          provider: string;
          provider_payment_intent_id?: string | null;
          provider_session_id?: string | null;
          status: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Update: {
          advert_id?: string | null;
          amount_cents?: number;
          created_at?: string | null;
          currency?: string | null;
          id?: string;
          product_code?: string;
          product_offer_version?: number;
          provider?: string;
          provider_payment_intent_id?: string | null;
          provider_session_id?: string | null;
          status?: string;
          updated_at?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchases_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchases_product_code_fkey";
            columns: ["product_code"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["code"];
          },
        ];
      };
      reports: {
        Row: {
          advert_id: string;
          created_at: string | null;
          details: string | null;
          id: number;
          reason: string;
          reporter: string;
          reviewed_by: string | null;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          advert_id: string;
          created_at?: string | null;
          details?: string | null;
          id?: number;
          reason: string;
          reporter: string;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          advert_id?: string;
          created_at?: string | null;
          details?: string | null;
          id?: number;
          reason?: string;
          reporter?: string;
          reviewed_by?: string | null;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "reports_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          advert_id: string;
          comment: string | null;
          created_at: string;
          id: string;
          rating: number;
          reviewer_id: string;
          subject_id: string;
        };
        Insert: {
          advert_id: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating: number;
          reviewer_id: string;
          subject_id: string;
        };
        Update: {
          advert_id?: string;
          comment?: string | null;
          created_at?: string;
          id?: string;
          rating?: number;
          reviewer_id?: string;
          subject_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: false;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
        ];
      };
      safety_standards: {
        Row: {
          applies_to: string[] | null;
          authority: string | null;
          code: string;
          created_at: string | null;
          description_en: string | null;
          description_fr: string | null;
          description_nl: string | null;
          name: string;
          required_for: string[] | null;
          url: string | null;
        };
        Insert: {
          applies_to?: string[] | null;
          authority?: string | null;
          code: string;
          created_at?: string | null;
          description_en?: string | null;
          description_fr?: string | null;
          description_nl?: string | null;
          name: string;
          required_for?: string[] | null;
          url?: string | null;
        };
        Update: {
          applies_to?: string[] | null;
          authority?: string | null;
          code?: string;
          created_at?: string | null;
          description_en?: string | null;
          description_fr?: string | null;
          description_nl?: string | null;
          name?: string;
          required_for?: string[] | null;
          url?: string | null;
        };
        Relationships: [];
      };
      saved_searches: {
        Row: {
          alert_enabled: boolean;
          alert_frequency: string;
          created_at: string;
          filters: Json;
          id: string;
          last_alerted_at: string;
          last_seen_at: string;
          name: string;
          query: string | null;
          user_id: string;
        };
        Insert: {
          alert_enabled?: boolean;
          alert_frequency?: string;
          created_at?: string;
          filters?: Json;
          id?: string;
          last_alerted_at?: string;
          last_seen_at?: string;
          name: string;
          query?: string | null;
          user_id: string;
        };
        Update: {
          alert_enabled?: boolean;
          alert_frequency?: string;
          created_at?: string;
          filters?: Json;
          id?: string;
          last_alerted_at?: string;
          last_seen_at?: string;
          name?: string;
          query?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      settings_audit: {
        Row: {
          actor_id: string;
          after_value: Json;
          before_value: Json | null;
          created_at: string;
          id: number;
          operation: string;
          reason: string;
          request_id: string;
          revision: number;
          setting_key: string;
          source_ip: string | null;
        };
        Insert: {
          actor_id: string;
          after_value: Json;
          before_value?: Json | null;
          created_at?: string;
          id?: never;
          operation: string;
          reason: string;
          request_id: string;
          revision: number;
          setting_key: string;
          source_ip?: string | null;
        };
        Update: {
          actor_id?: string;
          after_value?: Json;
          before_value?: Json | null;
          created_at?: string;
          id?: never;
          operation?: string;
          reason?: string;
          request_id?: string;
          revision?: number;
          setting_key?: string;
          source_ip?: string | null;
        };
        Relationships: [];
      };
      steering_wheel: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name_de: string | null;
          name_en: string;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
        };
        Relationships: [];
      };
      storage_options: {
        Row: {
          category: string;
          obsolete: boolean | null;
          sort_order: number;
          value: string;
          value_bytes: number;
        };
        Insert: {
          category: string;
          obsolete?: boolean | null;
          sort_order: number;
          value: string;
          value_bytes: number;
        };
        Update: {
          category?: string;
          obsolete?: boolean | null;
          sort_order?: number;
          value?: string;
          value_bytes?: number;
        };
        Relationships: [];
      };
      trust_score: {
        Row: {
          bayesian_rating: number;
          components: Json | null;
          created_at: string;
          last_computed_at: string | null;
          score: number;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          bayesian_rating?: number;
          components?: Json | null;
          created_at?: string;
          last_computed_at?: string | null;
          score?: number;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          bayesian_rating?: number;
          components?: Json | null;
          created_at?: string;
          last_computed_at?: string | null;
          score?: number;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      vehicle_colors: {
        Row: {
          code: string;
          created_at: string;
          hex_code: string | null;
          id: string;
          name_de: string | null;
          name_en: string;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          hex_code?: string | null;
          id?: string;
          name_de?: string | null;
          name_en: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          hex_code?: string | null;
          id?: string;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
        };
        Relationships: [];
      };
      vehicle_conditions: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          name_de: string | null;
          name_en: string;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
        };
        Relationships: [];
      };
      vehicle_doors: {
        Row: {
          count: number;
          created_at: string;
          id: string;
          name_de: string | null;
          name_en: string;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
        };
        Insert: {
          count: number;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
        };
        Relationships: [];
      };
      vehicle_generation_i18n: {
        Row: {
          created_at: string;
          generation_id: string;
          locale: string;
          summary: string | null;
        };
        Insert: {
          created_at?: string;
          generation_id: string;
          locale: string;
          summary?: string | null;
        };
        Update: {
          created_at?: string;
          generation_id?: string;
          locale?: string;
          summary?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_generation_i18n_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_generations";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_generation_insights: {
        Row: {
          common_issues: string[] | null;
          cons: string[] | null;
          created_at: string;
          engine_examples: string[] | null;
          generation_id: string;
          inspection_tips: string[] | null;
          notable_features: string[] | null;
          popularity_score: number | null;
          pros: string[] | null;
          reliability_score: number | null;
        };
        Insert: {
          common_issues?: string[] | null;
          cons?: string[] | null;
          created_at?: string;
          engine_examples?: string[] | null;
          generation_id: string;
          inspection_tips?: string[] | null;
          notable_features?: string[] | null;
          popularity_score?: number | null;
          pros?: string[] | null;
          reliability_score?: number | null;
        };
        Update: {
          common_issues?: string[] | null;
          cons?: string[] | null;
          created_at?: string;
          engine_examples?: string[] | null;
          generation_id?: string;
          inspection_tips?: string[] | null;
          notable_features?: string[] | null;
          popularity_score?: number | null;
          pros?: string[] | null;
          reliability_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_generation_insights_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: true;
            referencedRelation: "vehicle_generations";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_generation_insights_i18n: {
        Row: {
          common_issues: string[] | null;
          cons: string[] | null;
          created_at: string;
          engine_examples: string[] | null;
          generation_id: string;
          inspection_tips: string[] | null;
          locale: string;
          notable_features: string[] | null;
          pros: string[] | null;
        };
        Insert: {
          common_issues?: string[] | null;
          cons?: string[] | null;
          created_at?: string;
          engine_examples?: string[] | null;
          generation_id: string;
          inspection_tips?: string[] | null;
          locale: string;
          notable_features?: string[] | null;
          pros?: string[] | null;
        };
        Update: {
          common_issues?: string[] | null;
          cons?: string[] | null;
          created_at?: string;
          engine_examples?: string[] | null;
          generation_id?: string;
          inspection_tips?: string[] | null;
          locale?: string;
          notable_features?: string[] | null;
          pros?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_generation_insights_i18n_generation_id_fkey";
            columns: ["generation_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_generation_insights";
            referencedColumns: ["generation_id"];
          },
        ];
      };
      vehicle_generations: {
        Row: {
          body_types: Json | null;
          code: string | null;
          created_at: string;
          end_year: number | null;
          facelift: boolean | null;
          fuel_types: Json | null;
          id: string;
          model_id: string;
          name_en: string | null;
          name_ru: string | null;
          production_countries: string[] | null;
          start_year: number | null;
          summary: string | null;
          transmission_types: Json | null;
        };
        Insert: {
          body_types?: Json | null;
          code?: string | null;
          created_at?: string;
          end_year?: number | null;
          facelift?: boolean | null;
          fuel_types?: Json | null;
          id?: string;
          model_id: string;
          name_en?: string | null;
          name_ru?: string | null;
          production_countries?: string[] | null;
          start_year?: number | null;
          summary?: string | null;
          transmission_types?: Json | null;
        };
        Update: {
          body_types?: Json | null;
          code?: string | null;
          created_at?: string;
          end_year?: number | null;
          facelift?: boolean | null;
          fuel_types?: Json | null;
          id?: string;
          model_id?: string;
          name_en?: string | null;
          name_ru?: string | null;
          production_countries?: string[] | null;
          start_year?: number | null;
          summary?: string | null;
          transmission_types?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_generations_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_models";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_insights: {
        Row: {
          common_issues_by_engine: Json;
          cons: Json;
          created_at: string;
          engine_examples: Json;
          inspection_tips: Json;
          model_id: string;
          notable_features: Json;
          popularity_score: number | null;
          pros: Json;
          reliability_score: number | null;
        };
        Insert: {
          common_issues_by_engine?: Json;
          cons?: Json;
          created_at?: string;
          engine_examples?: Json;
          inspection_tips?: Json;
          model_id: string;
          notable_features?: Json;
          popularity_score?: number | null;
          pros?: Json;
          reliability_score?: number | null;
        };
        Update: {
          common_issues_by_engine?: Json;
          cons?: Json;
          created_at?: string;
          engine_examples?: Json;
          inspection_tips?: Json;
          model_id?: string;
          notable_features?: Json;
          popularity_score?: number | null;
          pros?: Json;
          reliability_score?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_insights_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: true;
            referencedRelation: "vehicle_models";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_insights_i18n: {
        Row: {
          common_issues: string[] | null;
          cons: string[] | null;
          created_at: string;
          engine_examples: string[] | null;
          inspection_tips: string[] | null;
          locale: string;
          model_id: string;
          notable_features: string[] | null;
          pros: string[] | null;
        };
        Insert: {
          common_issues?: string[] | null;
          cons?: string[] | null;
          created_at?: string;
          engine_examples?: string[] | null;
          inspection_tips?: string[] | null;
          locale: string;
          model_id: string;
          notable_features?: string[] | null;
          pros?: string[] | null;
        };
        Update: {
          common_issues?: string[] | null;
          cons?: string[] | null;
          created_at?: string;
          engine_examples?: string[] | null;
          inspection_tips?: string[] | null;
          locale?: string;
          model_id?: string;
          notable_features?: string[] | null;
          pros?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_insights_i18n_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_insights";
            referencedColumns: ["model_id"];
          },
        ];
      };
      vehicle_make_i18n: {
        Row: {
          created_at: string;
          locale: string;
          make_id: string;
          name: string;
          synonyms: string[];
        };
        Insert: {
          created_at?: string;
          locale: string;
          make_id: string;
          name: string;
          synonyms?: string[];
        };
        Update: {
          created_at?: string;
          locale?: string;
          make_id?: string;
          name?: string;
          synonyms?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_make_i18n_make_id_fkey";
            columns: ["make_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_makes";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_makes: {
        Row: {
          category_path: string;
          country: string | null;
          created_at: string;
          id: string;
          is_active: boolean | null;
          name_en: string;
          segment_class: string | null;
          slug: string;
        };
        Insert: {
          category_path?: string;
          country?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean | null;
          name_en: string;
          segment_class?: string | null;
          slug: string;
        };
        Update: {
          category_path?: string;
          country?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean | null;
          name_en?: string;
          segment_class?: string | null;
          slug?: string;
        };
        Relationships: [];
      };
      vehicle_model_i18n: {
        Row: {
          created_at: string;
          locale: string;
          model_id: string;
          name: string;
          synonyms: string[];
        };
        Insert: {
          created_at?: string;
          locale: string;
          model_id: string;
          name: string;
          synonyms?: string[];
        };
        Update: {
          created_at?: string;
          locale?: string;
          model_id?: string;
          name?: string;
          synonyms?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_model_i18n_model_id_fkey";
            columns: ["model_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_models";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_models: {
        Row: {
          body_types_available: Json;
          created_at: string;
          first_model_year: number | null;
          fuel_types_available: Json;
          id: string;
          last_model_year: number | null;
          make_id: string;
          name_en: string;
          popularity_score: number | null;
          reliability_score: number | null;
          slug: string;
          transmission_available: Json;
          years_available: number[];
        };
        Insert: {
          body_types_available?: Json;
          created_at?: string;
          first_model_year?: number | null;
          fuel_types_available?: Json;
          id?: string;
          last_model_year?: number | null;
          make_id: string;
          name_en: string;
          popularity_score?: number | null;
          reliability_score?: number | null;
          slug: string;
          transmission_available?: Json;
          years_available?: number[];
        };
        Update: {
          body_types_available?: Json;
          created_at?: string;
          first_model_year?: number | null;
          fuel_types_available?: Json;
          id?: string;
          last_model_year?: number | null;
          make_id?: string;
          name_en?: string;
          popularity_score?: number | null;
          reliability_score?: number | null;
          slug?: string;
          transmission_available?: Json;
          years_available?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "vehicle_models_make_id_fkey";
            columns: ["make_id"];
            isOneToOne: false;
            referencedRelation: "vehicle_makes";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicle_options: {
        Row: {
          category: string;
          code: string;
          created_at: string;
          id: string;
          name_de: string | null;
          name_en: string;
          name_fr: string | null;
          name_nl: string | null;
          name_ru: string;
        };
        Insert: {
          category: string;
          code: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru: string;
        };
        Update: {
          category?: string;
          code?: string;
          created_at?: string;
          id?: string;
          name_de?: string | null;
          name_en?: string;
          name_fr?: string | null;
          name_nl?: string | null;
          name_ru?: string;
        };
        Relationships: [];
      };
      verifications: {
        Row: {
          created_at: string;
          evidence: Json | null;
          expires_at: string | null;
          id: string;
          method: string;
          status: string;
          subject_id: string;
          subject_type: string;
          verified_at: string | null;
        };
        Insert: {
          created_at?: string;
          evidence?: Json | null;
          expires_at?: string | null;
          id?: string;
          method: string;
          status?: string;
          subject_id: string;
          subject_type: string;
          verified_at?: string | null;
        };
        Update: {
          created_at?: string;
          evidence?: Json | null;
          expires_at?: string | null;
          id?: string;
          method?: string;
          status?: string;
          subject_id?: string;
          subject_type?: string;
          verified_at?: string | null;
        };
        Relationships: [];
      };
      webhook_events: {
        Row: {
          event_id: string;
          payload: Json;
          processed_at: string | null;
          provider: string;
          received_at: string;
          type: string;
        };
        Insert: {
          event_id: string;
          payload?: Json;
          processed_at?: string | null;
          provider: string;
          received_at?: string;
          type: string;
        };
        Update: {
          event_id?: string;
          payload?: Json;
          processed_at?: string | null;
          provider?: string;
          received_at?: string;
          type?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      category_advert_counts: {
        Row: {
          advert_count: number | null;
          category_id: string | null;
          is_active: boolean | null;
          last_refreshed_at: string | null;
          level: number | null;
          parent_id: string | null;
          slug: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "category_advert_counts";
            referencedColumns: ["category_id"];
          },
        ];
      };
      job_listings_public: {
        Row: {
          advert_id: string | null;
          application_deadline: string | null;
          benefits: string[] | null;
          company_name: string | null;
          company_size: string | null;
          contact_email: string | null;
          contract_type_id: string | null;
          created_at: string | null;
          driving_license_required: boolean | null;
          education_level: string | null;
          employment_type: string | null;
          experience_years_min: number | null;
          hours_per_week: number | null;
          industry: string | null;
          job_category_id: string | null;
          languages_required: string[] | null;
          remote_option: string | null;
          salary_currency: string | null;
          salary_max: number | null;
          salary_min: number | null;
          salary_period: string | null;
          salary_type: string | null;
          start_date: string | null;
          work_permit_required: boolean | null;
          work_permit_sponsored: boolean | null;
        };
        Insert: {
          advert_id?: string | null;
          application_deadline?: string | null;
          benefits?: string[] | null;
          company_name?: string | null;
          company_size?: string | null;
          contact_email?: never;
          contract_type_id?: string | null;
          created_at?: string | null;
          driving_license_required?: boolean | null;
          education_level?: string | null;
          employment_type?: string | null;
          experience_years_min?: number | null;
          hours_per_week?: number | null;
          industry?: string | null;
          job_category_id?: string | null;
          languages_required?: string[] | null;
          remote_option?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_period?: string | null;
          salary_type?: string | null;
          start_date?: string | null;
          work_permit_required?: boolean | null;
          work_permit_sponsored?: boolean | null;
        };
        Update: {
          advert_id?: string | null;
          application_deadline?: string | null;
          benefits?: string[] | null;
          company_name?: string | null;
          company_size?: string | null;
          contact_email?: never;
          contract_type_id?: string | null;
          created_at?: string | null;
          driving_license_required?: boolean | null;
          education_level?: string | null;
          employment_type?: string | null;
          experience_years_min?: number | null;
          hours_per_week?: number | null;
          industry?: string | null;
          job_category_id?: string | null;
          languages_required?: string[] | null;
          remote_option?: string | null;
          salary_currency?: string | null;
          salary_max?: number | null;
          salary_min?: number | null;
          salary_period?: string | null;
          salary_type?: string | null;
          start_date?: string | null;
          work_permit_required?: boolean | null;
          work_permit_sponsored?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "job_listings_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: true;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_listings_contract_type_id_fkey";
            columns: ["contract_type_id"];
            isOneToOne: false;
            referencedRelation: "job_contract_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "job_listings_job_category_id_fkey";
            columns: ["job_category_id"];
            isOneToOne: false;
            referencedRelation: "job_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      property_listings_public: {
        Row: {
          advert_id: string | null;
          area_sqm: number | null;
          available_from: string | null;
          bathrooms: number | null;
          bedrooms: number | null;
          created_at: string | null;
          deposit_months: number | null;
          double_glazing: boolean | null;
          elevator: boolean | null;
          epc_kwh_per_sqm_year: number | null;
          epc_rating: string | null;
          floor: number | null;
          furnished: string | null;
          garden_sqm: number | null;
          heating_type: string[] | null;
          land_area_sqm: number | null;
          listing_type: string | null;
          municipality: string | null;
          parking_spaces: number | null;
          pet_friendly: boolean | null;
          postcode_area: string | null;
          property_type_id: string | null;
          rent_charges_monthly: number | null;
          rent_monthly: number | null;
          rooms: number | null;
          syndic_cost_monthly: number | null;
          terrace_sqm: number | null;
          year_built: number | null;
        };
        Insert: {
          advert_id?: string | null;
          area_sqm?: number | null;
          available_from?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string | null;
          deposit_months?: number | null;
          double_glazing?: boolean | null;
          elevator?: boolean | null;
          epc_kwh_per_sqm_year?: number | null;
          epc_rating?: string | null;
          floor?: number | null;
          furnished?: string | null;
          garden_sqm?: number | null;
          heating_type?: string[] | null;
          land_area_sqm?: number | null;
          listing_type?: string | null;
          municipality?: string | null;
          parking_spaces?: number | null;
          pet_friendly?: boolean | null;
          postcode_area?: never;
          property_type_id?: string | null;
          rent_charges_monthly?: number | null;
          rent_monthly?: number | null;
          rooms?: number | null;
          syndic_cost_monthly?: number | null;
          terrace_sqm?: number | null;
          year_built?: number | null;
        };
        Update: {
          advert_id?: string | null;
          area_sqm?: number | null;
          available_from?: string | null;
          bathrooms?: number | null;
          bedrooms?: number | null;
          created_at?: string | null;
          deposit_months?: number | null;
          double_glazing?: boolean | null;
          elevator?: boolean | null;
          epc_kwh_per_sqm_year?: number | null;
          epc_rating?: string | null;
          floor?: number | null;
          furnished?: string | null;
          garden_sqm?: number | null;
          heating_type?: string[] | null;
          land_area_sqm?: number | null;
          listing_type?: string | null;
          municipality?: string | null;
          parking_spaces?: number | null;
          pet_friendly?: boolean | null;
          postcode_area?: never;
          property_type_id?: string | null;
          rent_charges_monthly?: number | null;
          rent_monthly?: number | null;
          rooms?: number | null;
          syndic_cost_monthly?: number | null;
          terrace_sqm?: number | null;
          year_built?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "property_listings_advert_id_fkey";
            columns: ["advert_id"];
            isOneToOne: true;
            referencedRelation: "adverts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "property_listings_epc_rating_fkey";
            columns: ["epc_rating"];
            isOneToOne: false;
            referencedRelation: "epc_ratings";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "property_listings_property_type_id_fkey";
            columns: ["property_type_id"];
            isOneToOne: false;
            referencedRelation: "property_types";
            referencedColumns: ["id"];
          },
        ];
      };
      top_sellers: {
        Row: {
          active_adverts: number | null;
          avg_views: number | null;
          created_at: string | null;
          display_name: string | null;
          id: string | null;
          is_seed: boolean | null;
          rating: number | null;
          total_deals: number | null;
          trust_score: number | null;
          verified_email: boolean | null;
          verified_phone: boolean | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      activate_platform_emergency_stop: {
        Args: { p_key: string; p_reason: string; p_request_id?: string };
        Returns: number;
      };
      archive_expired_jobs: { Args: never; Returns: undefined };
      check_price_outlier: {
        Args: {
          category_slug: string;
          price: number;
          threshold_sigma?: number;
        };
        Returns: boolean;
      };
      create_business: {
        Args: { p_kbo: string; p_legal_name: string; p_vat: string };
        Returns: string;
      };
      create_review: {
        Args: { p_advert_id: string; p_comment: string; p_rating: number };
        Returns: string;
      };
      erase_user_data: { Args: { p_user_id: string }; Returns: undefined };
      estimate_price: {
        Args: {
          p_category_id: string;
          p_condition?: string;
          p_exclude_seed?: boolean;
        };
        Returns: {
          backoff_level: string;
          median: number;
          p25: number;
          p75: number;
          sample_size: number;
        }[];
      };
      find_user_by_email: { Args: { p_email: string }; Returns: string };
      get_advert_favorite_count: {
        Args: { advert_id_param: string };
        Returns: number;
      };
      get_advert_like_count: {
        Args: { advert_id_param: string };
        Returns: number;
      };
      get_advert_view_count: {
        Args: { advert_id_param: string };
        Returns: number;
      };
      get_epc_max_consumption: { Args: { rating: string }; Returns: number };
      get_region_from_postcode: { Args: { postcode: string }; Returns: string };
      is_admin: { Args: never; Returns: boolean };
      is_business_member: {
        Args: { b_id: string; min_role?: string };
        Returns: boolean;
      };
      is_conversation_participant: {
        Args: { p_conversation_id: string };
        Returns: boolean;
      };
      is_favorited: {
        Args: { advert_id_param: string; user_id_param: string };
        Returns: boolean;
      };
      is_user_blocked: { Args: { user_id_param: string }; Returns: boolean };
      normalize_kbo: { Args: { p: string }; Returns: string };
      refresh_category_advert_counts: { Args: never; Returns: undefined };
      refresh_top_sellers: { Args: never; Returns: undefined };
      resolve_location_id: { Args: { p_location: string }; Returns: string };
      search_adverts: {
        Args: {
          category_id_filter?: string;
          condition_filter?: string;
          location_filter?: string;
          location_lat?: number;
          location_lng?: number;
          page_limit?: number;
          page_offset?: number;
          price_max_filter?: number;
          price_min_filter?: number;
          radius_km?: number;
          search_query?: string;
          sort_by?: string;
          verified_only?: boolean;
        };
        Returns: {
          category_id: string;
          condition: string;
          created_at: string;
          currency: string;
          description: string;
          id: string;
          location: string;
          location_id: string;
          price: number;
          relevance_rank: number;
          seller_verified: boolean;
          status: string;
          title: string;
          total_count: number;
          updated_at: string;
          user_id: string;
        }[];
      };
      search_device_models: {
        Args: {
          p_brand_slug: string;
          p_device_type: string;
          p_limit?: number;
          p_search_term?: string;
        };
        Returns: {
          brand_name: string;
          device_type: string;
          id: string;
          model_name: string;
          release_year: number;
        }[];
      };
      set_platform_setting: {
        Args: {
          p_expected_revision: number;
          p_key: string;
          p_reason: string;
          p_request_id?: string;
          p_value: Json;
        };
        Returns: number;
      };
      show_limit: { Args: never; Returns: number };
      show_trgm: { Args: { "": string }; Returns: string[] };
      start_conversation: {
        Args: { p_advert_id: string; p_peer_id: string };
        Returns: string;
      };
      trust_inc: { Args: { pts: number; uid: string }; Returns: undefined };
      user_has_flag: {
        Args: { flag_name: string; user_id_param: string };
        Returns: boolean;
      };
      validate_belgian_phone: { Args: { phone: string }; Returns: boolean };
      validate_belgian_postcode: {
        Args: { postcode: string };
        Returns: boolean;
      };
      validate_belgian_vat: { Args: { vat: string }; Returns: boolean };
      validate_cp_code: { Args: { code: string }; Returns: boolean };
      validate_epc_cert_number: {
        Args: { cert_number: string };
        Returns: boolean;
      };
      validate_epc_consistency: {
        Args: { consumption: number; rating: string };
        Returns: boolean;
      };
      validate_iban: { Args: { iban: string }; Returns: boolean };
      validate_imei: { Args: { imei: string }; Returns: boolean };
      validate_job_listing: {
        Args: {
          p_employment_type: string;
          p_hours_per_week: number;
          p_languages_required: string[];
          p_salary_max: number;
          p_salary_min: number;
          p_salary_period: string;
          p_work_permit_required: boolean;
        };
        Returns: boolean;
      };
      validate_pet_species: {
        Args: { species: string };
        Returns: {
          is_legal: boolean;
          legal_status: string;
          notes: string;
          requires_microchip: boolean;
          requires_registration: boolean;
        }[];
      };
      validate_property_listing: {
        Args: {
          p_area_sqm: number;
          p_bedrooms: number;
          p_deposit_months: number;
          p_listing_type: string;
          p_rent_monthly: number;
          p_rooms: number;
        };
        Returns: boolean;
      };
      validate_safety_standards: {
        Args: { item_category: string; standards: string[] };
        Returns: boolean;
      };
      vehicle_generations_localized: {
        Args: { p_locale: string; p_model_id: string };
        Returns: {
          code: string;
          end_year: number;
          facelift: boolean;
          id: string;
          model_id: string;
          start_year: number;
          summary: string;
        }[];
      };
      vehicle_makes_localized: {
        Args: { p_locale: string };
        Returns: {
          category_path: string;
          country: string;
          id: string;
          is_active: boolean;
          name: string;
          segment_class: string;
          slug: string;
        }[];
      };
      vehicle_models_localized: {
        Args: { p_locale: string; p_make_id?: string };
        Returns: {
          first_model_year: number;
          id: string;
          last_model_year: number;
          make_id: string;
          name: string;
          slug: string;
          years_available: number[];
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
