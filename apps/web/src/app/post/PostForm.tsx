"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { Category } from "@/lib/types";
import { apiFetch } from "@/lib/fetcher";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import UploadGallery from "@/components/upload-gallery";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronDown, Check, Loader2, ShieldCheck, Trash2, Zap } from "lucide-react";
import { detectCategoryType, getCategoryTypeName } from "@/lib/utils/categoryDetector";
import BoostDialog from "@/components/BoostDialog";
import { ElectronicsFields } from "@/components/catalog/ElectronicsFields";
import { RealEstateFields } from "@/components/catalog/RealEstateFields";
import { FashionFields } from "@/components/catalog/FashionFields";
import { JobsFields } from "@/components/catalog/JobsFields";
import { FormRenderer, type CatalogFieldDefinition, type CatalogSchema, type CatalogSchemaField } from "@/catalog/renderer";
import TrustGatePhone from "@/components/trust/TrustGatePhone";
import { getAdvertApiErrorMessage } from "@/lib/adverts/apiErrorMessage";

type PostFormProps = {
  categories: Category[];
  userId: string;
  advertToEdit?: any;
  locale: string;
  userPhone?: string | null;
  isVerified?: boolean;
};

const TOTAL_STEPS = 8;
const AUTO_SAVE_INTERVAL_MS = 30_000;

