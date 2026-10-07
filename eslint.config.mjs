import { fixupConfigRules } from "@eslint/compat";
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const nextConfig = fixupConfigRules([...nextVitals, ...nextTs]);

export default defineConfig([
  ...nextConfig,
  {
    rules: {
      // Existing application-wide findings stay visible while being resolved incrementally.
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react/no-unescaped-entities": "warn",
    },
  },
  {
    files: ["scripts/**/*.js"],
    // These standalone .js scripts run as CommonJS (package.json has no "type": "module").
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
