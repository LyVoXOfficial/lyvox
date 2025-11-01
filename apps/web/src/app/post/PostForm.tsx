"use client";

import { useState, useEffect } from "react";
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

  // Load reference data
  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        // Load steering wheels
        const { data: sw } = await supabase.from("steering_wheel").select("*").order("name_ru");
        if (sw) setSteeringWheels(sw);

        // Load colors
        const { data: cols } = await supabase.from("vehicle_colors").select("*").order("name_ru");
        if (cols) setColors(cols);

        // Load doors
        const { data: drs } = await supabase.from("vehicle_doors").select("*").order("count");
        if (drs) setDoors(drs);

        // Load vehicle conditions
        const { data: vc } = await supabase.from("vehicle_conditions").select("*").order("name_ru");
        if (vc) setVehicleConditions(vc);

        // Load engine types
        const { data: et } = await supabase.from("engine_types").select("*").order("name_ru");
        if (et) setEngineTypes(et);

        // Load drive types
        const { data: dt } = await supabase.from("drive_types").select("*").order("name_ru");
        if (dt) setDriveTypes(dt);

        // Load vehicle options
        const { data: vo } = await supabase.from("vehicle_options").select("*").order("category, name_ru");
        if (vo) setVehicleOptions(vo);

        // Load makes (initially all)
        const { data: mk } = await supabase
          .from("vehicle_makes")
          .select("*, vehicle_make_i18n(name)")
          .eq("is_active", true)
          .order("name_en");
        if (mk) {
          setMakes(mk);
          setFilteredMakes(mk);
        }
      } catch (error) {
        console.error("Failed to load reference data:", error);
      }
    };

    loadReferenceData();
  }, [supabase]);

  // Filter makes based on search
  useEffect(() => {
    if (!makeSearchQuery) {
      setFilteredMakes(makes);
      return;
    }

    const query = makeSearchQuery.toLowerCase();
    const filtered = makes.filter(
      (make) =>
        make.name_en?.toLowerCase().includes(query) ||
        make.vehicle_make_i18n?.some((i18n: any) => i18n.name?.toLowerCase().includes(query))
    );
    setFilteredMakes(filtered);
  }, [makeSearchQuery, makes]);

  // Load models when make is selected
  useEffect(() => {
    if (!formData.make_id) {
      setModels([]);
      setAvailableYears([]);
      setBodyTypes([]);
      return;
    }

    const loadModels = async () => {
      try {
        const { data: mods } = await supabase
          .from("vehicle_models")
          .select("*, vehicle_model_i18n(name)")
          .eq("make_id", formData.make_id)
          .order("name_en");

        if (mods) {
          setModels(mods);
        }
      } catch (error) {
        console.error("Failed to load models:", error);
      }
    };

    loadModels();
  }, [formData.make_id, supabase]);

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

  // Create or get advert ID
  const ensureAdvertId = async (): Promise<string> => {
    if (advertId) return advertId;
    
    const response = await apiFetch("/api/adverts", { method: "POST" });
    const result = await response.json();
    
    if (!result.ok) {
      throw new Error(result.error || t("post.create_failed"));
    }
    
    const newId = result.advert?.id;
    if (!newId) {
      throw new Error("Failed to create draft");
    }
    
    setAdvertId(newId);
    return newId;
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

      // Generate title
      let title = "";
      if (formData.make_id && formData.model_id && formData.year) {
        const makeName = makes.find((m) => m.id === formData.make_id)?.name_en || "";
        const modelName = models.find((m) => m.id === formData.model_id)?.name_en || "";
        title = `${makeName} ${modelName} ${formData.year}`;
      } else {
        const categoryName = categories.find((c) => c.id === formData.category_id)?.name_ru || "";
        title = `${categoryName} - ${formData.price ? `${formData.price} EUR` : ""}`.trim();
      }
      
      if (title.length < 3) {
        title = categories.find((c) => c.id === formData.category_id)?.name_ru || "Объявление";
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

      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.message || result.error || t("post.update_error"));
      }

      toast.success(t("post.published"));
      router.push(`/ad/${id}`);
    } catch (error: any) {
      toast.error(t("post.update_error"), { description: error.message });
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

  // Step 1: Category selection
  if (currentStep === 1) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_1_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={formData.category_id}
            onValueChange={(value) => setFormData({ ...formData, category_id: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={t("post.select_category")} />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name_ru}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
          <Select
            value={formData.condition}
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
          {/* Make with autocomplete */}
          <div>
            <Label>{t("post.form.make")}</Label>
            <Input
              placeholder={t("post.form.make_placeholder")}
              value={makeSearchQuery}
              onChange={(e) => setMakeSearchQuery(e.target.value)}
            />
            {filteredMakes.length > 0 && (
              <Select
                value={formData.make_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, make_id: value, model_id: "" });
                  setMakeSearchQuery("");
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder={t("post.form.make")} />
                </SelectTrigger>
                <SelectContent>
                  {filteredMakes.map((make) => (
                    <SelectItem key={make.id} value={make.id}>
                      {make.name_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                onValueChange={(value) => setFormData({ ...formData, year: parseInt(value) })}
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
              value={formData.steering_wheel}
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
                value={formData.body_type}
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
                placeholder={t("post.form.doors_placeholder")}
                value={formData.doors || ""}
                onChange={(e) =>
                  setFormData({ ...formData, doors: e.target.value ? parseInt(e.target.value) : null })
                }
                className="flex-1"
              />
              <Select
                value={formData.doors?.toString() || ""}
                onValueChange={(value) => setFormData({ ...formData, doors: parseInt(value) })}
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
              value={formData.color_id}
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

  if (currentStep === 4) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t("post.form.step_4_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Power */}
          <div>
            <Label>{t("post.form.power")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={t("post.form.power_placeholder")}
                value={formData.power || ""}
                onChange={(e) =>
                  setFormData({ ...formData, power: e.target.value ? parseInt(e.target.value) : null })
                }
                className="flex-1"
              />
              <span className="self-center text-sm text-muted-foreground">л.с.</span>
            </div>
          </div>

          {/* Engine type */}
          <div>
            <Label>{t("post.form.engine_type")}</Label>
            {availableFuelTypes.length > 0 ? (
              <Select
                value={formData.engine_type}
                onValueChange={(value) => setFormData({ ...formData, engine_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("post.form.engine_type")} />
                </SelectTrigger>
                <SelectContent>
                  {availableFuelTypes.map((ft) => (
                    <SelectItem key={ft} value={ft}>
                      {ft}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select
                value={formData.engine_type}
                onValueChange={(value) => setFormData({ ...formData, engine_type: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("post.form.engine_type")} />
                </SelectTrigger>
                <SelectContent>
                  {engineTypes.map((et) => (
                    <SelectItem key={et.id} value={et.code}>
                      {et[`name_${locale}`] || et.name_ru}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* Engine volume */}
          <div>
            <Label>{t("post.form.engine_volume")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                step="0.1"
                placeholder={t("post.form.engine_volume_placeholder")}
                value={formData.engine_volume || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    engine_volume: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                className="flex-1"
              />
              <span className="self-center text-sm text-muted-foreground">л</span>
            </div>
          </div>

          {/* Transmission */}
          <div>
            <Label>{t("post.form.transmission")}</Label>
            {availableTransmissions.length > 0 ? (
              <Select
                value={formData.transmission}
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
              <Input
                placeholder={t("post.form.transmission")}
                value={formData.transmission}
                onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
              />
            )}
          </div>

          {/* Drive */}
          <div>
            <Label>{t("post.form.drive")}</Label>
            <Select
              value={formData.drive}
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
          {/* Mileage */}
          <div>
            <Label>{t("post.form.mileage")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={t("post.form.mileage_placeholder")}
                value={formData.mileage || ""}
                onChange={(e) =>
                  setFormData({ ...formData, mileage: e.target.value ? parseInt(e.target.value) : null })
                }
                className="flex-1"
              />
              <span className="self-center text-sm text-muted-foreground">км</span>
            </div>
          </div>

          {/* Vehicle condition */}
          <div>
            <Label>{t("post.form.vehicle_condition")}</Label>
            <Select
              value={formData.vehicle_condition}
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
              value={formData.customs_cleared === null ? "" : formData.customs_cleared ? "yes" : "no"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  customs_cleared: value === "" ? null : value === "yes",
                })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-</SelectItem>
                <SelectItem value="yes">{t("post.form.yes")}</SelectItem>
                <SelectItem value="no">{t("post.form.no")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Under warranty */}
          <div className="flex items-center gap-2">
            <Label>{t("post.form.under_warranty")}</Label>
            <Select
              value={formData.under_warranty === null ? "" : formData.under_warranty ? "yes" : "no"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  under_warranty: value === "" ? null : value === "yes",
                })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">-</SelectItem>
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
              min="1"
              value={formData.owners_count || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  owners_count: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
          </div>

          {/* VIN */}
          <div>
            <Label>{t("post.form.vin")}</Label>
            <Input
              placeholder={t("post.form.vin_placeholder")}
              maxLength={17}
              value={formData.vin}
              onChange={(e) => setFormData({ ...formData, vin: e.target.value.toUpperCase() })}
            />
          </div>

          {/* Price */}
          <div>
            <Label>{t("post.form.final_price")}</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder={t("post.price")}
                value={formData.price || ""}
                onChange={(e) =>
                  setFormData({ ...formData, price: e.target.value ? parseFloat(e.target.value) : null })
                }
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
          {optionCategories.map((cat) => {
            const catOptions = vehicleOptions.filter((opt) => opt.category === cat.key);
            if (catOptions.length === 0) return null;

            return (
              <div key={cat.key} className="space-y-2">
                <h3 className="font-semibold text-lg">{cat.label}</h3>
                <div className="space-y-2 pl-4">
                  {catOptions.map((opt) => {
                    const optionKey = `${opt.category}_${opt.code}`;
                    const isChecked = formData.options[optionKey] === true;
                    const hasVariants = opt.variants && Array.isArray(opt.variants) && opt.variants.length > 0;

                    return (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id={`option-${opt.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              setFormData({
                                ...formData,
                                options: {
                                  ...formData.options,
                                  [optionKey]: checked === true,
                                },
                              });
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
                            value={(formData.options[optionKey] as string) || ""}
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
                                  {variant}
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
            {advertId ? (
              <UploadGallery advertId={advertId} />
            ) : (
              <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
                <p>{t("post.create_draft_hint")}</p>
                <Button
                  variant="outline"
                  className="mt-2"
                  onClick={async () => {
                    try {
                      await ensureAdvertId();
                      toast.success(t("post.form.save_draft"));
                    } catch (error: any) {
                      toast.error(t("post.update_error"), { description: error.message });
                    }
                  }}
                >
                  {t("post.form.save_draft")}
                </Button>
              </div>
            )}
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
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-bold text-xl">
              {categories.find((c) => c.id === formData.category_id)?.name_ru || t("post.category")}
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

