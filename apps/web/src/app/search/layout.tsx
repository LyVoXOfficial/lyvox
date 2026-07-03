import type { Metadata } from "next";
import type { ReactNode } from "react";

// SEO P0: /search is a parametric crawler trap (infinite filter combinations)
// and search/page.tsx is a client component ("use client"), which cannot
// export `metadata` itself — hence this minimal segment layout.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function SearchLayout({ children }: { children: ReactNode }) {
  return children;
}
