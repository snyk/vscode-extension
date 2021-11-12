import * as codeClient from '@snyk/code-client';
import { strictEqual } from 'assert';
import sinon from 'sinon';
import { IBaseSnykModule } from '../../../../snyk/base/modules/interfaces';
import { AuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { IOpenerService } from '../../../../snyk/common/services/openerService';
import { LoggerMock } from '../../mocks/logger.mock';

suite('AuthenticationService', () => {
  let contextService: IContextService;
  let openerService: IOpenerService;
  let baseModule: IBaseSnykModule;
  let config: IConfiguration;

  setup(() => {
    contextService = ({
      setContext: sinon.fake(),
    } as unknown) as IContextService;
    openerService = {
      openBrowserUrl: sinon.fake(),
      copyOpenedUrl: sinon.fake(),
    };
    baseModule = {} as IBaseSnykModule;
    config = ({
      authHost: '',
    } as unknown) as IConfiguration;
  });

  test("Logs 'Authentication Button is Clicked' analytical event", async () => {
    const getIpFamilyStub = sinon.stub(codeClient, 'getIpFamily').resolves(undefined);

    const logAuthenticateButtonIsClickedFake = sinon.fake();
    const analytics = ({
      logAuthenticateButtonIsClicked: logAuthenticateButtonIsClickedFake,
    } as unknown) as IAnalytics;
    const service = new AuthenticationService(
      contextService,
      openerService,
      baseModule,
      config,
      analytics,
      new LoggerMock(),
    );

    await service.initiateLogin(getIpFamilyStub);

    strictEqual(logAuthenticateButtonIsClickedFake.calledOnce, true);
  });
});
