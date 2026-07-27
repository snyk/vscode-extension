/**
 * Unit tests for LastKnownValueCache — the non-persisted, in-memory cache introduced by the
 * config-attribution redesign (IDE-2264), mapping each VS Code configuration key to the value
 * the extension itself most recently wrote for it (or observed at activation). Pure addition in
 * this ticket: not yet read or written by any production write path.
 */
import assert from 'assert';
import { LastKnownValueCache } from '../../../../snyk/common/languageServer/lastKnownValueCache';
import type { IVSCodeWorkspace } from '../../../../snyk/common/vscode/workspace';

/** Minimal fake workspace exposing only the getConfiguration seam the cache depends on. */
function makeFakeWorkspace(values: Record<string, unknown>): Pick<IVSCodeWorkspace, 'getConfiguration'> {
  return {
    getConfiguration<T>(configurationIdentifier: string, section: string): T | undefined {
      const key = `${configurationIdentifier}.${section}`;
      return values[key] as T | undefined;
    },
  };
}

suite('LastKnownValueCache', () => {
  test('seeds from current VS Code configuration for every tracked key at construction', () => {
    const workspace = makeFakeWorkspace({
      'snyk.advanced.organization': 'acme-corp',
      'snyk.advanced.cliPath': '/usr/local/bin/snyk',
    });

    const cache = new LastKnownValueCache(workspace, ['snyk.advanced.organization', 'snyk.advanced.cliPath']);

    assert.strictEqual(cache.get('snyk.advanced.organization'), 'acme-corp');
    assert.strictEqual(cache.get('snyk.advanced.cliPath'), '/usr/local/bin/snyk');
  });

  test('a tracked key with no current VS Code value seeds as undefined', () => {
    const workspace = makeFakeWorkspace({});

    const cache = new LastKnownValueCache(workspace, ['snyk.advanced.organization']);

    assert.strictEqual(cache.get('snyk.advanced.organization'), undefined);
  });

  test('get returns undefined for a key that was never in the tracked-keys list', () => {
    const workspace = makeFakeWorkspace({ 'snyk.advanced.organization': 'acme-corp' });

    const cache = new LastKnownValueCache(workspace, ['snyk.advanced.organization']);

    assert.strictEqual(cache.get('snyk.advanced.cliPath'), undefined);
  });

  test('set overwrites the seeded value for a key', () => {
    const workspace = makeFakeWorkspace({ 'snyk.advanced.organization': 'acme-corp' });
    const cache = new LastKnownValueCache(workspace, ['snyk.advanced.organization']);

    cache.set('snyk.advanced.organization', 'beta-org');

    assert.strictEqual(cache.get('snyk.advanced.organization'), 'beta-org');
  });

  test('set works for a key not in the original tracked-keys list', () => {
    const workspace = makeFakeWorkspace({});
    const cache = new LastKnownValueCache(workspace, []);

    cache.set('snyk.advanced.organization', 'acme-corp');

    assert.strictEqual(cache.get('snyk.advanced.organization'), 'acme-corp');
  });
});
