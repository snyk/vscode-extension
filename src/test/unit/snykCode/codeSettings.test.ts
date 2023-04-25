import { strictEqual } from 'assert';
import sinon, { SinonSpy } from 'sinon';
import { ISnykApiClient } from '../../../snyk/common/api/apiСlient';
import { IConfiguration } from '../../../snyk/common/configuration/configuration';
import { SNYK_CONTEXT } from '../../../snyk/common/constants/views';
import { IContextService } from '../../../snyk/common/services/contextService';
import { IOpenerService } from '../../../snyk/common/services/openerService';
import { CodeSettings, ICodeSettings } from '../../../snyk/snykCode/codeSettings';
import { IVSCodeCommands } from '../../../snyk/common/vscode/commands';

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
      isCodeInLsPreview: false,
      viewContext: {},
    };

    settings = new CodeSettings(
      {} as ISnykApiClient,
      contextService,
      {} as IConfiguration,
      {} as IOpenerService,
      {} as IVSCodeCommands,
    );
  });

  teardown(() => {
    sinon.restore();
  });

  test('Code is disabled when command reports SAST is disabled', async () => {
    sinon.stub(CodeSettings.prototype, 'getSastSettings').resolves(false);

    const codeEnabled = await settings.checkCodeEnabled();

    strictEqual(codeEnabled, false);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_ENABLED, false), true);
  });

  test('Code is enabled when command reports SAST is enabled', async () => {
    sinon.stub(CodeSettings.prototype, 'getSastSettings').resolves(true);

    const codeEnabled = await settings.checkCodeEnabled();

    strictEqual(codeEnabled, true);
    strictEqual(setContextFake.calledWith(SNYK_CONTEXT.CODE_ENABLED, true), true);
  });
});
