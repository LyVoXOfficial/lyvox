// PRD 61 nav-help storage helper. Unified key `lyvox:nav-help` used by all sections.
// Discover coach-mark uses sections.discover (not a separate key).

const NAV_HELP_KEY = "lyvox:nav-help";

export type SectionState = "offered" | "completed" | "skipped" | "disabled";

interface NavHelpStore {
  globalEnabled: boolean;
  sections: Record<string, SectionState>;
}

function getDefault(): NavHelpStore {
  return { globalEnabled: true, sections: {} };
}

function readStore(): NavHelpStore {
  if (typeof window === "undefined") return getDefault();
  try {
    const raw = window.localStorage.getItem(NAV_HELP_KEY);
    if (!raw) return getDefault();
    const parsed = JSON.parse(raw) as Partial<NavHelpStore>;
    return {
      globalEnabled: typeof parsed.globalEnabled === "boolean" ? parsed.globalEnabled : true,
      sections: parsed.sections && typeof parsed.sections === "object" ? parsed.sections : {},
    };
  } catch {
    return getDefault();
  }
}

function writeStore(store: NavHelpStore): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(NAV_HELP_KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode */
  }
}

export function getSectionState(section: string): SectionState | undefined {
  return readStore().sections[section];
}

export function setSectionState(section: string, state: SectionState): void {
  const store = readStore();
  store.sections[section] = state;
  writeStore(store);
}

export function isGlobalEnabled(): boolean {
  return readStore().globalEnabled;
}

export function setGlobalEnabled(enabled: boolean): void {
  const store = readStore();
  store.globalEnabled = enabled;
  writeStore(store);
}

export function resetAllSections(): void {
  const store = readStore();
  store.sections = {};
  writeStore(store);
}

/** Whether to auto-show the coach for this section on first visit. */
export function shouldAutoOffer(section: string): boolean {
  const store = readStore();
  if (!store.globalEnabled) return false;
  const state = store.sections[section];
  return state === undefined;
}
