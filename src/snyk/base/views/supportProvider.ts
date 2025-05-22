import { ThemeIcon, TreeItemCollapsibleState, workspace, window, Uri } from 'vscode';
import { SNYK_DCIGNORE_COMMAND } from '../../common/constants/commands';
import { TreeNode } from '../../common/views/treeNode';
import { TreeNodeProvider } from '../../common/views/treeNodeProvider';
import { TextEncoder, TextDecoder } from 'util';
import * as fs from 'fs';

export class SupportProvider extends TreeNodeProvider {
  getRootChildren(): TreeNode[] {
    return [
      new TreeNode({
        text: 'Send us feedback or report a bug',
        icon: new ThemeIcon('mail'),
        link: 'https://snyk.io/contact-us/?utm_source=vsc',
      }),
      new TreeNode({
        text: 'Get the most out of the Snyk extension',
        icon: new ThemeIcon('file-text'),
        link: 'https://docs.snyk.io/ide-tools/visual-studio-code-extension',
      }),
      new TreeNode({
        text: 'Add Snyk to workspace recommended extensions',
        icon: new ThemeIcon('extensions'),
        command: {
          command: 'snyk.addToWorkspaceRecommendations',
          title: '',
          arguments: [],
        },
      }),
      new TreeNode({
        text: 'Ignore files and directories',
        icon: new ThemeIcon('file-text'),
        collapsed: TreeItemCollapsibleState.Expanded,
        children: [
          new TreeNode({
            text: 'Add a pre-filled .dcignore file',
            icon: new ThemeIcon('new-file'),
            command: {
              command: SNYK_DCIGNORE_COMMAND,
              title: '',
              arguments: [],
            },
          }),
          new TreeNode({
            text: 'Add a blank .dcignore file',
            icon: new ThemeIcon('new-file'),
            command: {
              command: SNYK_DCIGNORE_COMMAND,
              title: '',
              arguments: [true],
            },
          }),
        ],
      }),
    ];
  }

  /**
   * Adds the Snyk extension to the workspace recommended extensions
   * by creating or updating the .vscode/extensions.json file
   * Also checks if .vscode is in .gitignore and provides guidance if it is
   */
  static async addToWorkspaceRecommendations(): Promise<void> {
    const workspaceFolders = workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      void window.showErrorMessage('No workspace folder is open. Please open a folder first.');
      return;
    }

    // Handle multi-root workspace scenario
    let workspaceFolder: { uri: Uri; name: string; index: number };

    if (workspaceFolders.length > 1) {
      // Multiple workspace folders, ask user which one to use
      const folderOptions = workspaceFolders.map(folder => ({
        label: folder.name,
        description: folder.uri.fsPath,
        folder,
      }));

      const selectedFolder = await window.showQuickPick(folderOptions, {
        placeHolder: 'Select workspace folder to add Snyk to recommended extensions',
        canPickMany: false,
      });

      if (!selectedFolder) {
        // User cancelled the selection
        return;
      }

      workspaceFolder = selectedFolder.folder;
    } else {
      // Single workspace folder
      workspaceFolder = workspaceFolders[0];
    }
    const vscodeFolder = Uri.joinPath(workspaceFolder.uri, '.vscode');
    const extensionsJsonFile = Uri.joinPath(vscodeFolder, 'extensions.json');

