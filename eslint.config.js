import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

const reactHooksConfig = reactHooks.configs.flat.recommended;

export default tseslint.config(
  { ignores: ["dist", "node_modules", "vite.config.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      ...reactHooksConfig.plugins,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooksConfig.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      ...reactHooksConfig.plugins,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooksConfig.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  }
);
