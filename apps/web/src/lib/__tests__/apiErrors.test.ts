import { describe, it, expect } from "vitest";
import {
  createErrorResponse,
  createSuccessResponse,
  handleSupabaseError,
  safeJsonParse,
  ApiErrorCode,
  type ApiErrorResponse,
  type ApiSuccessResponse,
} from "../apiErrors";

describe("apiErrors", () => {
  describe("createErrorResponse", () => {
    it("should create a standard error response with default status 400", async () => {
      const response = createErrorResponse(ApiErrorCode.UNAUTHENTICATED);
      const body = (await response.json()) as ApiErrorResponse;

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
      expect(body.error).toBe(ApiErrorCode.UNAUTHENTICATED);
    });

    it("should create error response with custom status", async () => {
      const response = createErrorResponse(ApiErrorCode.UNAUTHENTICATED, { status: 401 });
      const body = (await response.json()) as ApiErrorResponse;

      expect(response.status).toBe(401);
      expect(body.ok).toBe(false);
      expect(body.error).toBe(ApiErrorCode.UNAUTHENTICATED);
    });

    it("should include message, detail, and details when provided", async () => {
      const response = createErrorResponse(ApiErrorCode.BAD_INPUT, {
        status: 400,
        message: "Invalid input provided",
        detail: "Missing required field",
        details: { field: "email" },
      });
      const body = (await response.json()) as ApiErrorResponse;

      expect(body.message).toBe("Invalid input provided");
      expect(body.detail).toBe("Missing required field");
      expect(body.details).toEqual({ field: "email" });
    });
  });

  describe("createSuccessResponse", () => {
    it("should create a standard success response with default status 200", async () => {
      const response = createSuccessResponse({ data: "test" });
      const body = (await response.json()) as ApiSuccessResponse<{ data: string }>;

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data).toBe("test");
    });

    it("should create success response with custom status", async () => {
      const response = createSuccessResponse({ id: "123" }, 201);
      const body = (await response.json()) as ApiSuccessResponse<{ id: string }>;

      expect(response.status).toBe(201);
      expect(body.ok).toBe(true);
      expect(body.id).toBe("123");
    });

    it("should merge multiple fields", async () => {
      const response = createSuccessResponse({
        id: "123",
        name: "Test",
        count: 42,
      });
      const body = (await response.json()) as ApiSuccessResponse<{
        id: string;
        name: string;
        count: number;
      }>;

      expect(body.ok).toBe(true);
      expect(body.id).toBe("123");
      expect(body.name).toBe("Test");
      expect(body.count).toBe(42);
    });
  });

  describe("handleSupabaseError", () => {
    it("should handle null error", async () => {
      const response = handleSupabaseError(null, ApiErrorCode.INTERNAL_ERROR);
      const body = (await response.json()) as ApiErrorResponse;

      expect(response.status).toBe(400);
      expect(body.error).toBe(ApiErrorCode.INTERNAL_ERROR);
    });

    it("should map user_already_exists to EMAIL_IN_USE", async () => {
      const error = { code: "user_already_exists", message: "User already exists" };
      const response = handleSupabaseError(error, ApiErrorCode.SIGNUP_FAILED);
      const body = (await response.json()) as ApiErrorResponse;

      expect(body.error).toBe(ApiErrorCode.EMAIL_IN_USE);
      expect(response.status).toBe(400);
    });

    it("should map already registered message to EMAIL_IN_USE", async () => {
      const error = { message: "Email is already registered" };
      const response = handleSupabaseError(error, ApiErrorCode.SIGNUP_FAILED);
      const body = (await response.json()) as ApiErrorResponse;

      expect(body.error).toBe(ApiErrorCode.EMAIL_IN_USE);
    });

    it("should use fallback code for unknown errors", async () => {
      const error = { code: "unknown_error", message: "Something went wrong" };
      const response = handleSupabaseError(error, ApiErrorCode.CREATE_FAILED);
      const body = (await response.json()) as ApiErrorResponse;

      expect(body.error).toBe(ApiErrorCode.CREATE_FAILED);
      expect(body.message).toBe("Something went wrong");
      expect(body.detail).toBe("unknown_error");
    });

    it("should handle errors without code", async () => {
      const error = { message: "Network error" };
      const response = handleSupabaseError(error, ApiErrorCode.INTERNAL_ERROR);
      const body = (await response.json()) as ApiErrorResponse;

      expect(body.error).toBe(ApiErrorCode.INTERNAL_ERROR);
      expect(body.message).toBe("Network error");
    });
  });

  describe("safeJsonParse", () => {
    it("should successfully parse valid JSON", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ email: "test@example.com", password: "password123" }),
      });

      const result = await safeJsonParse<{ email: string; password: string }>(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe("test@example.com");
        expect(result.data.password).toBe("password123");
      }
    });

    it("should return error response for invalid JSON", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: "invalid json {",
      });

      const result = await safeJsonParse(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        const body = (await result.response.json()) as ApiErrorResponse;
        expect(body.error).toBe(ApiErrorCode.INVALID_JSON);
        expect(result.response.status).toBe(400);
      }
    });

    it("should handle empty body", async () => {
      const request = new Request("http://localhost", {
        method: "POST",
        body: "",
      });

      const result = await safeJsonParse(request);

      expect(result.success).toBe(false);
      if (!result.success) {
        const body = (await result.response.json()) as ApiErrorResponse;
        expect(body.error).toBe(ApiErrorCode.INVALID_JSON);
      }
    });

    it("should parse complex nested objects", async () => {
      const complexData = {
        user: {
          name: "John",
          age: 30,
          preferences: {
            theme: "dark",
            notifications: true,
          },
        },
        items: [1, 2, 3],
      };

      const request = new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify(complexData),
      });

      const result = await safeJsonParse<typeof complexData>(request);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.name).toBe("John");
        expect(result.data.user.preferences.theme).toBe("dark");
        expect(result.data.items).toEqual([1, 2, 3]);
      }
    });
  });

  describe("ApiErrorCode enum", () => {
    it("should have all expected error codes", () => {
      expect(ApiErrorCode.INVALID_JSON).toBe("INVALID_JSON");
      expect(ApiErrorCode.UNAUTHENTICATED).toBe("UNAUTHENTICATED");
      expect(ApiErrorCode.CREATE_FAILED).toBe("CREATE_FAILED");
      expect(ApiErrorCode.EMAIL_IN_USE).toBe("EMAIL_IN_USE");
      expect(ApiErrorCode.OTP_NOT_FOUND).toBe("OTP_NOT_FOUND");
    });
  });
});

