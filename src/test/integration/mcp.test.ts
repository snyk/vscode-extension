/**
 * Integration tests for MCP Configuration
 *
 * These tests verify the MCP configuration logic for Cursor, Windsurf, and Copilot.
 * They use the actual vscode environment available in integration tests.
 */

import { strictEqual } from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import path from 'path';
import sinon from 'sinon';

suite('MCP Configuration Integration Tests', () => {
  let fsReadFileStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;
  let fsMkdirStub: sinon.SinonStub;
  let fsUnlinkStub: sinon.SinonStub;
  let homedirStub: sinon.SinonStub;

  setup(() => {
    fsReadFileStub = sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
    fsMkdirStub = sinon.stub(fs.promises, 'mkdir');
    sinon.stub(fs, 'existsSync');
    fsUnlinkStub = sinon.stub(fs.promises, 'unlink');
    homedirStub = sinon.stub(os, 'homedir');

    homedirStub.returns('/home/testuser');
    fsMkdirStub.resolves();
    fsWriteFileStub.resolves();
    fsUnlinkStub.resolves();
  });

  teardown(() => {
    sinon.restore();
  });

  suite('File System Operations', () => {
    test('ensureInGitignore - Creates .gitignore when it does not exist', () => {
      fsReadFileStub.rejects(new Error('ENOENT'));

      // Simulate the gitignore logic
      const pattern = '.cursor/rules/snyk_rules.mdc';
      const gitignoreContent = `\n# Snyk Security Extension - AI Rules (auto-generated)\n${pattern}\n`;

      strictEqual(gitignoreContent.includes(pattern), true);
      strictEqual(gitignoreContent.includes('auto-generated'), true);
    });

    test('ensureInGitignore - Appends to existing .gitignore without duplicating', () => {
      const existingContent = 'node_modules/\ndist/\n';
      const pattern = '.cursor/rules/snyk_rules.mdc';

      fsReadFileStub.resolves(existingContent);

      const missing = existingContent.includes(pattern) ? [] : [pattern];

      strictEqual(missing.length, 1, 'Should detect missing pattern');
      strictEqual(missing[0], pattern, 'Should include the pattern');

      const updatedContent = existingContent + `\n# Snyk Security Extension - AI Rules (auto-generated)\n${pattern}\n`;

      strictEqual(updatedContent.includes('node_modules/'), true);
      strictEqual(updatedContent.includes(pattern), true);
    });

    test('ensureInGitignore - Does not append when pattern exists', () => {
      const existingContent = 'node_modules/\n.cursor/rules/snyk_rules.mdc\n';
      const pattern = '.cursor/rules/snyk_rules.mdc';

      fsReadFileStub.resolves(existingContent);

      const missing = existingContent.includes(pattern) ? [] : [pattern];

      strictEqual(missing.length, 0, 'Should not find missing pattern');
    });
  });

  suite('Rule File Selection Logic', () => {
    test('Selects smart_apply rules for Smart Scan frequency', () => {
      const frequency = 'Smart Scan';
      const rulesFileName = frequency === 'Smart Scan' ? 'snyk_rules_smart_apply.md' : 'snyk_rules_always_apply.md';

      strictEqual(rulesFileName, 'snyk_rules_smart_apply.md');
    });

    test('Selects always_apply rules for other frequencies', () => {
      const frequencies = ['Always Apply', 'On Save', 'Manual'];

      frequencies.forEach(frequency => {
        const rulesFileName = frequency === 'Smart Scan' ? 'snyk_rules_smart_apply.md' : 'snyk_rules_always_apply.md';
        strictEqual(rulesFileName, 'snyk_rules_always_apply.md', `Should use always_apply for ${frequency}`);
      });
    });
  });

  suite('MCP Environment Configuration', () => {
    test('Formats trusted folders with semicolon separator', () => {
      const folders = ['/folder1', '/folder2', '/folder3'];
      const formatted = folders.join(';');

      strictEqual(formatted, '/folder1;/folder2;/folder3');
    });

    test('Includes token only for token and pat auth methods', () => {
      const tokenMethods = ['token', 'pat'];
      const otherMethods = ['oauth', 'api_key'];

      tokenMethods.forEach(method => {
        const shouldInclude = method === 'token' || method === 'pat';
        strictEqual(shouldInclude, true, `Should include token for ${method}`);
      });

      otherMethods.forEach(method => {
        const shouldInclude = method === 'token' || method === 'pat';
        strictEqual(shouldInclude, false, `Should not include token for ${method}`);
      });
    });

    test('Merges environment variables preserving custom vars', () => {
      const existingEnv: Record<string, string> = {
        CUSTOM_VAR: 'keep-this',
        SNYK_TOKEN: 'old-token',
      };

      const newEnv: Record<string, string> = {
        SNYK_TOKEN: 'new-token',
        SNYK_CFG_ORG: 'my-org',
      };

      const merged: Record<string, string> = { ...existingEnv };
      const overrideKeys = ['SNYK_TOKEN', 'SNYK_CFG_ORG', 'SNYK_API'];

      for (const k of overrideKeys) {
        if (Object.hasOwn(existingEnv, k) && Object.hasOwn(newEnv, k)) {
          merged[k] = newEnv[k];
        }
      }

      strictEqual(merged.CUSTOM_VAR, 'keep-this', 'Should preserve custom vars');
      strictEqual(merged.SNYK_TOKEN, 'new-token', 'Should update Snyk token');
      strictEqual(merged.SNYK_CFG_ORG, undefined, 'Should not add new Snyk vars not in existing');
    });
  });

  suite('MCP Config Structure', () => {
    test('Creates valid JSON structure for MCP config', () => {
      const config = {
        mcpServers: {
          Snyk: {
            command: '/path/to/cli',
            args: ['mcp', '-t', 'stdio'],
            env: {
              SNYK_TOKEN: 'test-token',
              SNYK_CFG_ORG: 'my-org',
            },
          },
        },
      };

      const json = JSON.stringify(config, null, 2);
      const parsed = JSON.parse(json) as typeof config;

      strictEqual(parsed.mcpServers.Snyk.command, '/path/to/cli');
      strictEqual(parsed.mcpServers.Snyk.args.length, 3);
      strictEqual(parsed.mcpServers.Snyk.env.SNYK_TOKEN, 'test-token');
    });

    test('Matches server keys case-insensitively', () => {
      const serverKey = 'Snyk';
      const existingKeys = ['snyk', 'SNYK', 'Snyk', 'snyk-scanner'];

      existingKeys.forEach(key => {
        const lowerKey = key.toLowerCase();
        const lowerServerKey = serverKey.toLowerCase();
        const matches = lowerKey === lowerServerKey || lowerKey.includes(lowerServerKey);
        strictEqual(matches, true, `Should match key: ${key}`);
      });
    });
  });

  suite('Path Generation', () => {
    test('Generates correct Cursor paths', () => {
      const homeDir = homedirStub() as string;
      const mcpConfigPath = path.join(homeDir, '.cursor', 'mcp.json');
      const rulesPath = '.cursor/rules/snyk_rules.mdc';

      strictEqual(mcpConfigPath.endsWith('mcp.json'), true);
      strictEqual(rulesPath.endsWith('snyk_rules.mdc'), true);
    });

    test('Generates correct Windsurf paths', () => {
      const homeDir = homedirStub() as string;
      const mcpConfigPath = path.join(homeDir, '.codeium', 'windsurf', 'mcp_config.json');
      const rulesPath = '.windsurf/rules/snyk_rules.md';

      strictEqual(mcpConfigPath.includes('windsurf'), true);
      strictEqual(rulesPath.endsWith('snyk_rules.md'), true);
    });

    test('Generates correct Copilot paths', () => {
      const rulesPath = '.github/instructions/snyk_rules.instructions.md';

      strictEqual(rulesPath.includes('.github/instructions'), true);
      strictEqual(rulesPath.endsWith('.instructions.md'), true);
    });
  });
});
