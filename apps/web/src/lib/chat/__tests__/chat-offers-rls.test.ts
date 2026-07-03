import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260704110000_chat_offers.sql"),
  "utf8",
);

const policyBlock = (name: string) => {
  const start = migration.indexOf(`create policy ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = migration.indexOf("drop policy", start + 1);
  return migration.slice(start, next === -1 ? undefined : next);
};

describe("chat_offers RLS migration", () => {
  it("keeps SELECT participant-only through the SECURITY DEFINER helper", () => {
    const block = policyBlock("chat_offers_participants_read");

    expect(block).toContain("for select to authenticated");
    expect(block).toContain("using (public.is_conversation_participant(conversation_id))");
    expect(block).not.toContain("using (true)");
    expect(block).not.toContain("conversation_participants");
  });

  it("only allows sender inserts for open sent offers", () => {
    const block = policyBlock("chat_offers_sender_insert");

    expect(block).toContain("for insert to authenticated");
    expect(block).toContain("sender_id = auth.uid()");
    expect(block).toContain("status = 'sent'");
    expect(block).toContain("public.is_conversation_participant(conversation_id)");
    expect(block).toContain("c.advert_id = advert_id");
  });

  it("column-scopes recipient status updates", () => {
    const block = policyBlock("chat_offers_recipient_update");

    expect(migration).toContain("grant update (status, responded_at) on public.chat_offers to authenticated");
    expect(block).toContain("for update to authenticated");
    expect(block).toContain("sender_id <> auth.uid()");
    expect(block).toContain("status in ('declined', 'accepted_in_chat')");
    expect(block).toContain("responded_at is not null");
  });
});
