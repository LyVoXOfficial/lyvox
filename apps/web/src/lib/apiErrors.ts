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

  const errorMessage = error.message || "";
  const errorCode = error.code || "";

  // Специальная обработка известных ошибок Supabase Auth
  if (errorCode === "user_already_exists" || /already registered/i.test(errorMessage)) {
    return createErrorResponse(ApiErrorCode.EMAIL_IN_USE);
  }

  // Обработка ошибок PostgreSQL через Supabase
  // 23502 = NOT NULL violation
  // 23503 = FOREIGN KEY violation
  // 23505 = UNIQUE violation
  // 23514 = CHECK violation
  // 22P02 = Invalid text representation (например, неправильный UUID)
  // PGRST116 = Resource not found (Supabase PostgREST)
  // PGRST301 = RLS policy violation
  if (errorCode === "23502" || /null value in column/i.test(errorMessage)) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      message: "Обязательное поле не заполнено",
      detail: errorCode,
      details: { message: errorMessage },
    });
  }

  if (errorCode === "23503" || /foreign key constraint/i.test(errorMessage)) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      message: "Ссылка на несуществующую запись",
      detail: errorCode,
      details: { message: errorMessage },
    });
  }

  if (errorCode === "23505" || /unique constraint/i.test(errorMessage)) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 409,
      message: "Дублирование данных",
      detail: errorCode,
      details: { message: errorMessage },
    });
  }

  if (errorCode === "23514" || /check constraint/i.test(errorMessage)) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      message: "Нарушение ограничений данных",
      detail: errorCode,
      details: { message: errorMessage },
    });
  }

  if (errorCode === "22P02" || /invalid input syntax/i.test(errorMessage)) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      message: "Неверный формат данных",
      detail: errorCode,
      details: { message: errorMessage },
    });
  }

  if (errorCode === "PGRST301" || /policy violation/i.test(errorMessage)) {
    return createErrorResponse(ApiErrorCode.FORBIDDEN, {
      status: 403,
      message: "Операция запрещена политиками безопасности",
      detail: errorCode,
      details: { message: errorMessage },
    });
  }

  // Обработка общих ошибок Supabase
  if (errorCode === "invalid_data" || /invalid data/i.test(errorMessage.toLowerCase())) {
    return createErrorResponse(ApiErrorCode.BAD_INPUT, {
      status: 400,
      message: "Неверные данные запроса",
      detail: errorCode,
      details: { message: errorMessage },
    });
  }

  return createErrorResponse(fallbackCode, {
    message: errorMessage || "Unknown error",
    detail: errorCode,
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

