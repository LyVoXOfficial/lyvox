export const LEGAL_ENTITY = {
  registrationStatus: "pending" as "pending" | "registered",
  legalName: "LyVoX (registration pending)",
  controllerName: "[Founder name — pending]", // interim natural-person controller (GDPR Art.13)
  address: "[Registered address — pending]",
  kboNumber: null as string | null,
  vatNumber: null as string | null,
  dsaContactEmail: "contact@lyvox.be", // DSA Art.11 single point of contact
  privacyContactEmail: "privacy@lyvox.be",
  supervisoryAuthority:
    "Belgian DPA (APD/GBA) — gegevensbeschermingsautoriteit / autorité de protection des données",
};

/** Flip to true after counsel sign-off — gates the draft banner on all legal pages. */
export const LEGAL_CONTENT_APPROVED = false;
