import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(process.cwd(), "supabase/migrations/20260704120000_advert_translations.sql"),
  "utf8",
);

const policyBlock = (name: string) => {
  const start = migration.indexOf(`create policy ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = migration.indexOf("drop policy", start + 1);
  return migration.slice(start, next === -1 ? undefined : next);
};

describe("advert_translations RLS migration", () => {
  it("lets anon/authenticated read only published translations for active adverts", () => {
    const block = policyBlock("advert_translations_public_read_published");

    expect(block).toContain("for select");
    expect(block).toContain("to anon, authenticated");
    expect(block).toContain("status = 'published'");
    expect(block).toContain("adverts.status = 'active'");
    expect(block).not.toContain("status = 'draft'");
    expect(block).not.toContain("using (true)");
  });

  it("keeps writes service-role only", () => {
    expect(policyBlock("advert_translations_service_insert")).toContain("for insert");
    expect(policyBlock("advert_translations_service_insert")).toContain("to service_role");
    expect(policyBlock("advert_translations_service_update")).toContain("for update");
    expect(policyBlock("advert_translations_service_update")).toContain("to service_role");
    expect(migration).not.toContain("for insert\n  to anon");
    expect(migration).not.toContain("for update\n  to anon");
    expect(migration).not.toContain("for insert\n  to authenticated");
  });

  it("uses column-scoped grants for public read and service writes", () => {
    expect(migration).toContain("revoke all on table public.advert_translations from public, anon, authenticated");
    expect(migration).toContain("grant select (\n  id,");
    expect(migration).toContain(") on table public.advert_translations to anon, authenticated, service_role");
    expect(migration).toContain("grant insert (\n  advert_id,");
    expect(migration).toContain("grant update (\n  source_locale,");
  });
});
