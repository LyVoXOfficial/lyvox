export interface IdentityAdapter {
  verify(input: { subjectId: string }): Promise<{ status: "unsupported" | "started" | "verified" | "failed" }>;
}
export interface OtpAdapter {
  send(input: { toE164: string }): Promise<{ status: "unsupported" | "sent" | "failed" }>;
}
export interface PaymentsAdapter {
  createPayout(input: { businessId: string; amountCents: number }): Promise<{ status: "unsupported" | "queued" | "failed" }>;
}
