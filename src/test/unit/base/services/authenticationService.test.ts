import * as codeClient from '@snyk/code-client';
import { getIpFamily } from '@snyk/code-client';
import { strictEqual } from 'assert';
import needle, { NeedleResponse } from 'needle';
import sinon from 'sinon';
import { IBaseSnykModule } from '../../../../snyk/base/modules/interfaces';
import { AuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { IOpenerService } from '../../../../snyk/common/services/openerService';
import { ISnykCodeErrorHandler } from '../../../../snyk/snykCode/error/snykCodeErrorHandler';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';

suite('AuthenticationService', () => {
  let contextService: IContextService;
  let openerService: IOpenerService;
  let baseModule: IBaseSnykModule;
  let config: IConfiguration;
  let setTokenSpy: sinon.SinonSpy;

  const NEEDLE_DEFAULT_TIMEOUT = 1000;

  const overrideNeedleTimeoutOptions = {
    // eslint-disable-next-line camelcase
    open_timeout: NEEDLE_DEFAULT_TIMEOUT,
    // eslint-disable-next-line camelcase
    response_timeout: NEEDLE_DEFAULT_TIMEOUT,
    // eslint-disable-next-line camelcase
    read_timeout: NEEDLE_DEFAULT_TIMEOUT,
  };

  setup(() => {
    contextService = {
      setContext: sinon.fake(),
    } as unknown as IContextService;
    openerService = {
      openBrowserUrl: sinon.fake(),
      copyOpenedUrl: sinon.fake(),
    };
    baseModule = {} as IBaseSnykModule;
    setTokenSpy = sinon.fake();
    config = {
      authHost: '',
      setToken: setTokenSpy,
    } as unknown as IConfiguration;
  });

  teardown(() => sinon.restore());

  test("Logs 'Authentication Button is Clicked' analytical event", async () => {
    const getIpFamilyStub = sinon.stub(codeClient, 'getIpFamily').resolves(undefined);

    const logAuthenticateButtonIsClickedFake = sinon.fake();
    const analytics = {
      logAuthenticateButtonIsClicked: logAuthenticateButtonIsClickedFake,
    } as unknown as IAnalytics;
    const service = new AuthenticationService(
      contextService,
      openerService,
      baseModule,
      config,
      windowMock,
      analytics,
      new LoggerMock(),
      {
        processError: sinon.fake(),
        resetTransientErrors: sinon.fake(),
      } as ISnykCodeErrorHandler,
    );

    await service.initiateLogin(getIpFamilyStub);

    strictEqual(logAuthenticateButtonIsClickedFake.calledOnce, true);
  });

  // TODO: the following two tests are more of integration tests, since the second requires access to the network layer. Move it to integration test as part of ROAD-625.
  test('getIpFamily returns undefined when IPv6 not supported', async () => {
    const ipv6ErrorCode = 'EADDRNOTAVAIL';

    // code-client calls 'needle', thus it's the easiest place to stub the response when IPv6 is not supported by the OS network stack. Otherwise, Node internals must be stubbed to return the error.
    sinon.stub(needle, 'request').callsFake((_, uri, data, opts, callback) => {
      if (!callback) throw new Error();
      callback(
        {
          code: ipv6ErrorCode,
          errno: ipv6ErrorCode,
        } as unknown as Error,
        {} as unknown as NeedleResponse,
        null,
      );
      // eslint-disable-next-line camelcase
      return needle.post(uri, data, { ...opts, ...overrideNeedleTimeoutOptions });
    });

    const ipFamily = await getIpFamily('https://dev.snyk.io');

    strictEqual(ipFamily, undefined);
  });

  test('getIpFamily returns 6 when IPv6 supported', async () => {
    sinon.stub(needle, 'request').callsFake((_, uri, data, opts, callback) => {
      if (!callback) throw new Error();
      callback(
        null,
        {
          body: {
            response: {
              statusCode: 401,
              body: {},
            },
          },
        } as NeedleResponse,
        null,
      );
      return needle.post(uri, data, { ...opts, ...overrideNeedleTimeoutOptions });
    });

    const ipFamily = await getIpFamily('https://dev.snyk.io');
    strictEqual(ipFamily, 6);
  });

  test("Doesn't call setToken when token is empty", async () => {
    const service = new AuthenticationService(
      contextService,
      openerService,
      baseModule,
      config,
      windowMock,
      {} as IAnalytics,
      new LoggerMock(),
      {
        processError: sinon.fake(),
        resetTransientErrors: sinon.fake(),
      } as ISnykCodeErrorHandler,
    );
    sinon.replace(windowMock, 'showInputBox', sinon.fake.returns(''));

    await service.setToken();

    sinon.assert.notCalled(setTokenSpy);
  });

  test('Call setToken when token is not empty', async () => {
    const service = new AuthenticationService(
      contextService,
      openerService,
      baseModule,
      config,
      windowMock,
      {} as IAnalytics,
      new LoggerMock(),
      {
        processError: sinon.fake(),
        resetTransientErrors: sinon.fake(),
      } as ISnykCodeErrorHandler,
    );
    sinon.replace(windowMock, 'showInputBox', sinon.fake.returns('token-value'));

    await service.setToken();

    sinon.assert.calledOnce(setTokenSpy);
  });
});
