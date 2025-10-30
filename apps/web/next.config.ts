import path from "path";
import type { NextConfig } from "next";

type ExtendedNextConfig = NextConfig & {
  eslint?: {
    ignoreDuringBuilds?: boolean;
  };
  typescript?: {
    ignoreBuildErrors?: boolean;
  };
};

const config: ExtendedNextConfig = {
  webpack: (cfg) => {
    cfg.resolve = cfg.resolve || {};
    cfg.resolve.alias = {
      ...(cfg.resolve.alias || {}),
      "@": path.resolve(__dirname, "src"),
    };
    return cfg;
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default config;

