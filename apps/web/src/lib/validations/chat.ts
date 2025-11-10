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

/**
 * Schema for marking messages as read (POST /api/chat/read)
 */
export const markReadSchema = z.object({
  conversation_id: z
    .string()
    .uuid("Conversation ID must be a valid UUID"),
});

export type MarkReadInput = z.infer<typeof markReadSchema>;

