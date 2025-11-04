"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { Category } from "@/lib/types";
import { apiFetch } from "@/lib/fetcher";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import UploadGallery from "@/components/upload-gallery";
import { getCategoryIcon } from "@/lib/categoryIcons";
import { ChevronDown, Check } from "lucide-react";

type PostFormProps = {
  categories: Category[];
  userId: string;
  advertToEdit?: any;
  locale: string;
  userPhone?: string | null;
};

const TOTAL_STEPS = 8;

export function PostForm({ categories, userId, advertToEdit, locale, userPhone }: PostFormProps) {
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
    
    // Extract options from specifics
    Object.entries(specifics).forEach(([key, value]) => {
      if (key.startsWith("option_")) {
        const optionKey = key.replace("option_", "");
        options[optionKey] = typeof value === "string" ? value : true;
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
      options,
      price: advertToEdit?.price ?? null,
      description: advertToEdit?.description ?? "",
      location: advertToEdit?.location ?? "",
      additional_phone: (specifics as Record<string, unknown>).additional_phone as string || "",
      additional_phone_verified: false, // Always reset - needs re-verification
    };
  };

  // Form data state
  const [formData, setFormData] = useState(initializeFormData());

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
  
  // Ref to track if draft creation is in progress
  const draftCreationInProgress = useRef(false);

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

  // Create or get advert ID (defined before useEffect that uses it)
  const ensureAdvertId = useCallback(async (): Promise<string> => {
    if (advertId) return advertId;
    
    console.log("[PostForm] Creating new draft...");
    const response = await apiFetch("/api/adverts", { method: "POST" });
    const result = await response.json();
    console.log("[PostForm] Draft API response:", result);

    if (!result.ok) {
      console.error("[PostForm] Draft creation failed:", result.error);
      throw new Error(result.error || t("post.create_failed"));
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
          toast.success(t("post.draft_created") || "Черновик создан");
        } catch (error: any) {
          console.error("[PostForm] Draft creation error:", error);
          toast.error(t("post.update_error") || "Ошибка", { 
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
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Prepare vehicle specifics from form data
  const prepareVehicleSpecifics = () => {
    const specifics: Record<string, string> = {};
    
    if (formData.make_id) specifics.make_id = formData.make_id;
    if (formData.model_id) specifics.model_id = formData.model_id;
    if (formData.year) specifics.year = formData.year.toString();
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
    if (formData.owners_count) specifics.owners_count = formData.owners_count.toString();
    if (formData.vin) specifics.vin = formData.vin;
    if (formData.additional_phone) specifics.additional_phone = formData.additional_phone;
    
    // Add all options
    Object.entries(formData.options).forEach(([key, value]) => {
      if (value) {
        specifics[`option_${key}`] = typeof value === "string" ? value : "true";
      }
    });
    
    return specifics;
  };

  const handleSaveDraft = async () => {
    setIsLoading(true);
    try {
      const id = await ensureAdvertId();
      
      // Generate title from vehicle data if available
      let title = "Черновик объявления";
      if (formData.make_id && formData.model_id && formData.year) {
        const makeName = makes.find((m) => m.id === formData.make_id)?.name_en || "";
        const modelName = models.find((m) => m.id === formData.model_id)?.name_en || "";
        title = `${makeName} ${modelName} ${formData.year}`;
      } else if (formData.category_id) {
        const categoryName = categories.find((c) => c.id === formData.category_id)?.name_ru || "";
        title = `${categoryName} - Черновик`;
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
        specifics: prepareVehicleSpecifics(),
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

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.message || result.error || t("post.update_error"));
      }

      toast.success(t("post.form.save_draft"));
    } catch (error: any) {
      toast.error(t("post.update_error"), { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handlePublish = async () => {
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

      // Check if at least one photo is uploaded
      try {
        const mediaResponse = await apiFetch(`/api/media/list?advertId=${id}`);
        if (mediaResponse.ok) {
          const mediaData = await mediaResponse.json();
          if (mediaData.ok && (!mediaData.data?.items || mediaData.data.items.length === 0)) {
            throw new Error(t("post.form.media_required"));
          }
        }
      } catch (mediaError: any) {
        // If it's our validation error, throw it
        if (mediaError.message && mediaError.message.includes("required")) {
          throw mediaError;
        }
        // If media check fails for other reasons, let API handle it, but log for debugging
        console.warn("Media check failed:", mediaError);
      }

      // Generate title
      let title = "";
      if (formData.make_id && formData.model_id && formData.year) {
        const makeName = makes.find((m) => m.id === formData.make_id)?.name_en || "";
        const modelName = models.find((m) => m.id === formData.model_id)?.name_en || "";
        title = `${makeName} ${modelName} ${formData.year}`;
      } else {
        const categoryName = categories.find((c) => c.id === formData.category_id)?.[`name_${locale}` as keyof Category] as string || 
                           categories.find((c) => c.id === formData.category_id)?.name_ru || "";
        title = `${categoryName} - ${formData.price ? `${formData.price} EUR` : ""}`.trim();
      }
      
      if (title.length < 3) {
        title = categories.find((c) => c.id === formData.category_id)?.[`name_${locale}` as keyof Category] as string ||
                categories.find((c) => c.id === formData.category_id)?.name_ru || "Advert";
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
        specifics: prepareVehicleSpecifics(),
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
        const errorMessage = result.message || result.error || result.detail || t("post.update_error");
        const details = result.details ? ` (${JSON.stringify(result.details)})` : "";
        const statusInfo = !response.ok ? ` [${response.status}]` : "";
        throw new Error(`${errorMessage}${details}${statusInfo}`);
      }

      toast.success(t("post.published"));
      router.push(`/ad/${id}`);
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

    setIsLoading(true);
    try {
      // Request OTP
      const requestResponse = await apiFetch("/api/phone/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.additional_phone }),
      });

      const requestResult = await requestResponse.json();
      if (!requestResult.ok) {
        throw new Error(requestResult.message || requestResult.error || "Failed to send OTP");
      }

      // Prompt for OTP code
      const code = prompt(t("post.form.additional_phone_verify") + " " + formData.additional_phone + ":");
      if (!code) {
        return;
      }

      // Verify OTP
      const verifyResponse = await apiFetch("/api/phone/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.additional_phone, code }),
      });

      const verifyResult = await verifyResponse.json();
      if (!verifyResult.ok) {
        throw new Error(verifyResult.message || verifyResult.error || "Invalid verification code");
      }

      setFormData({ ...formData, additional_phone_verified: true });
      toast.success(t("profile.verified"));
    } catch (error: any) {
      toast.error(t("post.update_error"), { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Progress indicator component
  const ProgressIndicator = () => {
    const progress = calculateProgress();
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">
            {t("post.form.step")} {currentStep} {t("post.form.of")} {TOTAL_STEPS}
          </span>
          <span className="text-sm font-medium">
            {Math.round(progress)}%
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary rounded-full h-2 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
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

  // Color scheme for category blocks
  const categoryColors = [
    { bg: "bg-blue-50", border: "border-blue-200", hover: "hover:bg-blue-100", text: "text-blue-700", icon: "text-blue-600" },
    { bg: "bg-green-50", border: "border-green-200", hover: "hover:bg-green-100", text: "text-green-700", icon: "text-green-600" },
    { bg: "bg-purple-50", border: "border-purple-200", hover: "hover:bg-purple-100", text: "text-purple-700", icon: "text-purple-600" },
    { bg: "bg-orange-50", border: "border-orange-200", hover: "hover:bg-orange-100", text: "text-orange-700", icon: "text-orange-600" },
    { bg: "bg-pink-50", border: "border-pink-200", hover: "hover:bg-pink-100", text: "text-pink-700", icon: "text-pink-600" },
    { bg: "bg-indigo-50", border: "border-indigo-200", hover: "hover:bg-indigo-100", text: "text-indigo-700", icon: "text-indigo-600" },
    { bg: "bg-teal-50", border: "border-teal-200", hover: "hover:bg-teal-100", text: "text-teal-700", icon: "text-teal-600" },
    { bg: "bg-amber-50", border: "border-amber-200", hover: "hover:bg-amber-100", text: "text-amber-700", icon: "text-amber-600" },
  ];

  const handleCategorySelect = (mainCat: Category, subCat?: Category) => {
    if (subCat) {
      // If subcategory clicked, select it immediately
      setFormData({ ...formData, category_id: subCat.id });
      setSelectedMainCategory(null);
    } else if (mainCat) {
      // If main category clicked and has subcategories, show subcategories
      const subcats = categories.filter((c) => c.parent_id === mainCat.id && c.level === 2);
      if (subcats.length > 0) {
        setSelectedMainCategory(mainCat.id);
      } else {
        // No subcategories, select main category directly
        setFormData({ ...formData, category_id: mainCat.id });
      }
    }
  };

  // Step 1: Category selection
  if (currentStep === 1) {
  return (
    <Card>
      <CardHeader>
          <CardTitle>{t("post.form.step_1_title")}</CardTitle>
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
                  className={`${colors.bg} ${colors.border} border-2 rounded-lg p-4 transition-all ${
                    (isMainSelected || isSubSelected) ? "ring-2 ring-primary" : ""
                  }`}
                >
                  <div 
                    className="flex items-start gap-3 cursor-pointer"
                    onClick={() => handleCategorySelect(group.main)}
                  >
                    <div className={`${colors.icon} flex-shrink-0`}>
                      <Icon className="w-8 h-8" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`${colors.text} font-semibold text-lg`}>
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
                    <div className="space-y-2 mt-4 pt-4 border-t border-current/20">
                      {group.subcategories.map((subCat) => {
                        const SubIcon = getCategoryIcon(subCat.icon, subCat.level);
                        const isSubCatSelected = formData.category_id === subCat.id;
                        return (
                          <div
                            key={subCat.id}
                            onClick={() => handleCategorySelect(group.main, subCat)}
                            className={`${colors.bg} ${colors.border} border rounded-md p-3 ${colors.hover} flex items-center gap-3 cursor-pointer transition-all ${
                              isSubCatSelected ? "ring-2 ring-primary" : ""
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
        <CardFooter className="flex justify-end">
          <Button onClick={handleNext} disabled={!formData.category_id}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 2: Condition selection
  if (currentStep === 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_2_title")}</CardTitle>
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
              <SelectItem value="for_parts">{t("post.for_parts")}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button onClick={handleNext} disabled={!formData.condition}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 3: Basic parameters (make, model, year, steering wheel, body, doors, color)
  if (currentStep === 3) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_3_title")}</CardTitle>
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
              <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                {filteredMakes.slice(0, 10).map((make) => (
                  <div
                    key={make.id}
                    className="px-3 py-2 cursor-pointer hover:bg-accent hover:text-accent-foreground"
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
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (currentStep === 4) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_4_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
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
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 5: Condition and price
  if (currentStep === 5) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_5_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
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

          {/* Price */}
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
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 6: Options
  if (currentStep === 6) {
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
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_6_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 max-h-[600px] overflow-y-auto">
          <ProgressIndicator />
          {optionCategories.map((cat) => {
            const catOptions = vehicleOptions.filter((opt) => opt.category === cat.key);
            if (catOptions.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-2">
                <h3 className="font-semibold text-lg">{cat.label}</h3>
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
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button onClick={handleNext}>
            {t("post.form.next")}
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Step 7: Final details (description, photos, location, contacts)
  if (currentStep === 7) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_7_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
          {/* Description */}
               <div>
            <Label>{t("post.form.final_description")}</Label>
            <Textarea
              placeholder={t("post.enter_description")}
              rows={6}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
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
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                  <p className="text-sm">{t("common.loading") || "Загрузка..."}</p>
                </div>
              )}
            </div>
          </div>

          {/* Location */}
          <div>
            <Label>{t("post.form.final_location")}</Label>
            <Input
              placeholder={t("post.location_placeholder")}
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
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
                  variant="outline"
                  onClick={handleVerifyAdditionalPhone}
                  disabled={isLoading}
                >
                  {t("post.form.additional_phone_verify")}
                </Button>
              )}
            </div>
            {formData.additional_phone && !formData.additional_phone.startsWith("+32") && formData.additional_phone.length > 0 && (
              <p className="text-sm text-destructive mt-1">
                {t("post.form.additional_phone_placeholder")}
              </p>
            )}
            {formData.additional_phone_verified && (
              <p className="text-sm text-green-600 mt-1">✓ {t("profile.verified")}</p>
            )}
          </div>
          </CardContent>
          <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <Button onClick={handleNext}>
            {t("post.form.next")}
          </Button>
          </CardFooter>
    </Card>
  );
}

  // Step 8: Preview
  if (currentStep === 8) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_8_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ProgressIndicator />
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-bold text-xl">
              {categories.find((c) => c.id === formData.category_id) ? 
                getCategoryName(categories.find((c) => c.id === formData.category_id)!) : 
                t("post.category")}
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
        </CardContent>
        <CardFooter className="flex justify-between gap-2">
          <Button variant="outline" onClick={handleBack}>
            {t("post.form.back")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSaveDraft} disabled={isLoading}>
              {t("post.form.save_draft")}
            </Button>
            <Button variant="destructive" onClick={async () => {
              if (!confirm(t("post.form.delete"))) return;
              
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
                
                toast.success(t("post.form.delete"));
                router.push("/profile");
              } catch (error: any) {
                toast.error(t("post.update_error"), { description: error.message });
              } finally {
                setIsLoading(false);
              }
            }} disabled={isLoading}>
              {t("post.form.delete")}
            </Button>
            <Button onClick={handlePublish} disabled={isLoading}>
              {t("post.publish")}
            </Button>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return null;
}
