import { LEGAL_CONTENT_APPROVED, LEGAL_ENTITY } from "@/lib/legal/entity";

interface Props {
  notice: string;
}

/**
 * Prominent draft banner shown on all legal pages until LEGAL_CONTENT_APPROVED
 * is flipped to true AND registrationStatus is "registered".
 * Rendered as a server component — receives the translated notice string as prop.
 */
export function LegalDraftBanner({ notice }: Props) {
  const shouldShow =
    !LEGAL_CONTENT_APPROVED || LEGAL_ENTITY.registrationStatus !== "registered";

  if (!shouldShow) return null;

  return (
    <div
      role="alert"
      className="mb-6 flex items-start gap-3 rounded-lg border border-yellow-400 bg-yellow-50 px-4 py-3 text-sm text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200"
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-base leading-none">
        ⚠
      </span>
      <span>{notice}</span>
    </div>
  );
}
