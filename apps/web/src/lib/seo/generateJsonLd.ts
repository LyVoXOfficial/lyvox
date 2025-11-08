import type { ScriptHTMLAttributes } from "react";

type JsonLdInput = Record<string, unknown> | Array<Record<string, unknown>>;

const JSON_SPACE = process.env.NODE_ENV === "production" ? 0 : 2;

const stringifyJsonLd = (data: JsonLdInput): string => {
  try {
    return JSON.stringify(data, null, JSON_SPACE);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.warn("[seo] Failed to stringify JSON-LD payload", error);
    }
    return "{}";
  }
};

export const getJsonLdScriptProps = (
  data: JsonLdInput,
): Pick<ScriptHTMLAttributes<HTMLScriptElement>, "type" | "dangerouslySetInnerHTML"> => ({
  type: "application/ld+json",
  dangerouslySetInnerHTML: {
    __html: stringifyJsonLd(data),
  },
});

export type { JsonLdInput };

