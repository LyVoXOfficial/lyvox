import type { MetadataRoute } from "next";

// Web app manifest — install prompt metadata for the PWA track (PRD 18).
// Kept minimal: SVG icon works for basic installability; dedicated maskable
// PNG icons are a follow-up asset task.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LyVoX",
    short_name: "LyVoX",
    description: "Trusted local marketplace for Belgium",
    start_url: "/",
    display: "standalone",
    background_color: "#f8fbfb",
    theme_color: "#11bdf9",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/lyvox.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
