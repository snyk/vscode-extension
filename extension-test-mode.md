## What's in the folder

* This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your extension and command.
  * The sample plugin registers a command and defines its title and command name. With this information VS Code can show the command in the command palette. It doesn’t yet need to load the plugin.
* `src/extension.ts` - this is the main file where you will provide the implementation of your command.
  * The file exports one function, `activate`, which is called the very first time your extension is activated (in this case by executing the command). Inside the `activate` function we call `registerCommand`.
  * We pass the function containing the implementation of the command as the second parameter to `registerCommand`.

## Get up and running straight away

* Press `F5` to open a new window with your extension loaded.
* Run your command from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and typing `Hello World`.
* Set breakpoints in your code inside `src/extension.ts` to debug your extension.
* Find output from your extension in the debug console.

## Make changes

* You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.


## Explore the API

* You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.

## Run tests

* Open the debug viewlet (`Ctrl+Shift+D` or `Cmd+Shift+D` on Mac) and from the launch configuration dropdown pick `Extension Tests`.
* Press `F5` to run the tests in a new window with your extension loaded.
* See the output of the test result in the debug console.
* Make changes to `src/test/suite/extension.test.ts` or create new test files inside the `test/suite` folder.
  * The provided test runner will only consider files matching the name pattern `**.test.ts`.
  * You can create folders inside the `test` folder to structure your tests any way you want.

## Go further

 * Reduce the extension size and improve the startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
 * [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VSCode extension marketplace.
 * Automate builds by setting up [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).


### Detailed instructions for tests

#### Starting extension in development mode:

1. clone the repo
2. run "npm install" in the main directory
3. open the project with VSCode
4. start debug mode(F5) with 'Run Extension' debug configuration - VSCode will start Extension Development Host in new window

#### To test extension right from istallation, do following steps:

1. clone the repo
2. open the project with VSCode
3. install vsce, the CLI tool for managing VS Code extensions:
   run command: "npm install -g vsce"
4. run command: "vsce package" in the root folder of extension
5. the .vsix file would be created and this file can be installed to vscode locally from folder
6. to install packaged extension locally, go to 'Extensions' in vscode and find "..." button in the top,
   in the opened dropdown choose 'Install from VSIX' option and then choose a path to packaged extension
   and it will be installed

### Additional info

Extension has one command.
When extension is installed or running in dev mode, go to 'Settings'(settings icon is in the left bottom of vscode window), choose 'Command Pallete...' and in opened input type commands(vscode will help with autocomplete)

## Usage with local package `@deepcode/tsc`

In order to test plugin with local package `@deepcode/tsc` you should make the following steps.

1. Clone package repository:
```shell script
$ git clone https://github.com/DeepCodeAI/tsc.git
```

> Probably you will need the `dev` branch with the latest changes:
> ```shell script
> $ git clone https://github.com/DeepCodeAI/tsc.git -b dev
> ```

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
$ npm link @deepcode/tsc
```

After that you can add package to your `package.json`:
```json
"dependencies": {
 "@deepcode/tsc": "^1.0.1"
}
```

and use this package as usual:
```javascript
import { ServiceAI } from '@deepcode/tsc';

const baseURL = 'https://www.deepcode.ai';

const AI = new ServiceAI();

async login(): Promise<string> {
 const { sessionToken } = await AI.startSession({ baseURL, source: IDE_NAME });
 return Promise.resolve(sessionToken);
}
```
