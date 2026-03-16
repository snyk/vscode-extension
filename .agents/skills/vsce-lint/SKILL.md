---
name: vsce-lint
description: Linting the Snyk VS Code extension (snyk/vscode-extension). Use when asked to lint, fix lint issues, or before committing changes.
---

# VSCE Lint

## Commands

### Lint (check only)
```bash
npm run lint
```

### Lint with auto-fix
```bash
npm run lint:fix
```

## Guidelines

- Always run `npm run lint` (or `lint:fix`) before committing.
- Do **not** disable ESLint rules unless the human explicitly allows it for that single instance.
- **Never** invoke `npx eslint` directly. Always use the `npm run` scripts above.
