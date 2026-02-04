import { strictEqual } from 'assert';
import sinon, { SinonSpy } from 'sinon';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { SNYK_CONTEXT } from '../../../snyk/common/constants/views';
import { IContextService } from '../../../snyk/common/services/contextService';
import { IOpenerService } from '../../../snyk/common/services/openerService';
import { CommandsMock } from '../mocks/commands.mock';
import { CodeSettings, ICodeSettings } from '../../../snyk/snykCode/codeSettings';

suite('Snyk Code Settings', () => {
  let settings: ICodeSettings;
  let setContextFake: SinonSpy;
  let contextService: IContextService;

  setup(() => {
    setContextFake = sinon.fake();

    contextService = {
      setContext: setContextFake,
      shouldShowCodeAnalysis: false,
      shouldShowOssAnalysis: false,
      shouldShowIacAnalysis: false,
      viewContext: {},
    };

    settings = new CodeSettings(contextService, {} as IConfiguration, {} as IOpenerService, new CommandsMock());
  });

  teardown(() => {
    sinon.restore();
  });

  test('Code is disabled when SAST is disabled', async () => {
    sinon.stub(CodeSettings.prototype, 'getSastSettings').resolves({
      sastEnabled: false,
      localCodeEngine: {
        enabled: false,
      },
    });

    const codeEnabled = await settings.updateIsCodeEnabled();

    strictEqual(codeEnabled, false);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_ENABLED, false), true);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_LOCAL_ENGINE_ENABLED, false), true);
  });

  test('Code is enabled when SAST is enabled and LCE is disabled', async () => {
    sinon.stub(CodeSettings.prototype, 'getSastSettings').resolves({
      sastEnabled: true,
      localCodeEngine: {
        enabled: false,
      },
    });

    const codeEnabled = await settings.updateIsCodeEnabled();

    strictEqual(codeEnabled, true);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_ENABLED, true), true);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_LOCAL_ENGINE_ENABLED, false), true);
  });
});
