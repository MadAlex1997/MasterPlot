// ESLint flat config (REL5). Correctness-focused (no-unused-vars, no-undef, etc.)
// rather than style — no formatting/quote/semicolon rules.
//
// Scope: src/, ui/, loaders/, test/, and root build config only. Per this
// repo's own directory-ownership rules (prompt.md rule 5a), examples/ is
// demo/docs scaffolding, not the shipped library — it's excluded here rather
// than folded into the same quality gate as the actual product surface.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'lib/**',
      'docs/**',
      'examples/**',
      'test-types/**',
      'sounds/**',
      '*.tgz',
    ],
  },

  js.configs.recommended,

  // Default: browser-context library source.
  {
    files: ['src/**/*.js', 'src/**/*.jsx', 'ui/**/*.jsx', 'loaders/**/*.js', 'test/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: { ...globals.browser },
    },
    rules: {
      // Interface/abstract-stub params and handler-signature-consistency params
      // are intentionally unused — mark intent with a leading underscore.
      'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_' }],
    },
  },

  // Node-context CommonJS build config.
  {
    files: ['webpack.config.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },

  // Node-context ESM build/test config.
  {
    files: ['rollup.config.mjs', 'vitest.config.mjs', 'eslint.config.mjs'],
    languageOptions: {
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // react-hooks rules, scoped to the library's React surface per the plan
  // (ui/ convenience components + src/components/ library React API).
  {
    files: ['ui/**/*.jsx', 'src/components/**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
