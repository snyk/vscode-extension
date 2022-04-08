import { strictEqual } from 'assert';
import sinon, { SinonSpy } from 'sinon';
import { ISnykApiClient } from '../../../snyk/common/api/apiСlient';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { SNYK_CONTEXT } from '../../../snyk/common/constants/views';
import { IContextService } from '../../../snyk/common/services/contextService';
import { IOpenerService } from '../../../snyk/common/services/openerService';
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
      viewContext: {},
    };

    settings = new CodeSettings({} as ISnykApiClient, contextService, {} as IConfiguration, {} as IOpenerService);
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
      reportFalsePositivesEnabled: true,
    });

    const codeEnabled = await settings.checkCodeEnabled();

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
      reportFalsePositivesEnabled: true,
    });

    const codeEnabled = await settings.checkCodeEnabled();

    strictEqual(codeEnabled, true);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_ENABLED, true), true);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_LOCAL_ENGINE_ENABLED, false), true);
  });

  test('Code is disabled when LCE is enabled', async () => {
    sinon.stub(CodeSettings.prototype, 'getSastSettings').resolves({
      sastEnabled: true,
      localCodeEngine: {
        enabled: true,
      },
      reportFalsePositivesEnabled: true,
    });

    const codeEnabled = await settings.checkCodeEnabled();

    strictEqual(codeEnabled, false);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_ENABLED, true), true);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_LOCAL_ENGINE_ENABLED, true), true);
  });

  test('Entitlement reportFalsePositivesEnabled gets cached', async () => {
    const getFake = sinon.stub().returns({
      data: {
        reportFalsePositivesEnabled: true,
      },
    });

    const apiClient: ISnykApiClient = {
      get: getFake,
    };

    settings = new CodeSettings(apiClient, contextService, {} as IConfiguration, {} as IOpenerService);

    await settings.getSastSettings();

    strictEqual(settings.reportFalsePositivesEnabled, true);
  });
});