    try {
      // Create .vscode directory if it doesn't exist
      try {
        const dirExists = await workspace.fs.stat(vscodeFolder).then(
          () => true,
          () => false,
        );
        if (!dirExists) {
          await workspace.fs.createDirectory(vscodeFolder);
        }
      } catch (error) {
        // Handle directory creation errors (permissions, etc.)
        void window.showErrorMessage(
          `Failed to create .vscode directory: ${error instanceof Error ? error.message : String(error)}`,
        );
        throw error; // Re-throw to stop the process
      }

      // Try to read existing extensions.json
      let extensionsJson: { recommendations?: string[] } = { recommendations: [] };
      try {
        const fileContent = await workspace.fs.readFile(extensionsJsonFile);
        const decoder = new TextDecoder('utf-8');
        extensionsJson = JSON.parse(decoder.decode(fileContent)) as { recommendations?: string[] };
        if (!extensionsJson.recommendations) {
          extensionsJson.recommendations = [];
        }
      } catch (error) {
        // File doesn't exist or can't be read, use default empty structure
      }

      // Add Snyk extension to recommendations if not already there
      const snykExtensionId = 'snyk-security.snyk-vulnerability-scanner';
      if (!extensionsJson.recommendations?.includes(snykExtensionId)) {
        // Ensure recommendations array exists
        if (!extensionsJson.recommendations) {
          extensionsJson.recommendations = [];
        }
        extensionsJson.recommendations.push(snykExtensionId);

        // Write updated extensions.json
        const content = JSON.stringify(extensionsJson, null, 2);
        const encoder = new TextEncoder();
        await workspace.fs.writeFile(extensionsJsonFile, encoder.encode(content));

        // Check if .vscode is in .gitignore
        await SupportProvider.checkGitIgnoreStatus(workspaceFolder.uri.fsPath, extensionsJsonFile.fsPath);
      } else {
        void window.showInformationMessage('Snyk is already in workspace recommended extensions.');
        // Still check gitignore status even if the extension was already in recommendations
        await SupportProvider.checkGitIgnoreStatus(workspaceFolder.uri.fsPath, extensionsJsonFile.fsPath);
      }
    } catch (error) {
      void window.showErrorMessage(
        `Failed to update workspace recommendations: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Checks if .vscode directory or extensions.json file is in .gitignore
   * and provides guidance to the user if it is
   * @param workspacePath Path to the workspace folder
   * @param extensionsJsonPath Path to the extensions.json file
   */
  private static async checkGitIgnoreStatus(workspacePath: string, extensionsJsonPath: string): Promise<void> {
    try {
      // Check if .git directory exists (indicates a git repository)
      const gitDirPath = `${workspacePath}/.git`;
      if (!fs.existsSync(gitDirPath)) {
        // Not a git repository, no need to check
        void window.showInformationMessage('Snyk has been added to workspace recommended extensions.');
        return;
      }

      // Check if .gitignore exists
      const gitignorePath = `${workspacePath}/.gitignore`;
      if (!fs.existsSync(gitignorePath)) {
        // No .gitignore file, so .vscode is not ignored
        void window.showInformationMessage('Snyk has been added to workspace recommended extensions.');
        return;
      }

      // Read .gitignore content
      const gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      const lines = gitignoreContent.split('\n');

      // Check if .vscode or .vscode/extensions.json is ignored
      const isVsCodeIgnored = lines.some(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('#') || trimmedLine === '') {
          return false; // Skip comments and empty lines
        }

        // Check for .vscode or .vscode/ or .vscode/* patterns
        return (
          trimmedLine === '.vscode' ||
          trimmedLine === '.vscode/' ||
          trimmedLine === '.vscode/*' ||
          trimmedLine === '**/.vscode' ||
          trimmedLine === '**/.vscode/' ||
          trimmedLine === '**/.vscode/*'
        );
      });

      if (isVsCodeIgnored) {
        // .vscode is ignored, show message with options
        const addToGit = 'Add to Git';
        const showCommand = 'Show Git Command';
        const result = await window.showWarningMessage(
          'The .vscode folder is currently ignored by Git. To share the recommended extensions with your team, you must add it to version control.',
          addToGit,
          showCommand,
        );

        if (result === addToGit) {
          // Run git add command
          const terminal = window.createTerminal('Snyk Git');
          terminal.sendText(`git add -f "${extensionsJsonPath}"`);
          terminal.show();
        } else if (result === showCommand) {
          // Show the command to run
          void window.showInformationMessage(`Run this command to add the file: git add -f "${extensionsJsonPath}"`);
        }
      } else {
        // .vscode is not ignored, show success message
        void window.showInformationMessage('Snyk has been added to workspace recommended extensions.');
      }
    } catch (error) {
      // In case of any error checking gitignore status, just show the success message
      void window.showInformationMessage('Snyk has been added to workspace recommended extensions.');
      console.error('Error checking gitignore status:', error);
    }
  }
}
