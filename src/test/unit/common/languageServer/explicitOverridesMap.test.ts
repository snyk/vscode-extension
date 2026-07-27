/**
 * Unit tests for ExplicitOverridesMap — the persisted, per-LS-key map introduced by the
 * config-attribution redesign (IDE-2264). Pure addition in this ticket: not yet read or
 * written by any production write path.
 */
import assert from 'assert';
import sinon from 'sinon';
import { ExplicitOverridesMap } from '../../../../snyk/common/languageServer/explicitOverridesMap';
import { MEMENTO_EXPLICIT_OVERRIDES_MAP } from '../../../../snyk/common/constants/explicitLspConfiguration';
import { LoggerMock } from '../../mocks/logger.mock';

/** Minimal in-memory Memento that satisfies the interface used by the map. */
function makeMemento(): import('vscode').Memento {
  const store = new Map<string, unknown>();
  return {
    get<T>(key: string, defaultValue?: T): T {
      return (store.has(key) ? store.get(key) : defaultValue) as T;
    },
    update(key: string, value: unknown): Thenable<void> {
      store.set(key, value);
      return Promise.resolve();
    },
    keys(): readonly string[] {
      return [...store.keys()];
    },
  };
}

/** Memento whose every `update` call rejects, to exercise persist()'s failure path. */
function makeRejectingMemento(): import('vscode').Memento {
  const memento = makeMemento();
  return {
    ...memento,
    update: (): Thenable<void> => Promise.reject(new Error('quota exceeded')),
  };
}

