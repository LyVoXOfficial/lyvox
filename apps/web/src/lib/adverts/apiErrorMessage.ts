type Translator = (key: string, params?: Record<string, string | number>) => string;

export type ApiErrorPayload = {
  message?: unknown;
  error?: unknown;
  detail?: unknown;
  details?: unknown;
};

const stringValue = (value: unknown) =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const tWithFallback = (t: Translator, key: string, fallback: string) => {
  const translated = t(key);
  return translated === key ? fallback : translated;
};

const mapAdvertErrorDetail = (detail: string, t: Translator) => {
  switch (detail) {
    case "MEDIA_REQUIRED":
      return t("post.form.media_required");
    case "DESCRIPTION_TOO_SHORT":
      return t("post.form.description_min");
    case "CATEGORY_REQUIRED":
      return t("post.select_category");
    case "CONDITION_REQUIRED":
      return t("post.select_condition");
    case "LOCATION_REQUIRED":
      return tWithFallback(t, "post.form.location_required", "Location is required to publish");
    case "Phone verification required to publish":
      return tWithFallback(t, "post.form.verify_to_publish_title", "Verify your phone to publish");
    default:
      return undefined;
  }
};

const stringifyDetails = (details: unknown) => {
  if (!details) return "";
  if (typeof details === "string") return ` (${details})`;

  try {
    return ` (${JSON.stringify(details)})`;
  } catch {
    return "";
  }
};

export const getAdvertApiErrorMessage = (
  result: ApiErrorPayload | null | undefined,
  t: Translator,
  fallback: string,
) => {
  const detail = stringValue(result?.detail);
  const mappedDetail = detail ? mapAdvertErrorDetail(detail, t) : undefined;
  const errorCode = stringValue(result?.error);
  const rawMessage = stringValue(result?.message);
  const message =
    mappedDetail ??
    (rawMessage && rawMessage !== errorCode ? rawMessage : undefined) ??
    detail ??
    errorCode ??
    fallback;

  return `${message}${stringifyDetails(result?.details)}`;
};
