## Run extension and debug

Clone the repository, then run `npm install` in the directory.

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

You can debug tests via VS Code debugger, selecting "Extension Unit Tests" or "Extension Integration Tests" respectively.

## Analytics, experimentation and error reporting

To test for analytics, experimentation and error reporting integrations, create `snyk.config.local.json` file in the root folder and copy the contents from `snyk.config.json`, replacing config values with API keys for relevant integrations.

## Source code organization

The code is organized in folders grouped by [feature](https://phauer.com/2020/package-by-feature/), unless it's product unrelated code. The overall layering tree loks like that:

```
├── ampli
│   └── Amplitude CLI generated code.
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

### Usage with local package `@snyk/code-client`

In order to test plugin with local package `@snyk/code-client` you should make the following steps.

1. Clone package repository:

```shell script
$ git clone https://github.com/snyk/code-client.git
```

2. Go to the package folder, install dependencies, build package and create symlink:

```shell script
$ cd tsc
$ npm install
$ npm run build
$ npm link
```

3. Go to the extension folder and install package from local symlink:

```shell script
$ cd vscode-extension
$ npm link @snyk/code-client
```

After that you can add package to your `package.json`:

```json
"dependencies": {
 "@snyk/code-client": "^2.4.1"
}
```
