import { z } from "zod";

/**
 * Schema for starting/finding a conversation (POST /api/chat/start)
 */
export const startConversationSchema = z.object({
  advert_id: z
    .string()
    .uuid("Advert ID must be a valid UUID")
    .optional(),
  
  peer_id: z
    .string()
    .uuid("Peer ID must be a valid UUID"),
});

export type StartConversationInput = z.infer<typeof startConversationSchema>;

/**
 * Schema for sending a message (POST /api/chat/send)
 */
export const sendMessageSchema = z.object({
  conversation_id: z
    .string()
    .uuid("Conversation ID must be a valid UUID"),
  
  body: z
    .string()
    .trim()
    .min(1, "Message body cannot be empty")
    .max(5000, "Message body must not exceed 5000 characters"),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const chatOfferStatusSchema = z.enum(["sent", "declined", "accepted_in_chat", "expired"]);
export const chatOfferResponseStatusSchema = z.enum(["declined", "accepted_in_chat"]);

/**
 * Schema for creating a structured price offer (POST /api/chat/offer)
 */
export const createChatOfferSchema = z.object({
  advert_id: z
    .string()
    .uuid("Advert ID must be a valid UUID"),

  conversation_id: z
    .string()
    .uuid("Conversation ID must be a valid UUID"),

  amount_cents: z
    .number()
    .int("Offer amount must be whole cents")
    .positive("Offer amount must be positive")
    .lt(100000000, "Offer amount is too high"),

  currency: z.literal("EUR").default("EUR"),

  message: z
    .string()
    .trim()
    .max(1000, "Offer message must not exceed 1000 characters")
    .optional(),
});

export type CreateChatOfferInput = z.infer<typeof createChatOfferSchema>;

/**
 * Schema for responding to a structured price offer (PATCH /api/chat/offer)
 */
export const updateChatOfferSchema = z.object({
  offer_id: z
    .string()
    .uuid("Offer ID must be a valid UUID"),

  status: chatOfferResponseStatusSchema,
});

export type UpdateChatOfferInput = z.infer<typeof updateChatOfferSchema>;

/**
 * Schema for marking messages as read (POST /api/chat/read)
 */
export const markReadSchema = z.object({
  conversation_id: z
    .string()
    .uuid("Conversation ID must be a valid UUID"),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;
