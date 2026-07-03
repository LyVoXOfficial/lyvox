import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo/baseUrl";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin",
          "/profile",
          "/chat",
          "/post",
          "/favorites",
          "/compare",
          "/register",
          "/login",
          "/verify",
          "/pro",
        ],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