/** Waits for the async Memento write queue to fully drain, regardless of chain depth. */
function flushWrites(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

suite('ExplicitOverridesMap', () => {
  test('getEntry returns undefined for a key that has never been set', () => {
    const map = new ExplicitOverridesMap(makeMemento());

    assert.strictEqual(map.getEntry('organization'), undefined);
  });

  test('setExplicitValue then getEntry returns a kind:value entry with that value', () => {
    const map = new ExplicitOverridesMap(makeMemento());

    map.setExplicitValue('organization', 'acme-corp');

    assert.deepStrictEqual(map.getEntry('organization'), { kind: 'value', value: 'acme-corp' });
  });

  test('setReset then getEntry returns a kind:reset entry', () => {
    const map = new ExplicitOverridesMap(makeMemento());

    map.setReset('organization');

    assert.deepStrictEqual(map.getEntry('organization'), { kind: 'reset' });
  });

  test('setExplicitValue overwrites a prior reset entry for the same key', () => {
    const map = new ExplicitOverridesMap(makeMemento());

    map.setReset('organization');
    map.setExplicitValue('organization', 'acme-corp');

    assert.deepStrictEqual(map.getEntry('organization'), { kind: 'value', value: 'acme-corp' });
  });

  test('setReset overwrites a prior concrete value entry for the same key', () => {
    const map = new ExplicitOverridesMap(makeMemento());

    map.setExplicitValue('organization', 'acme-corp');
    map.setReset('organization');

    assert.deepStrictEqual(map.getEntry('organization'), { kind: 'reset' });
  });

  suite('confirmResetDelivered', () => {
    test('clears a reset entry', () => {
      const map = new ExplicitOverridesMap(makeMemento());

      map.setReset('organization');
      map.confirmResetDelivered('organization');

      assert.strictEqual(map.getEntry('organization'), undefined);
    });

    test('does NOT clear a concrete value entry (only resets are confirm-clearable)', () => {
      const map = new ExplicitOverridesMap(makeMemento());

      map.setExplicitValue('organization', 'acme-corp');
      map.confirmResetDelivered('organization');

      assert.deepStrictEqual(
        map.getEntry('organization'),
        { kind: 'value', value: 'acme-corp' },
        'confirmResetDelivered must only clear reset sentinels, never a concrete explicit value',
      );
    });

    test('does not clear a reset that was superseded by a concrete value written after it', () => {
      const map = new ExplicitOverridesMap(makeMemento());

      map.setReset('organization');
      // A genuine user edit arrives before the reset is confirmed delivered — it must
      // overwrite the same slot, and the later confirm must not clobber it.
      map.setExplicitValue('organization', 'acme-corp');
      map.confirmResetDelivered('organization');

      assert.deepStrictEqual(
        map.getEntry('organization'),
        { kind: 'value', value: 'acme-corp' },
        'a superseding user edit must survive a confirm-clear that was queued against the earlier reset',
      );
    });

    test('is a no-op for a key with no entry at all', () => {
      const map = new ExplicitOverridesMap(makeMemento());

      map.confirmResetDelivered('organization');

      assert.strictEqual(map.getEntry('organization'), undefined);
    });
  });

  test('merely reading a reset entry (getEntry) never clears it', () => {
    const map = new ExplicitOverridesMap(makeMemento());

    map.setReset('organization');
    map.getEntry('organization');
    map.getEntry('organization');

    assert.deepStrictEqual(
      map.getEntry('organization'),
      { kind: 'reset' },
      'a reset sentinel must only be removed via confirmResetDelivered, never by reading it',
    );
  });

  test('survives a simulated extension restart (backed by the same Memento)', async () => {
    const memento = makeMemento();
    const map = new ExplicitOverridesMap(memento);

    map.setExplicitValue('organization', 'acme-corp');
    map.setReset('scan_automatic');
    // Let the async persistence write queue flush before "restarting".
    await flushWrites();

    const reloaded = new ExplicitOverridesMap(memento);

    assert.deepStrictEqual(reloaded.getEntry('organization'), { kind: 'value', value: 'acme-corp' });
    assert.deepStrictEqual(reloaded.getEntry('scan_automatic'), { kind: 'reset' });
  });

  test('persists via the documented Memento key', async () => {
    const memento = makeMemento();
    const map = new ExplicitOverridesMap(memento);

    map.setExplicitValue('organization', 'acme-corp');
    await flushWrites();

    const stored = memento.get<Record<string, unknown>>(MEMENTO_EXPLICIT_OVERRIDES_MAP);
    assert.deepStrictEqual(stored, { organization: { kind: 'value', value: 'acme-corp' } });
  });

  test('several synchronous set calls collapse into a single Memento write', async () => {
    const memento = makeMemento();
    const updateSpy = sinon.spy(memento, 'update');
    const map = new ExplicitOverridesMap(memento);

    map.setExplicitValue('organization', 'acme-corp');
    map.setReset('scan_automatic');
    map.setExplicitValue('cliPath', '/usr/local/bin/snyk');
    await flushWrites();

    sinon.assert.calledOnce(updateSpy);
    assert.deepStrictEqual(updateSpy.firstCall.args[1], {
      organization: { kind: 'value', value: 'acme-corp' },
      scan_automatic: { kind: 'reset' },
      cliPath: { kind: 'value', value: '/usr/local/bin/snyk' },
    });
  });

  suite('rejected Memento write', () => {
    test('is logged, and the in-memory entry is kept (not reverted)', async () => {
      const logger = new LoggerMock();
      const errorSpy = sinon.spy(logger, 'error');
      const map = new ExplicitOverridesMap(makeRejectingMemento(), logger);

      map.setExplicitValue('organization', 'acme-corp');
      await flushWrites();

      sinon.assert.calledOnce(errorSpy);
      assert.deepStrictEqual(map.getEntry('organization'), { kind: 'value', value: 'acme-corp' });
    });

    test('does not break the write queue: a later successful write still lands the full map', async () => {
      const memento = makeMemento();
      const updateStub = sinon.stub(memento, 'update');
      updateStub.onFirstCall().returns(Promise.reject(new Error('quota exceeded')));
      updateStub.callThrough();
      const logger = new LoggerMock();
      const map = new ExplicitOverridesMap(memento, logger);

      map.setExplicitValue('organization', 'acme-corp');
      await flushWrites();
      map.setReset('scan_automatic');
      await flushWrites();

      const stored = memento.get<Record<string, unknown>>(MEMENTO_EXPLICIT_OVERRIDES_MAP);
      assert.deepStrictEqual(stored, {
        organization: { kind: 'value', value: 'acme-corp' },
        scan_automatic: { kind: 'reset' },
      });
    });
  });
});
