import path from "path";
import type { NextConfig } from "next";

const config: NextConfig = {
  // ВЕРХНИЙ УРОВЕНЬ, не experimental
  turbopack: {
    // Явно укажем корень монорепо, чтобы Next не путал root
    root: path.resolve(__dirname, "..", ".."),
  },
};

export default config;
