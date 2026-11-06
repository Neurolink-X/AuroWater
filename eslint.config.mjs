import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * AUROTAP: PRODUCTION ESLINT CONFIGURATION
 * Next.js 16 | React 19 | TypeScript | ESLint 9+ flat config
 *
 * Rollout flags (environment variables)
 *   LINT_TYPED=0   -> type-aware rules OFF (fast; use for required CI job)
 *   LINT_STRICT=1  -> type-aware rules become errors (use after cleanup)
 *   default        -> type-aware rules ON as warnings
 *
 * Commands
 *   npx eslint .                          # normal check
 *   npx eslint . --fix                    # safe automatic fixes only
 *   LINT_TYPED=0 npx eslint .             # fast CI check
 *   LINT_STRICT=1 npx eslint . --max-warnings=0   # final strict gate
 *
 * Notes
 * - Rules like no-floating-promises are NOT auto-fixable; fix manually.
 * - Requires Node 20.11+ (import.meta.dirname) and a root tsconfig.json.
 * - On Windows, use `cross-env` for inline env variables.
 */

const STRICT = process.env.LINT_STRICT === "1";

const TYPED =
  STRICT || process.env.LINT_TYPED === "1";

const level = STRICT ? "error" : "warn";

const SOURCE_TS = ["**/*.{ts,tsx,mts,cts}"];
const SOURCE_ALL = ["**/*.{js,mjs,cjs,jsx,ts,tsx,mts,cts}"];
const TEST_FILES = [
  "**/*.{test,spec}.{js,jsx,ts,tsx}",
  "**/__tests__/**/*.{js,jsx,ts,tsx}",
  "e2e/**/*.{js,ts}",
  "tests/**/*.{js,ts,tsx}",
];
const NODE_SCRIPT_FILES = [
  "scripts/**/*.{js,mjs,cjs,ts}",
  "*.config.{js,mjs,cjs,ts}",
  "**/*.config.{js,mjs,cjs,ts}",
];

