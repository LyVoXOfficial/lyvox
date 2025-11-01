import { NextResponse } from "next/server";

/**
 * Стандартизированные коды ошибок API
 */
export enum ApiErrorCode {
  // Client errors (4xx)
  INVALID_JSON = "INVALID_JSON",
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_FORMAT = "INVALID_FORMAT",
  INVALID_PAYLOAD = "INVALID_PAYLOAD",
  WEAK_PASSWORD = "WEAK_PASSWORD",
  PASSWORD_MISMATCH = "PASSWORD_MISMATCH",
  CONSENT_REQUIRED = "CONSENT_REQUIRED",
  MISSING_ID = "MISSING_ID",
  UNAUTH = "UNAUTH",
  UNAUTHENTICATED = "UNAUTHENTICATED",
  FORBIDDEN = "FORBIDDEN",
  NOT_FOUND = "NOT_FOUND",
  BAD_INPUT = "BAD_INPUT",
  ALREADY_REPORTED = "ALREADY_REPORTED",
  EMAIL_IN_USE = "EMAIL_IN_USE",
  
  // Server errors (5xx)
  SIGNUP_FAILED = "SIGNUP_FAILED",
  SERVICE_ROLE_MISSING = "SERVICE_ROLE_MISSING",
  PROFILE_UPSERT_FAILED = "PROFILE_UPSERT_FAILED",
  SIGNUP_INCOMPLETE = "SIGNUP_INCOMPLETE",
  SMS_SEND_FAIL = "SMS_SEND_FAIL",
  INTERNAL_ERROR = "INTERNAL_ERROR",
  PHONE_SAVE_FAILED = "PHONE_SAVE_FAILED",
  PHONE_UPDATE_FAILED = "PHONE_UPDATE_FAILED",
  OTP_NOT_FOUND = "OTP_NOT_FOUND",
  OTP_EXPIRED = "OTP_EXPIRED",
  OTP_INVALID = "OTP_INVALID",
  OTP_LOCKED = "OTP_LOCKED",
  OTP_CREATE_FAILED = "OTP_CREATE_FAILED",
  OTP_CLEANUP_FAILED = "OTP_CLEANUP_FAILED",
  CATEGORY_LOOKUP_FAILED = "CATEGORY_LOOKUP_FAILED",
  CREATE_FAILED = "CREATE_FAILED",
  UPDATE_FAILED = "UPDATE_FAILED",
  FETCH_FAILED = "FETCH_FAILED",
  NO_DEFAULT_CATEGORY = "NO_DEFAULT_CATEGORY",
  MISSING_ADVERT_ID = "MISSING_ADVERT_ID",
  INVALID_ORDER = "INVALID_ORDER",
  INVALID_PATH = "INVALID_PATH",
  UNKNOWN_MEDIA_ID = "UNKNOWN_MEDIA_ID",
  UNSUPPORTED_CONTENT_TYPE = "UNSUPPORTED_CONTENT_TYPE",
  MISSING_FILE_NAME = "MISSING_FILE_NAME",
  MISSING_FILE_SIZE = "MISSING_FILE_SIZE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  LIMIT_REACHED = "LIMIT_REACHED",
  SIGNED_URL_FAILED = "SIGNED_URL_FAILED",
}

/**
 * Стандартизированный формат ответа с ошибкой
 */
export type ApiErrorResponse = {
  ok: false;
  error: string;
  message?: string;
  detail?: string;
  details?: Record<string, unknown>;
};

/**
 * Стандартизированный формат успешного ответа
 */
export type ApiSuccessResponse<T = unknown> = {
  ok: true;
} & T;

/**
 * Создает стандартизированный ответ с ошибкой
 */
export function createErrorResponse(
  code: ApiErrorCode | string,
  options: {
    status?: number;
    message?: string;
    detail?: string;
    details?: Record<string, unknown>;
  } = {},
): NextResponse<ApiErrorResponse> {
  const { status = 400, message, detail, details } = options;

  const response: ApiErrorResponse = {
    ok: false,
    error: code,
  };

  if (message) {
    response.message = message;
  }
  if (detail) {
    response.detail = detail;
  }
  if (details) {
    response.details = details;
  }

  return NextResponse.json(response, { status });
}

/**
 * Создает стандартизированный успешный ответ
 */
export function createSuccessResponse<T extends Record<string, unknown>>(
  data: T,
  status = 200,
): NextResponse<ApiSuccessResponse<T>> {
  return NextResponse.json(
    {
      ok: true,
      ...data,
    } as ApiSuccessResponse<T>,
    { status },
  );
}

/**
 * Обрабатывает ошибки Supabase и возвращает стандартизированный ответ
 */
export function handleSupabaseError(
  error: { message?: string; code?: string } | null | undefined,
  fallbackCode: ApiErrorCode = ApiErrorCode.INTERNAL_ERROR,
): NextResponse<ApiErrorResponse> {
  if (!error) {
    return createErrorResponse(fallbackCode);
  }

  // Специальная обработка известных ошибок Supabase
  if (error.code === "user_already_exists" || /already registered/i.test(error.message || "")) {
    return createErrorResponse(ApiErrorCode.EMAIL_IN_USE);
  }

  return createErrorResponse(fallbackCode, {
    message: error.message || "Unknown error",
    detail: error.code,
  });
}

/**
 * Безопасно парсит JSON из Request body
 */
export async function safeJsonParse<T = unknown>(req: Request): Promise<{
  success: true;
  data: T;
} | {
  success: false;
  response: NextResponse<ApiErrorResponse>;
}> {
  try {
    const data = await req.json() as T;
    return { success: true, data };
  } catch {
    return {
      success: false,
      response: createErrorResponse(ApiErrorCode.INVALID_JSON, { status: 400 }),
    };
  }
}

