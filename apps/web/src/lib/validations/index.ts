/**
 * Centralized Zod validation schemas for API endpoints
 * 
 * All schemas are exported here and used in route handlers
 * to validate request bodies before processing.
 */

export * from "./adverts";
export * from "./auth";
export * from "./categories";
export * from "./media";
export * from "./phone";
export * from "./profile";
export * from "./reports";
export * from "./search";

/**
 * Helper function to validate data against a schema
 * and return a standardized error response if validation fails
 */
import { z } from "zod";
import { createErrorResponse, ApiErrorCode } from "../apiErrors";
import { NextResponse } from "next/server";

export function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const errors = result.error.issues.map((err) => ({
      path: err.path.join("."),
      message: err.message,
    }));
    
    return {
      success: false,
      response: createErrorResponse(ApiErrorCode.INVALID_PAYLOAD, {
        status: 400,
        detail: `Validation failed: ${errors.map((e) => `${e.path}: ${e.message}`).join(", ")}`,
      }),
    };
  }
  
  return { success: true, data: result.data };
}

