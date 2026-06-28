import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import nextPlugin from "@next/eslint-plugin-next";

/** @type {import('eslint').Linter.FlatConfig[]} */
const eslintConfig = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["**/*.{js,mjs,cjs,ts,jsx,tsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "@next/next": nextPlugin,
      // Register typescript-eslint plugin so @typescript-eslint/* rules resolve.
      // Previously missing — caused "Definition for rule not found" on all eslint-disable
      // comments referencing @typescript-eslint/* rules.
      "@typescript-eslint": tseslint.plugin,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    rules: {
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      "react/react-in-jsx-scope": "off",
      // Rule active as warn (not error) because the codebase has ~177 pre-existing any
      // usages that were never checked before (plugin was not registered). Promoting to
      // "error" would block every CI run. Fix pre-existing violations in tech-debt pass;
      // do not introduce NEW any without an eslint-disable comment explaining why.
      "@typescript-eslint/no-explicit-any": "warn",
      // TODO(tech-debt): eslint-plugin-react-hooks v7.0.1 introduced this rule;
      // existing useEffect patterns in SearchBar, CookieConsent*, RecentlyViewed
      // synchronously call setState inside effects, which is now flagged.
      // Track in docs/MASTER_TODO.md — refactor before upgrading hooks plugin again.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
];

export default eslintConfig;
