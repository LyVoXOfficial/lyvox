export const CHAT_OFFER_MESSAGE_PREFIX = "lyvox:chat_offer:";

export function buildChatOfferMessageBody(offerId: string): string {
  return `${CHAT_OFFER_MESSAGE_PREFIX}${offerId}`;
}

export function getChatOfferIdFromMessage(body: string): string | null {
  if (!body.startsWith(CHAT_OFFER_MESSAGE_PREFIX)) return null;
  const offerId = body.slice(CHAT_OFFER_MESSAGE_PREFIX.length).trim();
  return offerId.length > 0 ? offerId : null;
}
