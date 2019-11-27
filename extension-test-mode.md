# VSCodeIntegration

VSCode IDE integration for DeepCode based on public APIs.

This file must be modified before publishing extension to marketplace.

### Instructions for tests

#### Starting extension in development mode:

1. clone the repo
2. run "yarn install" in the main directory
3. open the project with VSCode
4. start debug mode(F5) with 'Run Extension' debug configuration - VSCode will start Extension Development Host in new window

#### Tests

To start extension tests, start debug mode(F5) with 'Extension Tests' configuration. The results of tests will be displayed in Debug Console of vscode

#### To test extension right from istallation, do following steps:

1. clone the repo
2. open the project with VSCode
3. install vsce, the CLI tool for managing VS Code extensions:
   run command: "npm install -g vsce"
4. vsce requires registration of a publisher and token to package extension.
   here is the test publisher, which have been created for tests:
   - publisher: [PUBLISHER]
   - publisher token: [PUBLISHER_TOKEN]

before packaging extension the publisher needs to be logged in, so run command:
'vsce login [PUBLISHER]'

5. run command: "vsce package" in the root folder of extension
6. the .vsix file would be created and this file can be installed to vscode locally from folder
7. to install packaged extension locally, go to 'Extensions' in vscode and find "..." button in the top,
   in the opened dropdown choose 'Install from VSIX' option and then choose a path to packaged extension
   and it will be installed

### Additional info

Extension has 2 commands.
When extension is installed or running in dev mode, go to 'Settings'(settings icon is in the left bottom of vscode window), choose 'Command Pallete...' and in opened input type commands(vscode will help with autocomplete)

#### Here are commands:

##### 'DeepCode':

restarts extension. this might be usefull if user refused to login or refused to confirm sending files to server. in this case running this command will reactivate extension and user will be abel to complete all actions to start review

##### 'DeepCode Settings':

opens the extension settings window.