export function PostForm({ categories, userId, advertToEdit, locale, userPhone, isVerified = false }: PostFormProps) {
  const { t } = useI18n();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [advertId, setAdvertId] = useState<string | null>(advertToEdit?.id ?? null);
  const [selectedMainCategory, setSelectedMainCategory] = useState<string | null>(null);
  const [showMakeDropdown, setShowMakeDropdown] = useState(false);
  const makeDropdownRef = useRef<HTMLDivElement>(null);

  // Initialize form data from advertToEdit if editing
  const initializeFormData = () => {
    const specifics = advertToEdit?.specifics || {};
    const options: Record<string, boolean | string> = {};
    const catalogFields: Record<string, unknown> = {};
    
    // Extract options and catalog field values from specifics
    Object.entries(specifics).forEach(([key, value]) => {
      if (key.startsWith("option_")) {
        const optionKey = key.replace("option_", "");
        options[optionKey] = typeof value === "string" ? value : true;
        return;
      }

      if (key.startsWith("catalog_field_")) {
        const fieldKey = key.replace("catalog_field_", "");
        catalogFields[fieldKey] = value;
      }
    });

    return {
      category_id: advertToEdit?.category_id ?? "",
      condition: advertToEdit?.condition ?? "",
      make_id: (specifics as Record<string, unknown>).make_id as string || "",
      model_id: (specifics as Record<string, unknown>).model_id as string || "",
      year: (specifics as Record<string, unknown>).year ? parseInt(String((specifics as Record<string, unknown>).year)) : null,
      steering_wheel: (specifics as Record<string, unknown>).steering_wheel as string || "",
      body_type: (specifics as Record<string, unknown>).body_type as string || "",
      doors: (specifics as Record<string, unknown>).doors ? parseInt(String((specifics as Record<string, unknown>).doors)) : null,
      color_id: (specifics as Record<string, unknown>).color_id as string || "",
      color_code: (specifics as Record<string, unknown>).color_code as string || "",
      power: (specifics as Record<string, unknown>).power ? parseInt(String((specifics as Record<string, unknown>).power)) : null,
      engine_type: (specifics as Record<string, unknown>).engine_type as string || "",
      engine_volume: (specifics as Record<string, unknown>).engine_volume ? parseFloat(String((specifics as Record<string, unknown>).engine_volume)) : null,
      transmission: (specifics as Record<string, unknown>).transmission as string || "",
      drive: (specifics as Record<string, unknown>).drive as string || "",
      mileage: (specifics as Record<string, unknown>).mileage ? parseInt(String((specifics as Record<string, unknown>).mileage)) : null,
      vehicle_condition: (specifics as Record<string, unknown>).vehicle_condition as string || "",
      customs_cleared: (specifics as Record<string, unknown>).customs_cleared === "yes" ? true : (specifics as Record<string, unknown>).customs_cleared === "no" ? false : null,
      under_warranty: (specifics as Record<string, unknown>).under_warranty === "yes" ? true : (specifics as Record<string, unknown>).under_warranty === "no" ? false : null,
      owners_count: (specifics as Record<string, unknown>).owners_count ? parseInt(String((specifics as Record<string, unknown>).owners_count)) : null,
      vin: (specifics as Record<string, unknown>).vin as string || "",
      // F7: prefer the normalized FK column; fall back to JSONB for pre-migration records
      generation_id: (advertToEdit as any)?.generation_id as string
        ?? (specifics as Record<string, unknown>).generation_id as string
        ?? null,
      options,
      price: advertToEdit?.price ?? null,
      description: advertToEdit?.description ?? "",
      location: advertToEdit?.location ?? "",
      additional_phone: (specifics as Record<string, unknown>).additional_phone as string || "",
      additional_phone_verified: false, // Always reset - needs re-verification
      catalog_fields: catalogFields,
      title: advertToEdit?.title ?? "",
    };
  };

  // Form data state
  const [formData, setFormData] = useState(initializeFormData());
  
  // Category type detection state
  const [categoryType, setCategoryType] = useState<string>('generic');
  const schemaExcludedTypes = useRef(new Set(["vehicle", "real_estate", "electronics", "fashion", "jobs"]));

  type CatalogSchemaState = {
    loading: boolean;
    error: string | null;
    schema: CatalogSchema | null;
    fields: Record<string, CatalogFieldDefinition>;
  };

  const [catalogSchemaState, setCatalogSchemaState] = useState<CatalogSchemaState>({
    loading: false,
    error: null,
    schema: null,
    fields: {},
  });

  // Data fetching states
  const [makes, setMakes] = useState<any[]>([]);
  const [models, setModels] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [bodyTypes, setBodyTypes] = useState<string[]>([]);
  const [steeringWheels, setSteeringWheels] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [doors, setDoors] = useState<any[]>([]);
  const [vehicleConditions, setVehicleConditions] = useState<any[]>([]);
  const [engineTypes, setEngineTypes] = useState<any[]>([]);
  const [driveTypes, setDriveTypes] = useState<any[]>([]);
  const [vehicleOptions, setVehicleOptions] = useState<any[]>([]);
  const [makeSearchQuery, setMakeSearchQuery] = useState("");
  const [filteredMakes, setFilteredMakes] = useState<any[]>([]);
  const [availableTransmissions, setAvailableTransmissions] = useState<string[]>([]);
  const [availableFuelTypes, setAvailableFuelTypes] = useState<string[]>([]);

  // F7: generation resolution state (populated when model + year are selected)
  type GenerationCandidate = { id: string; code: string | null; start_year: number | null; end_year: number | null; facelift: boolean | null };
  const [generationStatus, setGenerationStatus] = useState<"idle" | "loading" | "unique" | "ambiguous" | "none">("idle");
  const [generationCandidates, setGenerationCandidates] = useState<GenerationCandidate[]>([]);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "pending" | "saving" | "saved" | "error">("idle");
  const [autoSaveError, setAutoSaveError] = useState<string | null>(null);
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<number | null>(null);
  // Flipped to true after the user completes inline phone verification at step 8.
  // Allows publish to proceed without a full page reload (isVerified is server-rendered).
  const [justVerified, setJustVerified] = useState(false);
  const [phoneVerificationOpen, setPhoneVerificationOpen] = useState(false);
  const [phoneVerificationCode, setPhoneVerificationCode] = useState("");
  const [phoneVerificationPhone, setPhoneVerificationPhone] = useState("");
  const [phoneVerificationError, setPhoneVerificationError] = useState<string | null>(null);
  const [phoneVerificationStatus, setPhoneVerificationStatus] = useState<
    "idle" | "sending" | "code_sent" | "verifying"
  >("idle");
  
  // Ref to track if draft creation is in progress
  const draftCreationInProgress = useRef(false);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedSnapshotRef = useRef<string | null>(null);
  const initialSnapshotCapturedRef = useRef(false);

  // Calculate form completion percentage
  const calculateProgress = (): number => {
    if (currentStep === 1) return formData.category_id ? 12.5 : 0;
    if (currentStep === 2) return formData.condition ? 25 : 12.5;
    if (currentStep === 3) {
      let filled = 0;
      if (formData.category_id) filled += 1;
      if (formData.condition) filled += 1;
      if (formData.make_id) filled += 1;
      if (formData.model_id) filled += 1;
      return Math.min(37.5 + (filled * 2), 37.5);
    }
    if (currentStep === 4) return 50;
    if (currentStep === 5) return 62.5;
    if (currentStep === 6) return 75;
    if (currentStep === 7) return 87.5;
    if (currentStep === 8) return 100;
    return (currentStep / TOTAL_STEPS) * 100;
  };

  // Helper functions
  const formatNumber = (value: number | null | undefined): string => {
    if (value === null || value === undefined) return "";
    return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const parseFormattedNumber = (value: string): number | null => {
    const cleaned = value.replace(/\s/g, "");
    return cleaned ? parseInt(cleaned) : null;
  };

  const formatUnit = (unitKey: string): string => {
    const unitMap: Record<string, Record<string, string>> = {
      hp: { en: "hp", ru: "л.с.", nl: "pk", fr: "ch", de: "PS" },
      L: { en: "L", ru: "л", nl: "L", fr: "L", de: "L" },
      km: { en: "km", ru: "км", nl: "km", fr: "km", de: "km" },
    };
    return unitMap[unitKey]?.[locale] || unitKey;
  };

  // Load reference data
  useEffect(() => {
    let cancelled = false;
    const loadReferenceData = async () => {
      try {
        // Load steering wheels
        const { data: sw } = await supabase.from("steering_wheel").select("*").order("name_ru");
        if (!cancelled && sw) setSteeringWheels(sw);

        // Load colors
        const { data: cols } = await supabase.from("vehicle_colors").select("*").order("name_ru");
        if (!cancelled && cols) setColors(cols);

        // Load doors
        const { data: drs } = await supabase.from("vehicle_doors").select("*").order("count");
        if (!cancelled && drs) setDoors(drs);

        // Load vehicle conditions
        const { data: vc } = await supabase.from("vehicle_conditions").select("*").order("name_ru");
        if (!cancelled && vc) setVehicleConditions(vc);

        // Load engine types
        const { data: et } = await supabase.from("engine_types").select("*").order("name_ru");
        if (!cancelled && et) setEngineTypes(et);

        // Load drive types
        const { data: dt } = await supabase.from("drive_types").select("*").order("name_ru");
        if (!cancelled && dt) setDriveTypes(dt);

        // Load vehicle options
        const { data: vo } = await supabase.from("vehicle_options").select("*").order("category, name_ru");
        if (!cancelled && vo) setVehicleOptions(vo);

        // Load makes (initially all)
        const { data: mk } = await supabase
          .from("vehicle_makes")
          .select("*, vehicle_make_i18n(name)")
          .eq("is_active", true)
          .order("name_en");
        if (!cancelled && mk) {
          setMakes(mk);
          setFilteredMakes(mk);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load reference data:", error);
        }
      }
    };

    loadReferenceData();
    return () => {
      cancelled = true;
    };
  }, []);
  
  // Detect category type when category changes
  useEffect(() => {
    if (formData.category_id && categories.length > 0) {
      const category = categories.find(c => c.id === formData.category_id);
      if (category) {
        const slugOrPath = category.path || category.slug;
        if (slugOrPath) {
          const detectedType = detectCategoryType(slugOrPath);
          setCategoryType(detectedType);
        } else {
          setCategoryType('generic');
        }
      } else {
        // Fallback to generic if category not found
        setCategoryType('generic');
      }
    }
  }, [formData.category_id, categories]);

  // Load catalog schema for non-bespoke categories
  useEffect(() => {
    let cancelled = false;

    const shouldLoadSchema =
      formData.category_id &&
      !schemaExcludedTypes.current.has(categoryType);

    if (!shouldLoadSchema) {
      if (!cancelled) {
        setCatalogSchemaState({
          loading: false,
          error: null,
          schema: null,
          fields: {},
        });
      }
      return;
    }

    const loadSchema = async () => {
      setCatalogSchemaState((prev) => ({
        ...prev,
        loading: true,
        error: null,
      }));

      try {
        const response = await apiFetch(`/api/catalog/schema?category_id=${formData.category_id}`);
        if (cancelled) return;

        if (!response.ok) {
          let message = "Failed to load schema";
          try {
            const problem = await response.json();
            message = problem?.error || problem?.message || message;
          } catch {
            // ignore
          }
          setCatalogSchemaState({
            loading: false,
            error: message,
            schema: null,
            fields: {},
          });
          return;
        }

        const payload = await response.json();
        if (cancelled) return;

        if (!payload?.ok || !payload?.data) {
          setCatalogSchemaState({
            loading: false,
            error: "Schema not available",
            schema: null,
            fields: {},
          });
          return;
        }

        setCatalogSchemaState({
          loading: false,
          error: null,
          schema: {
            version: payload.data.schema.version,
            steps: payload.data.schema.steps,
          },
          fields: payload.data.fields as Record<string, CatalogFieldDefinition>,
        });
      } catch (error: any) {
        if (cancelled) return;
        setCatalogSchemaState({
          loading: false,
          error: error?.message || "Schema request failed",
          schema: null,
          fields: {},
        });
      }
    };

    loadSchema();

    return () => {
      cancelled = true;
    };
  }, [formData.category_id, categoryType]);

  // Filter makes based on search
  useEffect(() => {
    if (!makeSearchQuery) {
      setFilteredMakes(makes);
      setShowMakeDropdown(false);
      return;
    }

    const query = makeSearchQuery.toLowerCase();
    const filtered = makes.filter(
      (make) =>
        make.name_en?.toLowerCase().includes(query) ||
        make.vehicle_make_i18n?.some((i18n: any) => i18n.name?.toLowerCase().includes(query))
    );
    setFilteredMakes(filtered);
    setShowMakeDropdown(filtered.length > 0);
  }, [makeSearchQuery, makes]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (makeDropdownRef.current && !makeDropdownRef.current.contains(event.target as Node)) {
        setShowMakeDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Load models when make is selected
  useEffect(() => {
    if (!formData.make_id) {
      setModels([]);
      setAvailableYears([]);
      setBodyTypes([]);
      return;
    }

    let cancelled = false;
    const loadModels = async () => {
      try {
        const { data: mods } = await supabase
          .from("vehicle_models")
          .select("*, vehicle_model_i18n(name)")
          .eq("make_id", formData.make_id)
          .order("name_en");

        if (!cancelled && mods) {
          setModels(mods);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load models:", error);
        }
      }
    };

    loadModels();
    return () => {
      cancelled = true;
    };
  }, [formData.make_id]);

  // Load years and body types when model is selected
  useEffect(() => {
    if (!formData.model_id) {
      setAvailableYears([]);
      setBodyTypes([]);
      return;
    }

    const model = models.find((m) => m.id === formData.model_id);
    if (model) {
      if (model.years_available) {
        setAvailableYears([...model.years_available].sort((a, b) => b - a));
      }
      if (model.body_types_available && Array.isArray(model.body_types_available)) {
        setBodyTypes(model.body_types_available as string[]);
      }
    }
  }, [formData.model_id, models]);

  // Load transmission and fuel types based on selected model
  useEffect(() => {
    if (!formData.model_id) {
      setAvailableTransmissions([]);
      setAvailableFuelTypes([]);
      return;
    }

    const model = models.find((m) => m.id === formData.model_id);
    if (model) {
      if (model.transmission_available && Array.isArray(model.transmission_available)) {
        setAvailableTransmissions(model.transmission_available as string[]);
      }
      if (model.fuel_types_available && Array.isArray(model.fuel_types_available)) {
        setAvailableFuelTypes(model.fuel_types_available as string[]);
      }
    }
  }, [formData.model_id, models]);

  // F7: resolve vehicle generation when model + year are both set
  useEffect(() => {
    if (!formData.model_id) {
      setGenerationStatus("idle");
      setGenerationCandidates([]);
      return;
    }

    let cancelled = false;
    setGenerationStatus("loading");

    const params = new URLSearchParams({ modelId: formData.model_id });
    if (formData.year) params.set("year", formData.year.toString());

    apiFetch(`/api/catalog/resolve-generation?${params}`)
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        if (json.ok) {
          const { status, candidates } = json.data;
          setGenerationStatus(status);
          setGenerationCandidates(candidates ?? []);
          if (status === "unique" && candidates?.length === 1) {
            setFormData((prev: any) => ({ ...prev, generation_id: candidates[0].id }));
          } else if (status !== "ambiguous") {
            setFormData((prev: any) => ({ ...prev, generation_id: null }));
          }
        } else {
          setGenerationStatus("none");
        }
      })
      .catch(() => {
        if (!cancelled) setGenerationStatus("none");
      });

    return () => { cancelled = true; };
  }, [formData.model_id, formData.year]);

  // Create or get advert ID (defined before useEffect that uses it)
  const ensureAdvertId = useCallback(async (): Promise<string> => {
    if (advertId) return advertId;
    
    console.log("[PostForm] Creating new draft...");
    const response = await apiFetch("/api/adverts", { method: "POST" });
    const result = await response.json();
    console.log("[PostForm] Draft API response:", result);

    if (!result.ok) {
      console.error("[PostForm] Draft creation failed:", result.error);
      throw new Error(getAdvertApiErrorMessage(result, t, t("post.create_failed")));
    }
    
    const newId = result.data?.advert?.id;
    if (!newId) {
      console.error("[PostForm] No advert ID in response:", result);
      throw new Error("Failed to create draft");
    }
    
    console.log("[PostForm] Draft created successfully:", newId);
    setAdvertId(newId);
    return newId;
  }, [advertId, t]);

  // Auto-create draft when reaching step 7 (for photo upload)
  useEffect(() => {
    if (currentStep === 7 && !advertId && !isLoading && !draftCreationInProgress.current) {
      console.log("[PostForm] Auto-creating draft for step 7...");
      draftCreationInProgress.current = true;
      const createDraft = async () => {
        try {
          const newId = await ensureAdvertId();
          console.log("[PostForm] Draft created, ID:", newId);
          toast.success(t("post.draft_created") || "Draft created");
        } catch (error: any) {
          console.error("[PostForm] Draft creation error:", error);
          toast.error(t("post.update_error") || "Update failed", {
            description: error.message 
          });
        } finally {
          draftCreationInProgress.current = false;
        }
      };
      createDraft();
    }
  }, [currentStep, advertId, isLoading, t, ensureAdvertId]);

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS) {
      let targetStep = currentStep + 1;
      
      // For jobs: special navigation
      if (categoryType === 'jobs') {
        if (currentStep === 1) targetStep = 4; // Skip 2, 3
        if (currentStep === 4) targetStep = 7; // Skip 5, 6
      } else {
        // Skip step 3 for non-vehicles when going forward from step 2
        if (currentStep === 2 && categoryType !== 'vehicle' && targetStep === 3) {
          targetStep = 4;
        }
        
        // Skip step 6 for non-vehicles when going forward from step 5
        if (currentStep === 5 && categoryType !== 'vehicle' && targetStep === 6) {
          targetStep = 7;
        }
      }
      
      setCurrentStep(targetStep);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      let targetStep = currentStep - 1;
      
      // For jobs: special navigation
      if (categoryType === 'jobs') {
        if (currentStep === 4) targetStep = 1; // Skip 3, 2
        if (currentStep === 7) targetStep = 4; // Skip 6, 5
      } else {
        // Skip step 3 for non-vehicles when going back from step 4
        if (currentStep === 4 && categoryType !== 'vehicle' && targetStep === 3) {
          targetStep = 2;
        }
        
        // Skip step 6 for non-vehicles when going back from step 7
        if (currentStep === 7 && categoryType !== 'vehicle' && targetStep === 6) {
          targetStep = 5;
        }
      }
      
      setCurrentStep(targetStep);
    }
  };

  const handleSchemaFieldChange = useCallback((fieldKey: string, value: unknown) => {
    setFormData((prev) => {
      const next = { ...prev.catalog_fields };
      const isEmpty =
        value === null ||
        value === undefined ||
        value === "" ||
        (typeof value === "number" && Number.isNaN(value));

      if (isEmpty) {
        delete next[fieldKey];
      } else {
        next[fieldKey] = value;
      }

      return {
        ...prev,
        catalog_fields: next,
      };
    });
  }, []);

  const resolveCatalogFieldLabel = useCallback(
    (fieldDef: CatalogFieldDefinition | undefined, schemaField: CatalogSchemaField) => {
      if (!fieldDef) return schemaField.field_key;
      const labelKey =
        schemaField.label_i18n_key ??
        fieldDef.label_i18n_key ??
        `catalog.field.${fieldDef.field_key}.label`;
      return t(labelKey);
    },
    [t],
  );

  const validateSchemaFields = useCallback((): string[] => {
    if (schemaExcludedTypes.current.has(categoryType)) {
      return [];
    }

    const schema = catalogSchemaState.schema;
    if (!schema || !Array.isArray(schema.steps) || schema.steps.length === 0) {
      return [];
    }

    const fieldMap = catalogSchemaState.fields;
    const values = formData.catalog_fields ?? {};
    const errors: string[] = [];

    const steps = Array.isArray(schema.steps) ? schema.steps : [];

    for (const step of steps) {
      const groups = Array.isArray(step.groups) ? step.groups : [];
      for (const group of groups) {
        const fields = Array.isArray(group.fields) ? group.fields : [];
        for (const schemaField of fields) {
          const fieldDef = fieldMap[schemaField.field_key];
          if (!fieldDef) continue;

          const label = resolveCatalogFieldLabel(fieldDef, schemaField);
          const value = values[schemaField.field_key];
          const required = schemaField.optional === true ? false : fieldDef.is_required;
          const hasValue =
            value !== undefined &&
            value !== null &&
            !(typeof value === "string" && value.trim() === "");

          if (required && !hasValue) {
            errors.push(t("catalog.common.validation.required", { field: label }));
            continue;
          }

          if (!hasValue) {
            continue;
          }

          if (fieldDef.field_type === "number") {
            const numericValue = typeof value === "number" ? value : Number(value);
            if (Number.isNaN(numericValue)) {
              errors.push(t("catalog.common.validation.required", { field: label }));
              continue;
            }

            const min = schemaField.min_value ?? fieldDef.min_value;
            if (typeof min === "number" && numericValue < min) {
              errors.push(t("catalog.common.validation.number_min", { field: label, min }));
            }

            const max = schemaField.max_value ?? fieldDef.max_value;
            if (typeof max === "number" && numericValue > max) {
              errors.push(t("catalog.common.validation.number_max", { field: label, max }));
            }
          }

          if (fieldDef.field_type === "select") {
            const options = fieldDef.options ?? [];
            if (!options.some((opt) => opt.code === value)) {
              errors.push(t("catalog.common.validation.option_invalid", { field: label }));
            }
          }
        }
      }
    }

    return errors;
  }, [categoryType, catalogSchemaState, formData.catalog_fields, resolveCatalogFieldLabel, t]);

  // Prepare vehicle specifics from form data
  const prepareSpecifics = useCallback(() => {
    const specifics: Record<string, string> = {};

    if (categoryType === "vehicle") {
      if (formData.make_id) specifics.make_id = formData.make_id;
      if (formData.model_id) specifics.model_id = formData.model_id;
      if (formData.year) specifics.year = formData.year.toString();
      // F7: persist explicit generation choice (from chooser or unique auto-resolve)
      if ((formData as any).generation_id) specifics.generation_id = (formData as any).generation_id;
      if (formData.steering_wheel) specifics.steering_wheel = formData.steering_wheel;
      if (formData.body_type) specifics.body_type = formData.body_type;
      if (formData.doors) specifics.doors = formData.doors.toString();
      if (formData.color_id) specifics.color_id = formData.color_id;
      if (formData.color_code) specifics.color_code = formData.color_code;
      if (formData.power) specifics.power = formData.power.toString();
      if (formData.engine_type) specifics.engine_type = formData.engine_type;
      if (formData.engine_volume) specifics.engine_volume = formData.engine_volume.toString();
      if (formData.transmission) specifics.transmission = formData.transmission;
      if (formData.drive) specifics.drive = formData.drive;
      if (formData.mileage) specifics.mileage = formData.mileage.toString();
      if (formData.vehicle_condition) specifics.vehicle_condition = formData.vehicle_condition;
      if (formData.customs_cleared !== null) specifics.customs_cleared = formData.customs_cleared ? "yes" : "no";
      if (formData.under_warranty !== null) specifics.under_warranty = formData.under_warranty ? "yes" : "no";
      if (formData.owners_count !== null && formData.owners_count !== undefined) {
        specifics.owners_count = formData.owners_count.toString();
      }
      if (formData.vin) specifics.vin = formData.vin;

      // Add all options
      Object.entries(formData.options).forEach(([key, value]) => {
        if (value) {
          specifics[`option_${key}`] = typeof value === "string" ? value : "true";
        }
      });
    }

    // Add dynamic schema-driven values for non-bespoke categories (or in addition)
    const dynamicFields = formData.catalog_fields ?? {};
    Object.entries(dynamicFields).forEach(([key, rawValue]) => {
      if (rawValue === null || rawValue === undefined || rawValue === "") {
        return;
      }
      if (typeof rawValue === "boolean") {
        specifics[`catalog_field_${key}`] = rawValue ? "true" : "false";
      } else {
        specifics[`catalog_field_${key}`] = String(rawValue);
      }
    });

    if (formData.additional_phone) specifics.additional_phone = formData.additional_phone;

    return specifics;
  }, [categoryType, formData]);

  const hasMeaningfulChanges = useCallback(() => {
    if (formData.category_id) return true;
    if (formData.condition) return true;
    if (formData.description && formData.description.trim().length > 0) return true;
    if (formData.location && formData.location.trim().length > 0) return true;
    if (formData.price !== null && formData.price !== undefined) return true;
    if (formData.additional_phone && formData.additional_phone.trim().length > 0) return true;

    if (formData.catalog_fields && Object.keys(formData.catalog_fields).length > 0) return true;
    if (formData.options && Object.values(formData.options).some((value) => Boolean(value))) return true;

    const specifics = prepareSpecifics();
    if (Object.keys(specifics).length > 0) return true;

    return false;
  }, [formData, prepareSpecifics]);

  const createDraftSnapshot = useCallback(() => {
    if (!hasMeaningfulChanges()) {
      return null;
    }

    const toSortedObject = (source: Record<string, unknown>) =>
      Object.fromEntries(Object.entries(source).sort(([a], [b]) => a.localeCompare(b)));

    const specifics = toSortedObject(prepareSpecifics());

    const normalizedOptions: Record<string, unknown> = {};
    Object.entries(formData.options ?? {}).forEach(([key, value]) => {
      if (value !== null && value !== undefined && value !== false && value !== "") {
        normalizedOptions[key] = value;
      }
    });

    return JSON.stringify({
      category_id: formData.category_id || "",
      condition: formData.condition || "",
      description: formData.description || "",
      price: formData.price,
      location: formData.location || "",
      additional_phone: formData.additional_phone || "",
      additional_phone_verified: formData.additional_phone_verified || false,
      options: toSortedObject(normalizedOptions),
      catalog_fields: toSortedObject(formData.catalog_fields ?? {}),
      specifics,
    });
  }, [formData, hasMeaningfulChanges, prepareSpecifics]);

  useEffect(() => {
    if (initialSnapshotCapturedRef.current) {
      return;
    }

    const snapshot = createDraftSnapshot();
    if (snapshot) {
      lastSavedSnapshotRef.current = snapshot;
      if (advertToEdit) {
        setAutoSaveStatus("saved");
        setLastAutoSaveAt(Date.now());
      }
    } else {
      lastSavedSnapshotRef.current = null;
    }

    initialSnapshotCapturedRef.current = true;
  }, [advertToEdit, createDraftSnapshot]);

  const saveDraftMutation = useCallback(
    async ({ auto = false }: { auto?: boolean } = {}) => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }

      const snapshotBeforeSave = createDraftSnapshot();

      if (auto) {
        if (!hasMeaningfulChanges() || !snapshotBeforeSave) {
          setAutoSaveStatus("idle");
          setAutoSaveError(null);
          return false;
        }
      }

      if (auto) {
        setAutoSaveStatus("saving");
      } else {
        setIsLoading(true);
        setAutoSaveStatus("saving");
      }
      setAutoSaveError(null);

      try {
        const id = await ensureAdvertId();

        const draftLabel = t("post.draft");
        const fallbackDraftLabel = draftLabel && draftLabel !== "post.draft" ? draftLabel : "Draft";

        const makeName = formData.make_id ? makes.find((m) => m.id === formData.make_id)?.name_en ?? "" : "";
        const modelName = formData.model_id ? models.find((m) => m.id === formData.model_id)?.name_en ?? "" : "";
        const yearValue = formData.year ? String(formData.year) : "";
        const vehicleTitleParts = [makeName, modelName, yearValue].filter((part) => part && part.length > 0);
        let title = vehicleTitleParts.join(" ").trim();

        if (!title) {
          if (formData.category_id) {
            const category = categories.find((c) => c.id === formData.category_id);
            const localized =
              (category?.[`name_${locale}` as keyof Category] as string) ??
              category?.name_ru ??
              category?.name_en ??
              "";
            title = localized ? `${localized} - ${fallbackDraftLabel}`.trim() : fallbackDraftLabel;
          } else {
            title = fallbackDraftLabel;
          }
        }

        const payload: Record<string, unknown> = {
          title,
          category_id: formData.category_id || undefined,
          condition: formData.condition || undefined,
          description: formData.description || undefined,
          price: formData.price !== null ? formData.price : undefined,
          location: formData.location || undefined,
          currency: "EUR",
          status: "draft",
          specifics: prepareSpecifics(),
          content_locale: locale,
        };

        Object.keys(payload).forEach((key) => {
          if (payload[key] === undefined) {
            delete payload[key];
          }
        });

        const response = await apiFetch(`/api/adverts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const result = await response.json();
        if (!result.ok) {
          throw new Error(getAdvertApiErrorMessage(result, t, t("post.update_error")));
        }

        const snapshotAfterSave = snapshotBeforeSave ?? createDraftSnapshot();
        if (snapshotAfterSave) {
          lastSavedSnapshotRef.current = snapshotAfterSave;
        } else {
          lastSavedSnapshotRef.current = null;
        }

        setLastAutoSaveAt(Date.now());
        setAutoSaveStatus("saved");
        setAutoSaveError(null);

        if (!auto) {
          toast.success(t("post.form.save_draft"));
        }

        return true;
      } catch (error: any) {
        const message = error?.message || t("post.update_error");
        setAutoSaveStatus("error");
        setAutoSaveError(message);
        if (!auto) {
          toast.error(t("post.update_error"), { description: message });
        } else {
          console.error("[PostForm] Auto-save error:", error);
        }
        return false;
      } finally {
        if (!auto) {
          setIsLoading(false);
        }
      }
    },
    [
      categories,
      createDraftSnapshot,
      ensureAdvertId,
      formData,
      hasMeaningfulChanges,
      locale,
      makes,
      models,
      prepareSpecifics,
      t,
    ],
  );

  useEffect(() => {
    if (!initialSnapshotCapturedRef.current) {
      return;
    }

    if (autoSaveStatus === "saving") {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      return;
    }

    const snapshot = createDraftSnapshot();

    if (!snapshot) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      if (lastSavedSnapshotRef.current !== null) {
        lastSavedSnapshotRef.current = null;
      }
      if (autoSaveStatus !== "idle") {
        setAutoSaveStatus("idle");
      }
      setAutoSaveError(null);
      return;
    }

    if (lastSavedSnapshotRef.current && lastSavedSnapshotRef.current === snapshot) {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      setAutoSaveStatus((prev) => {
        if (prev === "saved") return prev;
        if (prev === "pending" || prev === "error") {
          return "saved";
        }
        return prev;
      });
      return;
    }

    setAutoSaveError(null);

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      saveDraftMutation({ auto: true }).catch(() => undefined);
    }, AUTO_SAVE_INTERVAL_MS);

    setAutoSaveStatus((prev) => {
      if (prev === "saving" || prev === "pending") {
        return prev;
      }
      return "pending";
    });

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, [autoSaveStatus, createDraftSnapshot, saveDraftMutation]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
    };
  }, []);

  const handleSaveDraft = useCallback(async () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    await saveDraftMutation({ auto: false });
  }, [saveDraftMutation]);
  
  const handlePublish = async () => {
    const schemaErrors = validateSchemaFields();
    if (schemaErrors.length > 0) {
      toast.error(t("post.update_error"), { description: schemaErrors.join("\n") });
      return;
    }

    setIsLoading(true);
    try {
      const id = await ensureAdvertId();
      
      // Validate required fields
      if (!formData.category_id) {
        throw new Error(t("post.select_category"));
      }
      if (!formData.condition) {
        throw new Error(t("post.select_condition"));
      }

      // Validate description (min 10 characters required by API)
      if (!formData.description || formData.description.trim().length < 10) {
        throw new Error(t("post.form.description_min"));
      }

      // Location is required to publish (PRD 31 §4)
      if (!formData.location || formData.location.trim().length === 0) {
        throw new Error(t("post.form.location_required") !== "post.form.location_required"
          ? t("post.form.location_required")
          : "Location is required to publish");
      }

      // Check if at least one photo is uploaded
      let hasUploadedMedia = true;
      try {
        const mediaResponse = await apiFetch(`/api/media/list?advertId=${id}`);
        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          if (mediaData.ok) {
            hasUploadedMedia = Boolean(mediaData.data?.items?.length);
          }
        }
      } catch (mediaError: any) {
        // If media check fails for other reasons, let API handle it, but log for debugging
        console.warn("Media check failed:", mediaError);
      }
      if (!hasUploadedMedia) {
        throw new Error(t("post.form.media_required"));
      }

      // Use user-provided title, or auto-generate from category/vehicle fields
      let title = (formData.title ?? "").trim();
      if (!title) {
        if (formData.make_id && formData.model_id && formData.year) {
          const makeName = makes.find((m) => m.id === formData.make_id)?.name_en || "";
          const modelName = models.find((m) => m.id === formData.model_id)?.name_en || "";
          title = `${makeName} ${modelName} ${formData.year}`.trim();
        } else {
          const categoryName = categories.find((c) => c.id === formData.category_id)?.[`name_${locale}` as keyof Category] as string ||
                             categories.find((c) => c.id === formData.category_id)?.name_ru || "";
          title = `${categoryName} - ${formData.price ? `${formData.price} EUR` : ""}`.trim();
        }
      }

      if (title.length < 3) {
        title = categories.find((c) => c.id === formData.category_id)?.[`name_${locale}` as keyof Category] as string ||
                categories.find((c) => c.id === formData.category_id)?.name_ru || "Advert";
      }

      // SEO: warn if title is outside 10–70 chars (soft — not a hard block; supply-first)
      if (title.length > 0 && (title.length < 10 || title.length > 70)) {
        const hint = t("post.form.title_hint") !== "post.form.title_hint"
          ? t("post.form.title_hint")
          : "Best titles are 10–70 characters: brand + model + key feature";
        toast(hint, { description: `Current: ${title.length} chars` });
      }

      const payload: Record<string, unknown> = {
        title,
        category_id: formData.category_id,
        condition: formData.condition,
        description: formData.description || undefined,
        price: formData.price !== null ? formData.price : undefined,
        location: formData.location || undefined,
        currency: "EUR",
        status: "active",
        specifics: prepareSpecifics(),
        content_locale: locale,
      };

      // Remove undefined values
      Object.keys(payload).forEach((key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      });

      const response = await apiFetch(`/api/adverts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Parse response once
      let result;
      try {
        result = await response.json();
      } catch (parseError) {
        // If JSON parsing fails, create error from response status
        const errorMessage = response.ok 
          ? t("post.update_error")
          : `${t("post.update_error")}: ${response.status} ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // Check response status and result
      if (!response.ok || !result.ok) {
        throw new Error(getAdvertApiErrorMessage(result, t, t("post.update_error")));
      }

      toast.success(t("post.published"));
      // ?published=1 arms the one-time share banner on the ad page (share loop)
      router.push(`/ad/${id}?published=1`);
    } catch (error: any) {
      console.error("Publish error:", error);
      const errorMessage = error.message || error.toString() || t("post.update_error");
      toast.error(t("post.update_error"), { description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAdditionalPhone = async () => {
    if (!formData.additional_phone || !formData.additional_phone.startsWith("+32")) {
      toast.error(t("post.update_error"), { description: "Phone must start with +32" });
      return;
    }

    const phone = formData.additional_phone;
    setPhoneVerificationStatus("sending");
    setPhoneVerificationError(null);
    setPhoneVerificationCode("");
    try {
      const requestResponse = await apiFetch("/api/phone/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const requestResult = await requestResponse.json();
      if (!requestResult.ok) {
        if (requestResult.error === "PHONE_ALREADY_REGISTERED") {
          throw new Error(t("trust.phone_already_registered"));
        }
        if (requestResult.error === "PHONE_NOT_BELGIAN_MOBILE") {
          throw new Error(t("trust.phone_not_belgian_mobile"));
        }
        if (requestResult.error === "PHONE_LINE_TYPE_BLOCKED") {
          throw new Error(t("trust.phone_line_type_blocked"));
        }
        throw new Error(requestResult.message || requestResult.error || "Failed to send OTP");
      }

      setPhoneVerificationPhone(phone);
      setPhoneVerificationOpen(true);
      setPhoneVerificationStatus("code_sent");
      toast.success("Verification code sent", { description: phone });
    } catch (error: any) {
      const message = error.message || "Failed to send verification code";
      setPhoneVerificationError(message);
      setPhoneVerificationStatus("idle");
      toast.error(t("post.update_error"), { description: message });
    }
  };

  const handleSubmitAdditionalPhoneCode = async () => {
    const code = phoneVerificationCode.trim();
    const phone = phoneVerificationPhone || formData.additional_phone;

    if (!phone) {
      setPhoneVerificationError("Enter a phone number first.");
      return;
    }

    if (code.length < 6) {
      setPhoneVerificationError("Enter the 6-digit SMS code.");
      return;
    }

    setPhoneVerificationStatus("verifying");
    setPhoneVerificationError(null);
    try {
      const verifyResponse = await apiFetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code }),
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResult.ok) {
        if (verifyResult.error === "PHONE_ALREADY_REGISTERED") {
          throw new Error(t("trust.phone_already_registered"));
        }
        if (verifyResult.error === "PHONE_NOT_BELGIAN_MOBILE") {
          throw new Error(t("trust.phone_not_belgian_mobile"));
        }
        if (verifyResult.error === "PHONE_LINE_TYPE_BLOCKED") {
          throw new Error(t("trust.phone_line_type_blocked"));
        }
        throw new Error(verifyResult.message || verifyResult.error || "Invalid verification code");
      }

      setFormData((previous) => ({
        ...previous,
        additional_phone: phone,
        additional_phone_verified: true,
      }));
      setPhoneVerificationOpen(false);
      setPhoneVerificationCode("");
      setPhoneVerificationStatus("idle");
      toast.success(t("profile.verified"));
    } catch (error: any) {
      const message = error.message || "Invalid verification code";
      setPhoneVerificationError(message);
      setPhoneVerificationStatus("code_sent");
      toast.error(t("post.update_error"), { description: message });
    }
  };

  const handleDeleteAdvert = async () => {
    if (!advertId) {
      toast.error(t("post.update_error"), { description: "No advert to delete" });
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiFetch(`/api/adverts/${advertId}`, {
        method: "DELETE",
      });

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.message || result.error || "Failed to delete");
      }

      toast.success("Listing deleted");
      router.push("/profile");
    } catch (error: any) {
      toast.error(t("post.update_error"), { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Progress indicator component
  const ProgressIndicator = () => {
    const progress = calculateProgress();
    const localeMap: Record<string, string> = {
      ru: "ru-RU",
      nl: "nl-NL",
      fr: "fr-FR",
      de: "de-DE",
    };
    const renderAutoSaveStatus = () => {
      if (autoSaveStatus === "idle") {
        return null;
      }

      let messageKey = "post.auto_save.pending";
      let toneClass = "text-muted-foreground";

      if (autoSaveStatus === "saving") {
        messageKey = "post.auto_save.saving";
        toneClass = "text-primary";
      } else if (autoSaveStatus === "saved") {
        messageKey = "post.auto_save.saved";
        toneClass = "text-primary";
      } else if (autoSaveStatus === "error") {
        messageKey = "post.auto_save.error";
        toneClass = "text-destructive";
      } else if (autoSaveStatus === "pending") {
        toneClass = "text-muted-foreground";
      }

      let message = t(messageKey);
      if (message === messageKey) {
        // Fallback to English if translation missing
        const fallbacks: Record<string, string> = {
          "post.auto_save.pending": "Unsaved changes",
          "post.auto_save.saving": "Saving draft...",
          "post.auto_save.saved": "Draft saved",
          "post.auto_save.error": "Auto-save failed",
        };
        message = fallbacks[messageKey] ?? messageKey;
      }

      if (autoSaveStatus === "saved" && lastAutoSaveAt) {
        const formatter = new Intl.DateTimeFormat(localeMap[locale] ?? "en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });
        message = `${message} · ${formatter.format(new Date(lastAutoSaveAt))}`;
      }

      if (autoSaveStatus === "error" && autoSaveError) {
        message = `${message}: ${autoSaveError}`;
      }

      return <p className={`mt-2 text-xs ${toneClass}`}>{message}</p>;
    };

    // Calculate effective remaining steps based on category type
    const effectiveTotal = categoryType === 'jobs' ? 5 : categoryType === 'vehicle' ? 8 : 6;
    const stepsRemaining = Math.max(0, TOTAL_STEPS - currentStep);

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-muted-foreground" aria-label={`Step ${currentStep} of ${effectiveTotal}`}>
            {t("post.form.step")} {currentStep} {t("post.form.of")} {effectiveTotal}
          </span>
          {stepsRemaining > 0 ? (
            <span className="text-xs font-medium text-muted-foreground">
              {stepsRemaining === 1
                ? (t("post.form.one_more_step") !== "post.form.one_more_step" ? t("post.form.one_more_step") : "1 more step to publish")
                : (t("post.form.steps_remaining") !== "post.form.steps_remaining"
                    ? t("post.form.steps_remaining").replace("{n}", String(stepsRemaining))
                    : `${stepsRemaining} more steps to publish`)}
            </span>
          ) : (
            <span className="text-sm font-bold text-primary tabular-nums">
              {Math.round(progress)}%
            </span>
          )}
        </div>
        <div
          className="w-full bg-muted rounded-full h-2.5 overflow-hidden"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t("post.form.progress_label") !== "post.form.progress_label" ? t("post.form.progress_label") : "Listing completion progress"}
        >
          <div
            className="lyvox-trust-gradient rounded-full h-2.5 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {renderAutoSaveStatus()}
      </div>
    );
  };

  // Helper function to get localized category name
  const getCategoryName = (cat: Category): string => {
    // Map locale to category name field
    const localeMap: Record<string, string> = {
      en: "name_en",
      nl: "name_nl",
      fr: "name_fr",
      de: "name_de",
      ru: "name_ru",
    };
    const nameKey = localeMap[locale] || localeMap.en;
    return (cat[nameKey as keyof Category] as string) || cat.name_ru || cat.name_en || "";
  };

  // Group categories: main categories (level 1) with their subcategories (level 2)
  const groupedCategories = categories.reduce((acc, cat) => {
    if (cat.level === 1) {
      acc.push({
        main: cat,
        subcategories: categories.filter((c) => c.parent_id === cat.id && c.level === 2),
      });
    }
    return acc;
  }, [] as Array<{ main: Category; subcategories: Category[] }>);

  // Color scheme for category blocks (design-system tokens, "trust in colour")
  const categoryColors = [
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
    { bg: "bg-card", border: "border-border/70", hover: "hover:bg-muted/60", text: "text-foreground", icon: "text-primary" },
  ];

  const handleCategorySelect = (mainCat: Category, subCat?: Category) => {
    if (subCat) {
      // If subcategory clicked, select it immediately
      setFormData((prev) => ({
        ...prev,
        category_id: subCat.id,
        catalog_fields: {},
      }));
      setSelectedMainCategory(null);
    } else if (mainCat) {
      // If main category clicked and has subcategories, show subcategories
      const subcats = categories.filter((c) => c.parent_id === mainCat.id && c.level === 2);
      if (subcats.length > 0) {
        setSelectedMainCategory(mainCat.id);
      } else {
        // No subcategories, select main category directly
        setFormData((prev) => ({
          ...prev,
          category_id: mainCat.id,
          catalog_fields: {},
        }));
      }
    }
  };

  // Step 1: Category selection
  if (currentStep === 1) {
  return (
    <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
      <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_1_title")}</CardTitle>
      </CardHeader>
        <CardContent>
          <ProgressIndicator />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {groupedCategories.map((group, index) => {
              const Icon = getCategoryIcon(group.main.icon, group.main.level);
              const colors = categoryColors[index % categoryColors.length];
              const hasSubcategories = group.subcategories.length > 0;
              const isMainSelected = formData.category_id === group.main.id;
              const isSubSelected = group.subcategories.some(sub => sub.id === formData.category_id);
              const showSubcategories = selectedMainCategory === group.main.id;

              return (
                <div
                  key={group.main.id}
                  className={`${colors.bg} ${colors.border} border rounded-xl p-4 shadow-[var(--shadow-soft)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-card)] hover:border-primary/40 ${
                    (isMainSelected || isSubSelected) ? "ring-2 ring-primary border-primary/50" : ""
                  }`}
                >
                  <div 
                    data-testid={`category-${group.main.slug}`}
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => handleCategorySelect(group.main)}
                  >
                    <div className={`${colors.icon} flex-shrink-0`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`${colors.text} font-bold tracking-tight text-lg`}>
                          {getCategoryName(group.main)}
                        </h3>
                        {hasSubcategories && (
                          <ChevronDown 
                            className={`w-5 h-5 ${colors.icon} transition-transform ${showSubcategories ? "rotate-180" : ""}`}
                          />
                        )}
                        {isMainSelected && !hasSubcategories && (
                          <Check className="w-5 h-5 text-primary" />
                        )}
                      </div>
                      {hasSubcategories && !showSubcategories && (
                        <p className="text-sm text-muted-foreground">
                          {group.subcategories.length} {t("post.form.subcategories_count")}
                        </p>
                      )}
                      {!hasSubcategories && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {t("post.form.click_to_select")}
                        </p>
                      )}
                    </div>
                  </div>
                  {showSubcategories && group.subcategories.length > 0 && (
                    <div className="space-y-2 mt-4 pt-4 border-t border-border/70">
                      {group.subcategories.map((subCat) => {
                        const SubIcon = getCategoryIcon(subCat.icon, subCat.level);
                        const isSubCatSelected = formData.category_id === subCat.id;
                        return (
                          <div
                            key={subCat.id}
                            data-testid={`subcategory-${subCat.slug}`}
                            onClick={() => handleCategorySelect(group.main, subCat)}
                            className={`bg-muted/40 ${colors.border} border rounded-xl p-3 min-h-[44px] ${colors.hover} flex items-center gap-3 cursor-pointer transition-all ${
                              isSubCatSelected ? "ring-2 ring-primary border-primary/50" : ""
                            }`}
                          >
                            <SubIcon className={`w-5 h-5 ${colors.icon}`} />
                            <span className={`${colors.text} text-sm font-medium flex-1`}>
                              {getCategoryName(subCat)}
                            </span>
                            {isSubCatSelected && (
                              <Check className="w-5 h-5 text-primary" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
        <CardFooter className="flex justify-end sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button size="lg" onClick={handleNext} disabled={!formData.category_id}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 2: Condition selection
  if (currentStep === 2) {
    // For jobs, this step is skipped via handleNext/handleBack
    if (categoryType === 'jobs') {
      // Auto-advance to step 4 (step 3 will also be skipped)
      // Set default condition for jobs
      if (formData.condition !== 'used') {
        setFormData({ ...formData, condition: 'used' });
      }
      setCurrentStep(4);
      return null;
    }
    
    // Determine which conditions are available based on category type
    const showForParts = ['vehicle', 'electronics'].includes(categoryType);
    
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_2_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressIndicator />
          <Select
            value={formData.condition || ""}
            onValueChange={(value) => setFormData({ ...formData, condition: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("post.select_condition")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">{t("post.new")}</SelectItem>
              <SelectItem value="used">{t("post.used")}</SelectItem>
              {showForParts && (
                <SelectItem value="for_parts">{t("post.for_parts")}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </CardContent>
        <CardFooter className="flex justify-between gap-3 sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button variant="outline" size="lg" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button size="lg" onClick={handleNext} disabled={!formData.condition}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 3: Basic parameters (make, model, year, steering wheel, body, doors, color)
  // Only for vehicles - other categories auto-skip to step 4
  if (currentStep === 3) {
    // For non-vehicle categories, automatically skip to step 4
    if (categoryType !== 'vehicle') {
      setCurrentStep(4);
      return null;
    }
    
    // Vehicle-specific fields
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_3_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
          {/* Make with autocomplete */}
          <div className="relative" ref={makeDropdownRef}>
            <Label>{t("post.form.make")}</Label>
            <Input
              placeholder={t("post.form.make_placeholder")}
              value={makeSearchQuery}
              onChange={(e) => {
                setMakeSearchQuery(e.target.value);
                setShowMakeDropdown(true);
              }}
              onFocus={() => {
                if (filteredMakes.length > 0) setShowMakeDropdown(true);
              }}
            />
            {showMakeDropdown && filteredMakes.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border/70 rounded-xl shadow-[var(--shadow-card)] max-h-60 overflow-auto">
                {filteredMakes.slice(0, 10).map((make) => (
                  <div
                    key={make.id}
                    className="px-3 py-2.5 cursor-pointer hover:bg-accent hover:text-accent-foreground first:rounded-t-xl last:rounded-b-xl"
                    onClick={() => {
                      setFormData({ ...formData, make_id: make.id, model_id: "" });
                      setMakeSearchQuery(make.name_en);
                      setShowMakeDropdown(false);
                    }}
                  >
                    {make.name_en}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Model */}
          {formData.make_id && (
            <div>
              <Label>{t("post.form.model")}</Label>
              <Select
                value={formData.model_id}
                onValueChange={(value) => setFormData({ ...formData, model_id: value, year: null })}
              >
                          <SelectTrigger>
                  <SelectValue placeholder={t("post.form.model_placeholder")} />
                          </SelectTrigger>
                        <SelectContent>
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name_en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
            </div>
          )}

          {/* Year */}
          {formData.model_id && availableYears.length > 0 && (
            <div>
              <Label>{t("post.form.year")}</Label>
            <Select
              value={formData.year?.toString() || ""}
              onValueChange={(value) => setFormData({ ...formData, year: value ? parseInt(value) : null })}
            >
                <SelectTrigger>
                  <SelectValue placeholder={t("post.form.year_placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* F7: Generation chooser — shown only when model+year resolves as ambiguous */}
          {generationStatus === "ambiguous" && generationCandidates.length > 1 && (
            <div>
              <Label>{t("post.form.generation") || "Generation"}</Label>
              <Select
                value={(formData as any).generation_id || ""}
                onValueChange={(value) => setFormData({ ...formData, generation_id: value } as any)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("post.form.generation_placeholder") || "Select generation"} />
                </SelectTrigger>
                <SelectContent>
                  {generationCandidates.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.code
                        ? `${g.code}${g.facelift ? " Facelift" : ""}${g.start_year ? ` (${g.start_year}–${g.end_year ?? "…"})` : ""}`
                        : `${g.start_year ?? "?"}–${g.end_year ?? "…"}${g.facelift ? " Facelift" : ""}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Steering wheel */}
          <div>
            <Label>{t("post.form.steering_wheel")}</Label>
            <Select
              value={formData.steering_wheel || ""}
              onValueChange={(value) => setFormData({ ...formData, steering_wheel: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("post.form.steering_wheel")} />
              </SelectTrigger>
              <SelectContent>
                {steeringWheels.map((sw) => (
                  <SelectItem key={sw.id} value={sw.code}>
                    {sw[`name_${locale}`] || sw.name_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Body type */}
          {formData.model_id && bodyTypes.length > 0 && (
            <div>
              <Label>{t("post.form.body_type")}</Label>
            <Select
              value={formData.body_type || ""}
              onValueChange={(value) => setFormData({ ...formData, body_type: value })}
            >
                <SelectTrigger>
                  <SelectValue placeholder={t("post.form.body_type")} />
                </SelectTrigger>
                <SelectContent>
                  {bodyTypes.map((bt) => (
                    <SelectItem key={bt} value={bt}>
                      {bt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Doors */}
          <div>
            <Label>{t("post.form.doors")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="2"
                placeholder={t("post.form.doors_placeholder")}
                value={formData.doors || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "") {
                    setFormData({ ...formData, doors: null });
                  } else {
                    const numValue = parseInt(value);
                    if (!isNaN(numValue) && numValue >= 2) {
                      setFormData({ ...formData, doors: numValue });
                    }
                  }
                }}
                className="flex-1"
              />
              <Select
                value={formData.doors?.toString() || ""}
                onValueChange={(value) => setFormData({ ...formData, doors: value ? parseInt(value) : null })}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {doors.map((d) => (
                    <SelectItem key={d.id} value={d.count.toString()}>
                      {d[`name_${locale}`] || d.name_ru}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Color */}
          <div>
            <Label>{t("post.form.color")}</Label>
            <Select
              value={formData.color_id || ""}
              onValueChange={(value) => setFormData({ ...formData, color_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("post.form.color")} />
              </SelectTrigger>
              <SelectContent>
                {colors.map((color) => (
                  <SelectItem key={color.id} value={color.id}>
                    <div className="flex items-center gap-2">
                      {color.hex_code && (
                        <div
                          className="w-4 h-4 rounded border"
                          style={{ backgroundColor: color.hex_code }}
                        />
                      )}
                      <span>{color[`name_${locale}`] || color.name_ru}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Color code (optional) */}
          <div>
            <Label>{t("post.form.color_code")}</Label>
            <Input
              placeholder={t("post.form.color_code_placeholder")}
              value={formData.color_code}
              onChange={(e) => setFormData({ ...formData, color_code: e.target.value })}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-3 sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button variant="outline" size="lg" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button size="lg" onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (currentStep === 4) {
    const isSchemaCategory = !schemaExcludedTypes.current.has(categoryType);
    const { loading: schemaLoading, error: schemaError, schema, fields } = catalogSchemaState;
    const hasSchema = Boolean(schema?.steps?.length);

    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_4_title")}</CardTitle>
          <CardDescription>
            {getCategoryTypeName(categoryType as any)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
          
          {/* Vehicle-specific fields */}
          {categoryType === 'vehicle' && (
          <>
          {/* Power */}
          <div>
            <Label>{t("post.form.power")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                placeholder={t("post.form.power_placeholder")}
                value={formData.power || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || (parseInt(value) >= 0)) {
                    setFormData({ ...formData, power: value ? parseInt(value) : null });
                  }
                }}
                className="flex-1"
              />
              <span className="self-center text-sm text-muted-foreground">{formatUnit("hp")}</span>
            </div>
          </div>

          {/* Engine type */}
          <div>
            <Label>{t("post.form.engine_type")}</Label>
            <Select
              value={formData.engine_type || ""}
              onValueChange={(value) => setFormData({ ...formData, engine_type: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("post.form.engine_type")} />
              </SelectTrigger>
              <SelectContent>
                {/* Show available fuel types from model if available, otherwise show all engine types from DB */}
                {availableFuelTypes.length > 0 ? (
                  <>
                    {availableFuelTypes.map((ft) => {
                      // Try to find matching engine type from DB to get translated name
                      const matchingEt = engineTypes.find((et) => et.code === ft.toLowerCase() || et.name_en?.toLowerCase() === ft.toLowerCase());
                      return (
                        <SelectItem key={ft} value={ft}>
                          {matchingEt ? (matchingEt[`name_${locale}`] || matchingEt.name_ru) : ft}
                        </SelectItem>
                      );
                    })}
                    {/* Also show Electric and Hydrogen if not already in the list */}
                    {!availableFuelTypes.some((ft) => ft.toLowerCase().includes("electric") || ft.toLowerCase() === "electric") && (
                      engineTypes.filter((et) => et.code === "electric").map((et) => (
                        <SelectItem key={et.id} value={et.code}>
                          {et[`name_${locale}`] || et.name_ru}
                        </SelectItem>
                      ))
                    )}
                    {!availableFuelTypes.some((ft) => ft.toLowerCase().includes("hydrogen") || ft.toLowerCase() === "hydrogen") && (
                      engineTypes.filter((et) => et.code === "hydrogen").map((et) => (
                        <SelectItem key={et.id} value={et.code}>
                          {et[`name_${locale}`] || et.name_ru}
                        </SelectItem>
                      ))
                    )}
                  </>
                ) : (
                  engineTypes.map((et) => (
                    <SelectItem key={et.id} value={et.code}>
                      {et[`name_${locale}`] || et.name_ru}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Engine volume */}
          <div>
            <Label>{t("post.form.engine_volume")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                step="0.1"
                placeholder={t("post.form.engine_volume_placeholder")}
                value={formData.engine_volume || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || (parseFloat(value) >= 0)) {
                    setFormData({
                      ...formData,
                      engine_volume: value ? parseFloat(value) : null,
                    });
                  }
                }}
                className="flex-1"
              />
              <span className="self-center text-sm text-muted-foreground">{formatUnit("L")}</span>
                </div>
          </div>

          {/* Transmission */}
          <div>
            <Label>{t("post.form.transmission")}</Label>
            {availableTransmissions.length > 0 ? (
            <Select
              value={formData.transmission || ""}
              onValueChange={(value) => setFormData({ ...formData, transmission: value })}
            >
                <SelectTrigger>
                  <SelectValue placeholder={t("post.form.transmission")} />
                </SelectTrigger>
                <SelectContent>
                  {availableTransmissions.map((tr) => (
                    <SelectItem key={tr} value={tr}>
                      {tr}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={formData.transmission || ""}
                onValueChange={(value) => setFormData({ ...formData, transmission: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("post.form.transmission")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Manual">Manual</SelectItem>
                  <SelectItem value="Automatic">Automatic</SelectItem>
                  <SelectItem value="Robotized">Robotized</SelectItem>
                  <SelectItem value="CVT">CVT</SelectItem>
                  <SelectItem value="Dual Clutch">Dual Clutch</SelectItem>
                  <SelectItem value="Semi-automatic">Semi-automatic</SelectItem>
                  <SelectItem value="Sequential">Sequential</SelectItem>
                  <SelectItem value="Single-Speed">Single-Speed</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Drive */}
              <div>
            <Label>{t("post.form.drive")}</Label>
            <Select
              value={formData.drive || ""}
              onValueChange={(value) => setFormData({ ...formData, drive: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("post.form.drive")} />
              </SelectTrigger>
              <SelectContent>
                {driveTypes.map((dt) => (
                  <SelectItem key={dt.id} value={dt.code}>
                    {dt[`name_${locale}`] || dt.name_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
              </div>
          </>
          )}
          
          {/* Real Estate fields */}
          {categoryType === 'real_estate' && (
            <RealEstateFields
              formData={formData}
              onChange={(field: any, value: any) => setFormData(prev => ({ ...prev, [field]: value }))}
              locale={locale}
            />
          )}
          
          {/* Electronics fields */}
          {categoryType === 'electronics' && (
            <ElectronicsFields
              formData={formData}
              onChange={(field: any, value: any) => setFormData(prev => ({ ...prev, [field]: value }))}
              locale={locale}
            />
          )}
          
          {/* Fashion fields */}
          {categoryType === 'fashion' && (
            <FashionFields
              formData={formData}
              onChange={(field: any, value: any) => setFormData(prev => ({ ...prev, [field]: value }))}
              locale={locale}
            />
          )}
          
          {/* Jobs fields */}
          {categoryType === 'jobs' && (
            <JobsFields
              formData={formData}
              onChange={(field: any, value: any) => setFormData(prev => ({ ...prev, [field]: value }))}
              locale={locale}
            />
          )}
          
          {/* Schema-driven categories */}
          {isSchemaCategory && (
            <div className="space-y-4">
              {schemaLoading && (
                <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  {t("catalog.common.schema_loading")}
                </div>
              )}

              {!schemaLoading && schemaError && (
                <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
                  {schemaError}
                </div>
              )}

              {!schemaLoading && !schemaError && hasSchema && (
                <FormRenderer
                  schema={schema!}
                  fields={fields}
                  values={formData.catalog_fields ?? {}}
                  onChange={handleSchemaFieldChange}
                  locale={locale}
                />
              )}

              {!schemaLoading && !schemaError && !hasSchema && (
                <div className="rounded-xl border border-dashed border-border/70 p-4 text-sm text-muted-foreground">
                  {t("catalog.common.schema_missing")}
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between gap-3 sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button variant="outline" size="lg" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button size="lg" onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 5: Condition and price
  if (currentStep === 5) {
    // For jobs, skip this step (no price, salary is in step 4)
    if (categoryType === 'jobs') {
      // Skip to step 7 since step 6 is also skipped for jobs
      setCurrentStep(7);
      return null;
    }
    
    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_5_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />

          {/* Vehicle-specific fields */}
          {categoryType === 'vehicle' && (
            <>
          {/* Mileage */}
          <div>
            <Label>{t("post.form.mileage")}</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={t("post.form.mileage_placeholder")}
                value={formatNumber(formData.mileage)}
                onChange={(e) => {
                  const parsed = parseFormattedNumber(e.target.value);
                  setFormData({ ...formData, mileage: parsed });
                }}
                className="flex-1"
              />
              <span className="self-center text-sm text-muted-foreground">{formatUnit("km")}</span>
            </div>
          </div>

          {/* Vehicle condition */}
          <div>
            <Label>{t("post.form.vehicle_condition")}</Label>
            <Select
              value={formData.vehicle_condition || ""}
              onValueChange={(value) => setFormData({ ...formData, vehicle_condition: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("post.form.vehicle_condition")} />
              </SelectTrigger>
              <SelectContent>
                {vehicleConditions.map((vc) => (
                  <SelectItem key={vc.id} value={vc.code}>
                    {vc[`name_${locale}`] || vc.name_ru}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Customs cleared */}
          <div className="flex items-center gap-2">
            <Label>{t("post.form.customs_cleared")}</Label>
            <Select
              value={formData.customs_cleared === null ? "none" : formData.customs_cleared ? "yes" : "no"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  customs_cleared: value === "none" ? null : value === "yes",
                })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-</SelectItem>
                <SelectItem value="yes">{t("post.form.yes")}</SelectItem>
                <SelectItem value="no">{t("post.form.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Under warranty */}
          <div className="flex items-center gap-2">
            <Label>{t("post.form.under_warranty")}</Label>
            <Select
              value={formData.under_warranty === null ? "none" : formData.under_warranty ? "yes" : "no"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  under_warranty: value === "none" ? null : value === "yes",
                })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">-</SelectItem>
                <SelectItem value="yes">{t("post.form.yes")}</SelectItem>
                <SelectItem value="no">{t("post.form.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Owners count */}
          <div>
            <Label>{t("post.form.owners_count")}</Label>
              <Input
                type="number"
                min="0"
                value={formData.owners_count || ""}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === "" || (parseInt(value) >= 0)) {
                    setFormData({
                      ...formData,
                      owners_count: value ? parseInt(value) : null,
                    });
                  }
                }}
              />
          </div>

          {/* VIN */}
          <div>
            <Label>{t("post.form.vin")}</Label>
            <Input
              placeholder={t("post.form.vin_placeholder")}
              maxLength={17}
              value={formData.vin}
              onChange={(e) => {
                const value = e.target.value.toUpperCase();
                // Only allow alphanumeric characters (letters and digits)
                const cleaned = value.replace(/[^A-Z0-9]/g, "");
                setFormData({ ...formData, vin: cleaned });
              }}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t("post.form.vin_placeholder")} (letters and numbers only)
            </p>
          </div>
          </>
          )}
          
          {/* Price - for all categories */}
          <div>
            <Label>{t("post.form.final_price")}</Label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder={t("post.price")}
                value={formatNumber(formData.price)}
                onChange={(e) => {
                  const parsed = parseFormattedNumber(e.target.value);
                  if (parsed === null || parsed >= 0) {
                    setFormData({ ...formData, price: parsed });
                  }
                }}
                className="flex-1"
              />
              <span className="self-center text-sm text-muted-foreground">EUR</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between gap-3 sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button variant="outline" size="lg" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button size="lg" onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 6: Options (only for vehicles)
  if (currentStep === 6) {
    // For non-vehicle categories, automatically skip to step 7
    if (categoryType !== 'vehicle') {
      setCurrentStep(7);
      return null;
    }
    
    // Vehicle options
    const optionCategories = [
      { key: "comfort", label: t("post.form.options_comfort") },
      { key: "interior", label: t("post.form.options_interior") },
      { key: "security", label: t("post.form.options_security") },
      { key: "exterior", label: t("post.form.options_exterior") },
      { key: "assistance", label: t("post.form.options_assistance") },
      { key: "visibility", label: t("post.form.options_visibility") },
      { key: "safety", label: t("post.form.options_safety") },
      { key: "multimedia", label: t("post.form.options_multimedia") },
    ];

    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_6_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 max-h-[600px] overflow-y-auto">
          <ProgressIndicator />
          {optionCategories.map((cat) => {
            const catOptions = vehicleOptions.filter((opt) => opt.category === cat.key);
            if (catOptions.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-2">
                <h3 className="font-bold tracking-tight text-lg">{cat.label}</h3>
                <div className="space-y-2 pl-4">
                  {catOptions.map((opt) => {
                    const optionKey = `${opt.category}_${opt.code}`;
                    const optionValue = formData.options[optionKey];
                    // Checkbox is checked if:
                    // - value is true (option selected without variants)
                    // - value is a non-empty string (variant selected)
                    // - value is "" (option checked but variant not yet selected)
                    const isChecked = optionValue === true || (typeof optionValue === "string" && optionValue !== "") || optionValue === "";
                    const hasVariants = opt.variants && Array.isArray(opt.variants) && opt.variants.length > 0;
                    
                    // Helper function to translate variant names
                    const translateVariant = (variant: string): string => {
                      // Common variant translations
                      const variantMap: Record<string, Record<string, string>> = {
                        "Однозонный": { en: "Single zone", nl: "Eén zone", fr: "Une zone", de: "Eine Zone" },
                        "Двухзонный": { en: "Two zone", nl: "Twee zones", fr: "Deux zones", de: "Zwei Zonen" },
                        "Трехзонный": { en: "Three zone", nl: "Drie zones", fr: "Trois zones", de: "Drei Zonen" },
                        "Многозонный": { en: "Multi zone", nl: "Meerdere zones", fr: "Multi zones", de: "Mehrere Zonen" },
                        "Передние": { en: "Front", nl: "Voor", fr: "Avant", de: "Vorne" },
                        "Передние + Задние": { en: "Front + Rear", nl: "Voor + Achter", fr: "Avant + Arrière", de: "Vorne + Hinten" },
                        "Электронная": { en: "Electronic", nl: "Elektronisch", fr: "Électronique", de: "Elektronisch" },
                        "Гидравлическая": { en: "Hydraulic", nl: "Hydraulisch", fr: "Hydraulique", de: "Hydraulisch" },
                      };
                      
                      if (variantMap[variant] && variantMap[variant][locale]) {
                        return variantMap[variant][locale];
                      }
                      // Fallback: return original if no translation
                      return variant;
                    };

                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`option-${opt.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              if (checked === false) {
                                // If unchecking and there's a variant selected, clear it
                                setFormData({
                                  ...formData,
                                  options: {
                                    ...formData.options,
                                    [optionKey]: false,
                                  },
                                });
                              } else {
                                // If checking, set to true for options without variants
                                // For options with variants, set to "" to show the Select
                                setFormData({
                                  ...formData,
                                  options: {
                                    ...formData.options,
                                    [optionKey]: hasVariants ? "" : true,
                                  },
                                });
                              }
                            }}
                          />
                          <Label
                            htmlFor={`option-${opt.id}`}
                            className="font-normal cursor-pointer flex-1"
                          >
                            {opt[`name_${locale}`] || opt.name_ru}
                          </Label>
                        </div>
                        {isChecked && hasVariants && (
                          <Select
                            value={typeof optionValue === "string" && optionValue !== "" ? optionValue : ""}
                            onValueChange={(value) => {
                              setFormData({
                                ...formData,
                                options: {
                                  ...formData.options,
                                  [optionKey]: value,
                                },
                              });
                            }}
                          >
                            <SelectTrigger className="ml-6 w-48">
                              <SelectValue placeholder={t("post.select")} />
                            </SelectTrigger>
                            <SelectContent>
                              {opt.variants.map((variant: string) => (
                                <SelectItem key={variant} value={variant}>
                                  {translateVariant(variant)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </CardContent>
        <CardFooter className="flex justify-between gap-3 sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button variant="outline" size="lg" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button size="lg" onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 7: Final details (description, photos, location, contacts)
  if (currentStep === 7) {
    return (
      <>
      <Dialog
        open={phoneVerificationOpen}
        onOpenChange={(open) => {
          setPhoneVerificationOpen(open);
          if (!open && phoneVerificationStatus !== "verifying") {
            setPhoneVerificationCode("");
            setPhoneVerificationError(null);
            setPhoneVerificationStatus("idle");
          }
        }}
      >
        <DialogContent className="rounded-xl">
          <DialogHeader>
            <DialogTitle>Verify contact phone</DialogTitle>
            <DialogDescription>
              Enter the 6-digit SMS code sent to {phoneVerificationPhone || formData.additional_phone}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="additional-phone-code">SMS code</Label>
            <Input
              id="additional-phone-code"
              value={phoneVerificationCode}
              onChange={(event) => {
                setPhoneVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setPhoneVerificationError(null);
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="XXXXXX"
              maxLength={6}
              disabled={phoneVerificationStatus === "verifying"}
            />
            {phoneVerificationError ? (
              <p className="text-sm text-destructive">{phoneVerificationError}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                This keeps buyer contact data inside a verified Belgian phone format.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPhoneVerificationOpen(false)}
              disabled={phoneVerificationStatus === "verifying"}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitAdditionalPhoneCode}
              disabled={phoneVerificationStatus === "verifying" || phoneVerificationCode.trim().length < 6}
            >
              {phoneVerificationStatus === "verifying" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Verifying...
                </>
              ) : (
                "Verify code"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_7_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
          {/* Title */}
          <div>
            <Label htmlFor="listing-title">
              {t("post.form.listing_title") !== "post.form.listing_title"
                ? t("post.form.listing_title")
                : "Listing title"}
              {" "}
              <span className="text-muted-foreground text-xs font-normal">
                ({(formData.title ?? "").length}/70)
              </span>
            </Label>
            <Input
              id="listing-title"
              placeholder={
                t("post.form.title_placeholder") !== "post.form.title_placeholder"
                  ? t("post.form.title_placeholder")
                  : "e.g. Toyota Corolla 2019 petrol automatic"
              }
              value={formData.title ?? ""}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              maxLength={100}
              aria-describedby="listing-title-hint"
            />
            <p id="listing-title-hint" className="text-xs text-muted-foreground mt-1">
              {t("post.form.title_hint") !== "post.form.title_hint"
                ? t("post.form.title_hint")
                : "10–70 characters: brand + model + key feature"}
            </p>
          </div>
          {/* Description */}
          <div>
            <Label htmlFor="listing-description">{t("post.form.final_description")}</Label>
            <Textarea
              id="listing-description"
              placeholder={t("post.enter_description")}
              rows={6}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              aria-describedby="listing-description-hint"
            />
            {formData.description.length > 0 && formData.description.length < 120 && (
              <p id="listing-description-hint" className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {t("post.form.description_short_hint") !== "post.form.description_short_hint"
                  ? t("post.form.description_short_hint").replace("{n}", String(120 - formData.description.length))
                  : `Aim for 120+ characters for better search visibility (${120 - formData.description.length} more)`}
              </p>
            )}
          </div>

          {/* Photos */}
          <div>
            <Label>{t("post.form.final_photos")}</Label>
            <div className="space-y-2">
              {advertId ? (
                <>
                  <UploadGallery advertId={advertId} locale={locale} />
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("post.form.final_photos_hint")}
                  </p>
                </>
              ) : (
                <div className="lyvox-image-placeholder rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-center">
                  <ShieldCheck className="h-8 w-8 text-white/85" aria-hidden="true" />
                  <p className="text-sm font-medium text-white/85">{t("common.loading") || "Loading..."}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location — required to publish */}
          <div>
            <Label htmlFor="listing-location">
              {t("post.form.final_location")}
              {" "}<span className="text-destructive" aria-hidden="true">*</span>
            </Label>
            <Input
              id="listing-location"
              placeholder={t("post.location_placeholder")}
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              aria-required="true"
              aria-describedby={!formData.location ? "location-required-hint" : undefined}
            />
            {!formData.location && (
              <p id="location-required-hint" className="text-xs text-muted-foreground mt-1">
                {t("post.form.location_required") !== "post.form.location_required"
                  ? t("post.form.location_required")
                  : "Location is required to publish"}
              </p>
            )}
          </div>

          {/* Contact phone from profile */}
          <div>
            <Label>{t("post.form.phone_from_profile")}</Label>
            <Input disabled value={userPhone || t("profile.not_verified")} className="bg-muted" />
          </div>

          {/* Additional phone */}
          <div>
            <Label>{t("post.form.additional_phone")}</Label>
            <div className="flex gap-2">
              <Input
                placeholder={t("post.form.additional_phone_placeholder")}
                value={formData.additional_phone}
                onChange={(e) => {
                  const value = e.target.value;
                  // Only allow +32 prefix, max length for Belgian numbers
                  if (value === "" || (value.startsWith("+32") && value.length <= 13)) {
                    setFormData({ 
                      ...formData, 
                      additional_phone: value,
                      additional_phone_verified: false // Reset verification if phone changes
                    });
                  }
                }}
                className="flex-1"
                maxLength={13}
              />
              {formData.additional_phone && 
               formData.additional_phone.startsWith("+32") && 
               formData.additional_phone.length >= 10 && 
               !formData.additional_phone_verified && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleVerifyAdditionalPhone}
                  disabled={phoneVerificationStatus === "sending" || phoneVerificationStatus === "verifying"}
                >
                  {phoneVerificationStatus === "sending" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      Sending...
                    </>
                  ) : (
                    t("post.form.additional_phone_verify")
                  )}
                </Button>
              )}
            </div>
            {formData.additional_phone && !formData.additional_phone.startsWith("+32") && formData.additional_phone.length > 0 && (
              <p className="text-sm text-destructive mt-1">
                {t("post.form.additional_phone_placeholder")}
              </p>
            )}
            {formData.additional_phone_verified && (
              <p className="mt-2 inline-flex items-center gap-2 rounded-full lyvox-trust-gradient px-3 py-1.5 text-sm font-semibold text-white">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                {t("profile.verified")}
              </p>
            )}
          </div>
          </CardContent>
          <CardFooter className="flex justify-between gap-3 sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button variant="outline" size="lg" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button size="lg" onClick={handleNext}>
            {t("post.form.next")}
          </Button>
          </CardFooter>
      </Card>
      </>
  );
}

  // Step 8: Preview + publish
  if (currentStep === 8) {
    const canPublish = isVerified || justVerified;

    return (
      <Card className="rounded-2xl border-border/70 shadow-[var(--shadow-card)]">
        <CardHeader>
          <CardTitle className="text-2xl font-extrabold tracking-tight">{t("post.form.step_8_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
          <div className="border border-border/70 bg-muted/30 rounded-xl p-4 space-y-2 shadow-[var(--shadow-soft)]">
            <h3 className="font-extrabold tracking-tight text-xl">
              {(formData.title ?? "").trim() ||
                (categories.find((c) => c.id === formData.category_id)
                  ? getCategoryName(categories.find((c) => c.id === formData.category_id)!)
                  : t("post.category"))}
            </h3>
            <p className="text-muted-foreground">{t("post.condition")}: {t(`post.${formData.condition}`)}</p>
            {formData.price && <p className="text-lg font-semibold">{formData.price} EUR</p>}
            {formData.description && <p className="text-sm">{formData.description}</p>}
            <p className="text-sm text-muted-foreground">
              {t("post.form.make")}: {makes.find((m) => m.id === formData.make_id)?.name_en || "-"}
              {formData.model_id &&
                `, ${t("post.form.model")}: ${models.find((m) => m.id === formData.model_id)?.name_en || "-"}`}
              {formData.year && `, ${t("post.form.year")}: ${formData.year}`}
            </p>
          </div>

          {/* Inline phone verification gate — shown only when not yet verified */}
          {!canPublish && (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50/80 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-3"
              role="region"
              aria-label={
                t("post.form.verify_to_publish_title") !== "post.form.verify_to_publish_title"
                  ? t("post.form.verify_to_publish_title")
                  : "Phone verification required"
              }
            >
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-amber-700 dark:text-amber-300 flex-shrink-0" aria-hidden="true" />
                <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                  {t("post.form.verify_to_publish_title") !== "post.form.verify_to_publish_title"
                    ? t("post.form.verify_to_publish_title")
                    : "Verify your phone to publish"}
                </p>
              </div>
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {t("post.form.verify_to_publish_body") !== "post.form.verify_to_publish_body"
                  ? t("post.form.verify_to_publish_body")
                  : "Your draft is saved. Verify your phone number once and you're ready to publish."}
              </p>
              <TrustGatePhone onVerified={() => setJustVerified(true)} />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 sticky bottom-0 z-10 bg-card/95 backdrop-blur border-t border-border/70 rounded-b-2xl">
          <Button variant="outline" size="lg" onClick={handleBack} className="w-full sm:w-auto">
            {t("post.form.back")}
          </Button>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto justify-end">
            {advertToEdit?.status === "active" && advertId && (
              <BoostDialog
                advertId={advertId}
                trigger={
                  <Button variant="outline" size="lg" disabled={isLoading} title={t("billing.boost.title")} className="text-amber-600 hover:text-amber-700">
                    <Zap className="mr-1 h-4 w-4" />
                    {t("billing.boost.title")}
                  </Button>
                }
              />
            )}
            <Button variant="outline" size="lg" onClick={handleSaveDraft} disabled={isLoading}>
              {t("post.form.save_draft")}
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="lg" disabled={isLoading}>
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {t("post.form.delete")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete listing?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the listing draft and cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAdvert}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isLoading}
                  >
                    Delete listing
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              size="lg"
              onClick={handlePublish}
              disabled={isLoading || !canPublish}
              aria-disabled={!canPublish}
              className="lyvox-cta-gradient text-white border-0 hover:opacity-95 disabled:opacity-50"
            >
              {t("post.publish")}
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return null;
}
