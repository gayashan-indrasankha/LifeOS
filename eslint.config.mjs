import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { files: ['**/*.cjs'], rules: { '@typescript-eslint/no-require-imports': 'off' } },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    '.next-e2e/**',
    'out/**',
    'build/**',
    'dist-desktop/**',
    'desktop-stage/**',
    'android-stage/**',
    '.android-toolchain/**',
    'android/.gradle/**',
    'android/build/**',
    'android/app/build/**',
    'dist-android/**',
    '.desktop-test/**',
    'next-env.d.ts',
  ]),
]);

export default eslintConfig;
