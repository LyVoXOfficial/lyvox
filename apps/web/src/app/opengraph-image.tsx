import { ImageResponse } from "next/og";

// Default brand og:image for the whole site. Any route without its own
// opengraph-image.tsx (or explicit openGraph.images in generateMetadata)
// falls back to this. Pure inline JSX — no external fetch, no custom font
// loading — keeps this deterministic under CSP and at build time.

export const alt = "LyVoX — Local marketplace for Belgium";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0b3d3a",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 120,
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: -2,
          }}
        >
          LyVoX
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 36,
            color: "#9fd9d2",
          }}
        >
          Local marketplace — Belgium
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
