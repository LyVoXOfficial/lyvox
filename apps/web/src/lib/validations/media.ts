import { z } from "zod";

/**
 * Schema for signing a media upload (POST /api/media/sign)
 */
export const signMediaSchema = z.object({
  advertId: z
    .string()
    .uuid("Advert ID must be a valid UUID"),
  
  fileName: z
    .string()
    .trim()
    .min(1, "File name is required")
    .max(255, "File name must not exceed 255 characters"),
  
  contentType: z
    .string()
    .startsWith("image/", "Content type must be an image (must start with 'image/')"),
  
  fileSize: z
    .number()
    .int("File size must be an integer")
    .positive("File size must be positive")
    .max(5 * 1024 * 1024, "File size must not exceed 5MB"),
  // SEC-UPLOAD: the preview is derived server-side from the sanitised full image
  // in /api/media/complete — the client no longer uploads a preview, so no
  // preview upload token is issued here.
});

export type SignMediaInput = z.infer<typeof signMediaSchema>;

/**
 * Schema for completing a media upload (POST /api/media/complete)
 */
export const completeMediaSchema = z.object({
  advertId: z
    .string()
    .uuid("Advert ID must be a valid UUID"),
  
  storagePath: z
    .string()
    .trim()
    .min(1, "Storage path is required")
    .regex(
      /^[a-z0-9_/-]+\.[a-z0-9_]+$/i,
      "Storage path format is invalid (must contain alphanumeric characters, hyphens, underscores, and slashes, and end with a file extension)",
    )
    .refine(
      (path) => path.includes("/"),
      "Storage path must contain at least one slash (for userId/advertId structure)",
    ),
  // SEC-UPLOAD: width/height and all preview fields are computed server-side from
  // the sanitised bytes — any client-supplied values are ignored (stripped).
});

export type CompleteMediaInput = z.infer<typeof completeMediaSchema>;

/**
 * Schema for reordering media (POST /api/media/reorder)
 */
export const reorderMediaSchema = z.object({
  advertId: z
    .string()
    .uuid("Advert ID must be a valid UUID"),
  
  orderedIds: z
    .array(z.string().uuid("Each media ID must be a valid UUID"))
    .min(1, "At least one media ID is required"),
});

export type ReorderMediaInput = z.infer<typeof reorderMediaSchema>;
