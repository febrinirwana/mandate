import path from "node:path";
import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import tseslint from "typescript-eslint";

const repoRoot = path.resolve(import.meta.dirname);

const typedFiles = ["apps/web/**/*.{ts,tsx}", "packages/**/*.{ts,tsx}"];

export default tseslint.config(
  {
    ignores: [
      ".agents/**",
      "**/.next/**",
      "**/.turbo/**",
      "**/coverage/**",
      "contracts/lib/**",
      "node_modules/**",
      "reference/**",
    ],
  },
  eslint.configs.recommended,
  {
    ...nextPlugin.configs["core-web-vitals"],
    files: ["apps/web/**/*.{js,jsx,ts,tsx}"],
    settings: {
      next: {
        rootDir: path.join(repoRoot, "apps/web"),
      },
    },
  },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: typedFiles,
  })),
  {
    files: typedFiles,
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
