import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/build/**",
      "backend/prisma/migrations/**",
      "**/*.config.{js,ts}",
      "**/coverage/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
    },
    rules: {
      // Unused vars are an error, but allow the leading-underscore convention
      // the codebase already uses for deliberately-ignored args.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // The codebase uses `any` in a few well-understood spots (Prisma dynamic
      // extension, test fixtures). Warn so new ones are visible without a churn
      // of suppressions.
      "@typescript-eslint/no-explicit-any": "warn",
      // `declare global { namespace Express { ... } }` is the canonical way to
      // augment Express's Request type.
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
    },
  },

  // Backend + shared: Node environment.
  {
    files: ["backend/**/*.ts", "packages/shared/**/*.ts"],
    languageOptions: { globals: { ...globals.node } },
  },

  // Frontend: browser environment + React hooks rules.
  {
    files: ["frontend/**/*.{ts,tsx}"],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // rules-of-hooks + exhaustive-deps stay as errors (they catch real bugs).
      // The newer "you might not need an effect" advice rules are opinionated
      // refactors on existing code — surface them as warnings to clean up
      // incrementally rather than blocking CI on day one.
      "react-hooks/set-state-in-effect": "warn",
    },
  },

  // Test files: relax a couple of rules that fight with fixtures.
  {
    files: ["**/*.test.{ts,tsx}", "**/*.spec.{ts,tsx}"],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Keep ESLint out of Prettier's lane — must be last.
  prettier,
);
