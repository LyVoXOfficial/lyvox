import React from "react";
import { STORAGE_INVENTORY, type ConsentCategory } from "@/lib/cookieConsent/inventory";
import { CookieSettingsButton } from "@/components/cookie/CookieSettingsButton";

/**
 * Format a storage key for display. Wildcard keys (ending with -* or just *)
 * are rendered as patterns with "…" suffix so they never show a raw asterisk.
 */
function formatKey(key: string): string {
  if (key.endsWith("-*")) {
    return key.slice(0, -1) + "…";
  }
  if (key.endsWith("*")) {
    return key.slice(0, -1) + "…";
  }
  return key;
}

interface Props {
  policyTitle: string;
  policyIntro: string;
  draftNote: string;
  manageLabel: string;
  necessaryLabel: string;
  functionalLabel: string;
  analyticsLabel: string;
}

const CATEGORY_ORDER: ConsentCategory[] = ["necessary", "functional", "analytics"];

function categoryLabel(cat: ConsentCategory, labels: Record<ConsentCategory, string>): string {
  return labels[cat];
}

export function CookieInventory({
  policyTitle,
  policyIntro,
  draftNote,
  manageLabel,
  necessaryLabel,
  functionalLabel,
  analyticsLabel,
}: Props) {
  const labels: Record<ConsentCategory, string> = {
    necessary: necessaryLabel,
    functional: functionalLabel,
    analytics: analyticsLabel,
  };

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    entries: STORAGE_INVENTORY.filter((e) => e.category === cat),
  })).filter((g) => g.entries.length > 0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm">
      <h1 className="mb-4 text-2xl font-bold">{policyTitle}</h1>

      <p className="mb-2 rounded border border-yellow-400 bg-yellow-50 px-4 py-2 text-yellow-800 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-300">
        {draftNote}
      </p>

      <p className="mb-8 text-muted-foreground">{policyIntro}</p>

      {grouped.map(({ cat, entries }) => (
        <section key={cat} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold capitalize">
            {categoryLabel(cat, labels)}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Key / Pattern</th>
                  <th className="pb-2 pr-4 font-medium text-muted-foreground">Purpose</th>
                  <th className="pb-2 font-medium text-muted-foreground">Source</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.key} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 font-mono text-xs">{formatKey(entry.key)}</td>
                    <td className="py-2 pr-4">{entry.purpose}</td>
                    <td className="py-2 text-muted-foreground">{entry.lib}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}

      <div className="mt-8">
        <CookieSettingsButton
          label={manageLabel}
          className="rounded-md border border-border bg-card px-4 py-2 hover:bg-accent"
        />
      </div>
    </div>
  );
}
