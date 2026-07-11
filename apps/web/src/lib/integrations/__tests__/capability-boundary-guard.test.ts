import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(process.cwd(), "apps", "web", "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (path.includes(`${join("__tests__")}`)) return [];
    return statSync(path).isDirectory()
      ? sourceFiles(path)
      : /\.(ts|tsx)$/.test(name)
        ? [path]
        : [];
  });
}

describe("capability boundary guard", () => {
  it("keeps raw synchronous capability decisions inside the resolver only", () => {
    const violations = sourceFiles(SRC)
      .filter((file) => !file.endsWith(join("lib", "capabilities.ts")))
      .filter(
        (file) =>
          !file.endsWith(join("lib", "settings", "platformSettings.ts")),
      )
      .filter((file) =>
        readFileSync(file, "utf8")
          .split(/\r?\n/)
          .some(
            (line) =>
              !/^\s*[*/]/.test(line) && line.includes("isCapabilityEnabled("),
          ),
      )
      .map((file) => relative(process.cwd(), file));

    expect(violations).toEqual([]);
  });

  it("keeps every money entry route behind the effective integration resolver", () => {
    const routes = [
      join(SRC, "app", "api", "billing", "checkout", "route.ts"),
      join(SRC, "app", "api", "billing", "subscribe", "route.ts"),
      join(SRC, "app", "api", "billing", "products", "route.ts"),
      join(SRC, "app", "api", "billing", "webhook", "route.ts"),
    ];

    for (const route of routes) {
      expect(readFileSync(route, "utf8")).toContain("getIntegrationStatus");
    }
  });

  it("locks browser financial writes and seeds the safe launch defaults", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260710180000_p003_launch_mode_and_billing_lock.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "'platform.launch_mode', '{\"mode\":\"contact_only\"}'",
    );
    expect(migration).toContain(
      "'platform.money_emergency_stop', '{\"stopped\":true}'",
    );
    expect(migration).toMatch(
      /on conflict \(key\) do update[\s\S]*set value = excluded\.value/i,
    );
    expect(migration).not.toMatch(/on conflict \(key\) do nothing/i);
    expect(migration).toMatch(
      /revoke insert, update, delete, truncate on public\.purchases from anon, authenticated/i,
    );
    expect(migration).toContain(
      'drop policy if exists "Owner delete profile" on public.profiles',
    );
    expect(migration).toMatch(
      /revoke insert, delete, truncate on public\.profiles from anon, authenticated/i,
    );
    expect(migration).toMatch(/alter column active set default false/i);
    expect(migration).toContain(
      "legacy products require an explicit capability, benefit_type and duration_days mapping",
    );
    expect(migration).not.toMatch(/when code ~\*|else 30/i);
  });

  it("requires atomic AAL2 settings mutation and immutable audit", () => {
    const migration = readFileSync(
      join(
        process.cwd(),
        "supabase",
        "migrations",
        "20260710181000_p004_capability_control.sql",
      ),
      "utf8",
    );

    expect(migration).toContain(
      "coalesce(auth.jwt() ->> 'aal', 'aal1') <> 'aal2'",
    );
    expect(migration).toContain("setting revision conflict");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("activate_platform_emergency_stop");
    expect(migration).toContain("jsonb_set(v_value, '{emergencyDisabled}'");
    expect(migration).toContain("jsonb_set(v_value, '{stopped}'");
    expect(migration).toContain("settings_audit_reject_truncate");
    expect(migration).toMatch(
      /revoke execute on function public\.is_admin\(\) from public, anon, authenticated/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.is_admin\(\) to anon, authenticated/i,
    );
    expect(migration).toMatch(
      /revoke insert, update, delete, truncate on public\.platform_settings from anon, authenticated, service_role/i,
    );
    expect(migration).toMatch(
      /revoke execute on function public\.set_platform_setting[\s\S]*from public, anon, authenticated, service_role/i,
    );
  });

  it("never fabricates a paid boost badge for popularity-ranked adverts", () => {
    const component = readFileSync(
      join(
        process.cwd(),
        "apps",
        "web",
        "src",
        "components",
        "home",
        "TopAdvertCard.tsx",
      ),
      "utf8",
    );
    expect(component).not.toContain("boostBenefit");
    expect(component).not.toMatch(/benefit_type:\s*["']boost["']/);
  });

  it("keeps the incomplete Discover experience unreachable from public entry points", () => {
    const discoverPage = readFileSync(
      join(SRC, "app", "discover", "page.tsx"),
      "utf8",
    );
    const homePage = readFileSync(join(SRC, "app", "page.tsx"), "utf8");
    const searchPage = readFileSync(
      join(SRC, "app", "search", "page.tsx"),
      "utf8",
    );
    const searchClient = readFileSync(
      join(SRC, "app", "search", "SearchClient.tsx"),
      "utf8",
    );

    expect(discoverPage).toContain('getIntegrationStatus("discover_v2")');
    expect(discoverPage).toContain('redirect("/search")');
    expect(homePage).toContain("productTruth.discoverV2");
    expect(searchPage).toContain('getIntegrationStatus("discover_v2")');
    expect(searchClient).toContain("discoverEnabled ?");
  });

  it("never requires browser INSERT privilege to edit an existing profile", () => {
    const profileEdit = readFileSync(
      join(SRC, "app", "(protected)", "profile", "edit", "page.tsx"),
      "utf8",
    );
    const profileApi = readFileSync(
      join(SRC, "app", "api", "profile", "update", "route.ts"),
      "utf8",
    );

    for (const source of [profileEdit, profileApi]) {
      expect(source).not.toContain(".upsert(");
      expect(source).toContain('.from("profiles")');
      expect(source).toContain(".update(");
      expect(source).toContain('.select("id")');
      expect(source).toContain(".single()");
    }
  });
});
