# ESLint 9 Migration - Complete

**Date**: 2026-02-01
**Status**: ✅ Complete

## What Changed

### 1. Package Upgrades

**Before** (ESLint 8):
```json
{
  "eslint": "^8.57.1",
  "@typescript-eslint/eslint-plugin": "^7.18.0",
  "@typescript-eslint/parser": "^7.18.0"
}
```

**After** (ESLint 9):
```json
{
  "eslint": "^9.39.2",
  "@typescript-eslint/eslint-plugin": "^8.54.0",
  "@typescript-eslint/parser": "^8.54.0",
  "typescript-eslint": "^8.54.0",
  "@eslint/eslintrc": "^3.3.3",
  "@eslint/js": "^9.39.2"
}
```

### 2. Configuration Format

**Before** (Legacy `.eslintrc.json`):
```json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended"
  ],
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "rules": {
    "@typescript-eslint/no-unused-vars": ["error", {...}]
  }
}
```

**After** (Flat Config `eslint.config.mjs`):
```javascript
import tseslint from "typescript-eslint";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

export default tseslint.config(
  { ignores: ["**/.next/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {...}]
    }
  }
);
```

### 3. Files Changed

**Deleted**:
- `.eslintrc.json` (old config format)
- `.eslintignore` (ignores now in config)

**Created**:
- `eslint.config.mjs` (new flat config)

**Modified**:
- `package.json` (package versions)
- `src/features/repositories/lib/scanner.ts` (unused var fix)

## Key Differences in ESLint 9

### 1. Flat Config Format

ESLint 9 uses a **flat config** format instead of cascading configs:

- Single config file at root
- Array of config objects
- No more `extends` - use spreads instead
- Ignores built into config (no separate file)

### 2. TypeScript ESLint v8

TypeScript ESLint v8 is designed for ESLint 9:

- Import from `typescript-eslint` package
- Use `tseslint.config()` helper
- Better TypeScript integration
- Improved type checking rules

### 3. Ignores

**Old**:
```
# .eslintignore
.next/
node_modules/
```

**New**:
```javascript
// eslint.config.mjs
{
  ignores: [
    "**/.next/**",
    "**/node_modules/**"
  ]
}
```

### 4. Extends via FlatCompat

For legacy configs (like Next.js), use `FlatCompat`:

```javascript
import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends("next/core-web-vitals")
];
```

## Migration Steps Performed

1. ✅ Removed ESLint 8 packages
2. ✅ Installed ESLint 9 + TypeScript ESLint v8
3. ✅ Created `eslint.config.mjs`
4. ✅ Deleted `.eslintrc.json`
5. ✅ Deleted `.eslintignore`
6. ✅ Fixed unused variable error
7. ✅ Tested full check passes

## Testing Results

### ✅ All Tests Pass

```bash
$ pnpm check
✓ Type checking passes
✓ Linting passes (0 errors, 0 warnings)

$ pnpm lint --version
v9.39.2
```

### Rules Applied

- `@typescript-eslint/no-unused-vars` - Error on unused vars (except `_` prefix)
- `@typescript-eslint/consistent-type-imports` - Enforce type imports
- `@typescript-eslint/no-explicit-any` - Warn on `any` usage
- Next.js rules - Via `next/core-web-vitals`
- React hooks rules - Via Next.js config

## Benefits of ESLint 9

1. **Simpler Config** - Single flat config file
2. **Better Performance** - Faster linting
3. **Improved TypeScript** - Better type checking with v8
4. **Modern JavaScript** - ES modules, modern syntax
5. **Future-Proof** - ESLint's new standard

## Configuration Details

### Ignored Patterns

```javascript
{
  ignores: [
    "**/node_modules/**",
    "**/.next/**",
    "**/out/**",
    "**/dist/**",
    "**/build/**",
    "next-env.d.ts",
    "eslint.config.mjs",
    "*.config.js",
    "*.config.ts",
    "*.config.mjs",
  ]
}
```

### Custom Rules

```javascript
{
  rules: {
    // Unused variables must start with _
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      },
    ],

    // Enforce type imports
    "@typescript-eslint/consistent-type-imports": [
      "error",
      {
        prefer: "type-imports",
        fixStyle: "separate-type-imports",
      },
    ],

    // Warn on any usage
    "@typescript-eslint/no-explicit-any": "warn",
  }
}
```

## Troubleshooting

### Issue: Config file being linted

**Error**: Type information required for config file

**Solution**: Add config files to ignores:
```javascript
{
  ignores: ["eslint.config.mjs", "*.config.*"]
}
```

### Issue: Legacy configs not working

**Error**: `extends` is not supported

**Solution**: Use `FlatCompat`:
```javascript
import { FlatCompat } from "@eslint/eslintrc";
const compat = new FlatCompat({...});
...compat.extends("config-name")
```

### Issue: Rules not applying

**Error**: Rules seem to be ignored

**Solution**: Ensure rule config is in separate object after extends:
```javascript
export default [
  ...tseslint.configs.recommended,
  { rules: { ... } } // Must be after extends
];
```

## References

- [ESLint v9 Migration Guide](https://eslint.org/docs/latest/use/migrate-to-9.0.0)
- [TypeScript ESLint v8 Guide](https://typescript-eslint.io/blog/announcing-typescript-eslint-v8)
- [Flat Config Documentation](https://eslint.org/docs/latest/use/configure/configuration-files)

## Rollback (if needed)

To rollback to ESLint 8:

```bash
# 1. Restore old packages
pnpm remove eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser typescript-eslint @eslint/eslintrc @eslint/js
pnpm add -D eslint@^8 @typescript-eslint/eslint-plugin@^7 @typescript-eslint/parser@^7

# 2. Restore .eslintrc.json from git
git restore .eslintrc.json .eslintignore

# 3. Remove eslint.config.mjs
rm eslint.config.mjs
```

---

**Migration Status**: ✅ Complete and Tested
**ESLint Version**: 9.39.2
**TypeScript ESLint Version**: 8.54.0
