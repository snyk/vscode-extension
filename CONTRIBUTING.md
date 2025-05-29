# Contributing to the Snyk IDE Extensions

We welcome contributions, but please read first! To ensure a smooth process and that your valuable work aligns with our roadmap, please keep the following in mind to help manage expectations:

## 1. Planning your changes

Before undertaking any changes or new features, please discuss your plans with us. This helps align on scope, design, technical approach, and priority.  
Even bug fixes can have unforeseen impacts or alternative solutions better suited for the codebase, so please ask first, we will be happy to discuss.  
Please raise a request with [support](https://support.snyk.io). (Snyk employees, use `#ask-ide`)

## 2. Where changes should be made

Consider whether your proposed change should be implemented within the IDE extension(s) or in the shared Language Server and related stack.
- [Snyk Language Server](https://github.com/snyk/snyk-ls)
- [Go Application Framework](https://github.com/snyk/go-application-framework)
- [Code Client Go](https://github.com/snyk/code-client-go)

## 3. Cross-IDE consistency

If your change is applicable to other Snyk IDE plugins as well, we may expect you to submit similar PRs for the other relevant IDE repositories after your initial PR has been reviewed and approved, as they will _usually_ need to be merged all at once or not at all.
- [Snyk IntelliJ plugin](https://github.com/snyk/snyk-intellij-plugin)
- [Snyk Eclipse plugin](https://github.com/snyk/snyk-eclipse-plugin)
- [Snyk Visual Studio extension](https://github.com/snyk/snyk-visual-studio-plugin)

## 4. Manual testing

All changes must be thoroughly manually tested by you.  
For visual changes the PR template asks for screenshots, so this is a good opportunity to snap them.

## 5. Documentation changes

Any user-facing changes will require [documentation](https://docs.snyk.io/) changes, which you will need to prepare.
If you do not have access to our content management system (you are not a Snyk employee), please add the documentation changes required (including new wording and screenshots) to the PR description.

We can instruct you on what to add to the CHANGELOG.md, so please ask.

---

# Making Changes

## Run extension and debug

Clone the repository, then run `npm install && npm run build` in the directory.

- Open repository directory in VS Code and press `F5` to run extension in a new VS Code window.
- This allows extension debugging within VS Code.
- You can find output from your extension in the debug console and output channel.

Please install all recommended extension that are suggested by VS Code when first opening the cloned directory. You can also do install them manually with the list of extensions defined in `.vscode/extensions.json`. This will ensure consistent formatting with the current codebase.

## Make changes

Code changes require extension reload when run in debug.

- You can relaunch the extension from the debug toolbar after changing code.
- You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.

## Watching changes

- When run in debug, VS Code runs watch for TS files automatically for you.
- If not in debug, run `npm run watch-all` to track changes in both TS and SCSS files.
  - If you want to track changes to TS files only, use `npm run watch`.
  - If you want to track changes to SCSS files only, use `npm run watch-resources`.

## Run tests and debug

- Unit tests
  - Run `npm run test:unit` for a single execution, `npm run test:unit:watch` to watch for changes.
  - Make sure to re-run the command to pick up new files, if new `**.test.ts` is added.

- Integration tests
  - Run `npm run test:integration`.

- Run Lint
  - npm `npm run lint`

You can debug tests via VS Code debugger, selecting "Extension Unit Tests" or "Extension Integration Tests" respectively.

## Analytics, experimentation and error reporting

To test for analytics, experimentation and error reporting integrations, create `snyk.config.local.json` file in the root folder and copy the contents from `snyk.config.json`, replacing config values with API keys for relevant integrations.

## Source code organization

The code is organized in folders grouped by [feature](https://phauer.com/2020/package-by-feature/), unless it's product unrelated code. The overall layering tree loks like that:

```
├── snyk
│   ├── common
│   │   ├── Common code that is shared between different products.
│   ├── base
│   │   ├── Provides general utilities and basic extension building blocks.
│   ├── cli
│   │   ├── Code responsible for interaction with Snyk CLI.
│   ├── snykCode
│   │   ├── Snyk Code product specific code.
│   ├── snykOss
│   │   ├── Snyk Open Source product specific code.
├── test
│   ├── integration
│   │   ├── Integration tests.
│   ├── unit
│   │   ├── Unit tests.
```

## Additional info

### Explore the VS Code API

You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.