const eslintConfig = defineConfig([
  // 1. Official Next.js presets (React, Hooks, Next, a11y, Web Vitals)
  ...nextVitals,
  ...nextTs,

  // 2. Core JavaScript correctness and security
  {
    name: "aurotap/core-safety",
    files: SOURCE_ALL,
    linterOptions: {
      reportUnusedDisableDirectives: "warn",
    },
    rules: {
      // Dangerous patterns
      "no-debugger": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-script-url": "error",
      "no-proto": "error",
      "no-extend-native": "error",
      "no-throw-literal": "error",

      // Likely bugs
      "no-cond-assign": ["error", "except-parens"],
      "no-unreachable": "error",
      "no-dupe-keys": "error",
      "no-dupe-else-if": "error",
      "no-duplicate-case": "error",
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",
      "no-unsafe-finally": "error",
      "no-unsafe-optional-chaining": "error",
      "no-promise-executor-return": "error",
      "array-callback-return": ["error", { allowImplicit: true }],
      "no-constant-condition": ["warn", { checkLoops: false }],
      "no-self-assign": "error",
      "no-useless-return": "warn",

      // Style that prevents bugs
      eqeqeq: ["warn", "always", { null: "ignore" }],
      "prefer-const": ["warn", { destructuring: "all" }],
      "no-var": "error",
      "object-shorthand": ["warn", "always"],
      "prefer-template": "warn",
      "prefer-object-spread": "warn",
      "no-else-return": ["warn", { allowElseIf: false }],
      "no-lonely-if": "warn",
      "no-useless-concat": "warn",
      "no-useless-rename": "warn",
      "no-param-reassign": ["warn", { props: false }],
      curly: ["warn", "multi-line"],
      "no-nested-ternary": "warn",
      "no-console": ["warn", { allow: ["warn", "error", "info"] }],
      "no-alert": "warn",

      // Import hygiene
      "import/no-duplicates": "warn",
      "import/no-self-import": "error",
      "import/no-mutable-exports": "error",
      "import/first": "warn",
      "import/newline-after-import": "warn",
    },
  },

  // 3. React, accessibility and security
  {
    name: "aurotap/react",
    files: ["**/*.{jsx,tsx}"],
    rules: {
      // Security
      "react/no-danger": "warn",
      "react/no-danger-with-children": "error",
      "react/jsx-no-target-blank": "error",
      "react/jsx-no-script-url": "error",

      // Correctness
      "react/jsx-key": [
        "error",
        { checkFragmentShorthand: true, checkKeyMustBeforeSpread: true },
      ],
      "react/no-array-index-key": "warn",
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",
      "react/no-unstable-nested-components": "warn",
      "react/no-unescaped-entities": "warn",
      "react/self-closing-comp": "warn",
      "react/jsx-boolean-value": ["warn", "never"],
      "react/jsx-curly-brace-presence": [
        "warn",
        { props: "never", children: "never" },
      ],
      "react/jsx-fragments": ["warn", "syntax"],
      "react/jsx-no-useless-fragment": ["warn", { allowExpressions: true }],

      // Hooks
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // Accessibility
      "jsx-a11y/alt-text": "error",
      "jsx-a11y/anchor-is-valid": "error",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/label-has-associated-control": "warn",
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/no-noninteractive-element-interactions": "warn",
      "jsx-a11y/no-autofocus": "warn",

      // Next.js
      "@next/next/no-img-element": "warn",
      "@next/next/no-html-link-for-pages": "error",
      "@next/next/no-sync-scripts": "error",
    },
  },

  // 4. TypeScript quality (syntax-level, fast, no type information needed)
  {
    name: "aurotap/typescript",
    files: SOURCE_TS,
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "error",
      "no-shadow": "off",
      "@typescript-eslint/no-shadow": ["warn", { ignoreTypeValueShadow: true }],
      "no-use-before-define": "off",
      "@typescript-eslint/no-use-before-define": [
        "warn",
        { functions: false, classes: true, variables: true, typedefs: false },
      ],

      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "@typescript-eslint/no-explicit-any": ["warn", { ignoreRestArgs: true }],
      "@typescript-eslint/no-non-null-assertion": "warn",
      "@typescript-eslint/no-non-null-asserted-optional-chain": "error",
      "@typescript-eslint/no-empty-object-type": [
        "warn",
        { allowInterfaces: "with-single-extends" },
      ],
      "@typescript-eslint/no-unsafe-function-type": "error",
      "@typescript-eslint/no-wrapper-object-types": "error",
      "@typescript-eslint/no-require-imports": "error",
      "@typescript-eslint/no-namespace": "error",
      "@typescript-eslint/no-duplicate-enum-values": "error",
      "@typescript-eslint/no-dupe-class-members": "error",
      "@typescript-eslint/no-useless-constructor": "warn",
      "@typescript-eslint/no-inferrable-types": "warn",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/prefer-as-const": "error",
      "@typescript-eslint/prefer-for-of": "warn",
      "@typescript-eslint/array-type": ["warn", { default: "array-simple" }],
      "@typescript-eslint/consistent-type-definitions": ["warn", "interface"],
      "@typescript-eslint/ban-ts-comment": [
        "warn",
        {
          "ts-expect-error": "allow-with-description",
          "ts-ignore": true,
          "ts-nocheck": true,
          "ts-check": false,
          minimumDescriptionLength: 10,
        },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        {
          prefer: "type-imports",
          fixStyle: "separate-type-imports",
          disallowTypeAnnotations: false,
        },
      ],
      "@typescript-eslint/consistent-type-exports": "warn",
    },
  },

  // 5. Type-aware rules (gradual rollout; see flags at the top)
  //    Default: warnings. LINT_STRICT=1: errors. LINT_TYPED=0: disabled.
  ...(TYPED
    ? [
        {
          name: "aurotap/typescript-type-aware",
          files: [
            "src/**/*.{ts,tsx}",
            "app/**/*.{ts,tsx}",
            "lib/**/*.{ts,tsx}",
            "components/**/*.{ts,tsx}",
            "pages/**/*.{ts,tsx}",
          ],
          ignores: [...TEST_FILES, "**/*.d.ts"],
          languageOptions: {
            parserOptions: {
              projectService: true,
              tsconfigRootDir: import.meta.dirname,
            },
          },
          rules: {
            "@typescript-eslint/no-floating-promises": [
              level,
              { ignoreVoid: true },
            ],
            "@typescript-eslint/no-misused-promises": [
              level,
              { checksVoidReturn: { attributes: false } },
            ],
            "@typescript-eslint/await-thenable": level,
            "@typescript-eslint/only-throw-error": level,
            "@typescript-eslint/return-await": [level, "in-try-catch"],
            "@typescript-eslint/no-implied-eval": level,
            "@typescript-eslint/no-for-in-array": level,

            // Always warnings (style / cleanup)
            "@typescript-eslint/switch-exhaustiveness-check": [
              "warn",
              { considerDefaultExhaustiveForUnions: true },
            ],
            "@typescript-eslint/no-unnecessary-type-assertion": "warn",
            "@typescript-eslint/no-unnecessary-boolean-literal-compare": "warn",
            "@typescript-eslint/no-duplicate-type-constituents": "warn",
            "@typescript-eslint/prefer-nullish-coalescing": [
              "warn",
              { ignorePrimitives: { string: true, boolean: true } },
            ],
            "@typescript-eslint/prefer-optional-chain": "warn",
            "@typescript-eslint/require-await": "off",
          },
        },
      ]
    : []),

  // 6. Next.js file conventions (default exports required)
  {
    name: "aurotap/next-conventions",
    files: [
      "**/app/**/{page,layout,template,loading,error,global-error,not-found,default,route}.{js,jsx,ts,tsx}",
      "**/pages/**/*.{js,jsx,ts,tsx}",
      "**/middleware.{js,ts}",
      "**/proxy.{js,ts}",
      "**/{instrumentation,instrumentation-client}.{js,ts}",
      "**/*.config.{js,mjs,cjs,ts}",
      "**/{sitemap,robots,manifest,opengraph-image,twitter-image,icon,apple-icon}.{js,ts,tsx}",
    ],
    rules: {
      "import/no-anonymous-default-export": "off",
      "import/no-default-export": "off",
    },
  },

  // 7. Tests: pragmatic relaxations
  {
    name: "aurotap/tests",
    files: TEST_FILES,
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@typescript-eslint/no-require-imports": "off",
      "react/display-name": "off",
      "no-console": "off",
    },
  },

  // 8. Node scripts and tool config files
  {
    name: "aurotap/node-scripts",
    files: NODE_SCRIPT_FILES,
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-require-imports": "off",
      "import/no-anonymous-default-export": "off",
    },
  },

  // 9. Plain JS files: skip TS-only concerns
  {
    name: "aurotap/javascript-files",
    files: ["**/*.{js,mjs,cjs,jsx}"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/consistent-type-imports": "off",
    },
  },

  // 10. Ignored paths (generated output, caches, vendored code)
  globalIgnores([
    ".next/**",
    ".vercel/**",
    ".turbo/**",
    "out/**",
    "next-env.d.ts",
    "build/**",
    "dist/**",
    "storybook-static/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    ".nyc_output/**",
    "node_modules/**",
    "**/*.min.js",
    "**/generated/**",
    "public/**",
  ]),
]);

export default eslintConfig;
