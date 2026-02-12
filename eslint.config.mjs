import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // Ignore patterns
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/.playwright-mcp/**',
      'next-env.d.ts',
      'eslint.config.mjs',
      '*.config.js',
      '*.config.ts',
      '*.config.mjs',
    ],
  },

  // Base JavaScript recommended
  js.configs.recommended,

  // TypeScript ESLint recommended (without type checking)
  ...tseslint.configs.recommended,

  // Custom rules
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-expressions': 'off',
      'max-lines-per-function': 'error',
      'max-params': ['error', 5],
      complexity: ['error', 10],
    },
  },

  // Relax rules for React component files (components often need more lines)
  // Note: This must come BEFORE test file rules so tests can fully disable these
  {
    files: ['**/components/**/*.tsx'],
    ignores: ['**/__tests__/**', '**/*.test.tsx', '**/*.spec.tsx'],
    rules: {
      'max-lines-per-function': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 20],
    },
  },

  // Relax rules for test files - must come LAST to take precedence
  {
    files: ['**/__tests__/**/*.{ts,tsx}', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: {
      'max-lines-per-function': 'off',
      'max-params': 'off',
      complexity: 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
