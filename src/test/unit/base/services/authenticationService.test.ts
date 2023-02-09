import { getIpFamily } from '@snyk/code-client';
import { rejects, strictEqual } from 'assert';
import needle, { NeedleResponse } from 'needle';
import sinon from 'sinon';
import { IBaseSnykModule } from '../../../../snyk/base/modules/interfaces';
import { AuthenticationService } from '../../../../snyk/base/services/authenticationService';
import { ILoadingBadge } from '../../../../snyk/base/views/loadingBadge';
import { IAnalytics } from '../../../../snyk/common/analytics/itly';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../../snyk/common/constants/languageServer';
import { SNYK_CONTEXT } from '../../../../snyk/common/constants/views';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { ILanguageClientAdapter } from '../../../../snyk/common/vscode/languageClient';
import { LanguageClient } from '../../../../snyk/common/vscode/types';
import { LoggerMock } from '../../mocks/logger.mock';
import { windowMock } from '../../mocks/window.mock';

suite('AuthenticationService', () => {
  let contextService: IContextService;
  let baseModule: IBaseSnykModule;
  let config: IConfiguration;
  let languageClientAdapter: ILanguageClientAdapter;
  let languageClientSendNotification: sinon.SinonSpy;
  let setContextSpy: sinon.SinonSpy;
  let setTokenSpy: sinon.SinonSpy;
  let clearTokenSpy: sinon.SinonSpy;
  let previewFeaturesSpy: sinon.SinonSpy;

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
    baseModule = {} as IBaseSnykModule;
    setContextSpy = sinon.fake();
    setTokenSpy = sinon.fake();
    clearTokenSpy = sinon.fake();
    languageClientSendNotification = sinon.fake();

    const languageClient = {
      sendNotification: languageClientSendNotification,
    } as unknown as LanguageClient;

    languageClientAdapter = {
      getLanguageClient: () => languageClient,
      create: sinon.fake(),
    };

    contextService = {
      setContext: setContextSpy,
    } as unknown as IContextService;

    config = {
      authHost: '',
      setToken: setTokenSpy,
      clearToken: clearTokenSpy,
      getPreviewFeatures: previewFeaturesSpy,
    } as unknown as IConfiguration;
  });

  teardown(() => sinon.restore());

  test("Logs 'Authentication Button is Clicked' analytical event", async () => {
    const logAuthenticateButtonIsClickedFake = sinon.fake();
    const analytics = {
      logAuthenticateButtonIsClicked: logAuthenticateButtonIsClickedFake,
    } as unknown as IAnalytics;
    const service = new AuthenticationService(
      contextService,
      baseModule,
      config,
      windowMock,
      analytics,
      new LoggerMock(),
      languageClientAdapter,
    );

    await service.initiateLogin();

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
      baseModule,
      config,
      windowMock,
      {} as IAnalytics,
      new LoggerMock(),
      languageClientAdapter,
    );
    sinon.replace(windowMock, 'showInputBox', sinon.fake.returns(''));

    await service.setToken();

    sinon.assert.notCalled(setTokenSpy);
    sinon.assert.notCalled(languageClientSendNotification);
  });

  test('Call setToken when token is not empty', async () => {
    const service = new AuthenticationService(
      contextService,
      baseModule,
      config,
      windowMock,
      {} as IAnalytics,
      new LoggerMock(),
      languageClientAdapter,
    );
    const tokenValue = 'token-value';
    sinon.replace(windowMock, 'showInputBox', sinon.fake.returns(tokenValue));

    await service.setToken();

    sinon.assert.calledOnce(setTokenSpy);
    sinon.assert.calledOnceWithExactly(languageClientSendNotification, DID_CHANGE_CONFIGURATION_METHOD, {});
  });

  suite('.updateToken()', () => {
    let service: AuthenticationService;
    const setLoadingBadgeFake = sinon.fake();

    setup(() => {
      baseModule = {
        loadingBadge: {
          setLoadingBadge: setLoadingBadgeFake,
        } as ILoadingBadge,
      } as IBaseSnykModule;

      service = new AuthenticationService(
        contextService,
        baseModule,
        config,
        windowMock,
        {} as IAnalytics,
        new LoggerMock(),
        languageClientAdapter,
      );
    });

    test('sets the token when a valid token is provided', async () => {
      const token = 'be30e2dd-95ac-4450-ad90-5f7cc7429258';
      await service.updateToken(token);

      sinon.assert.calledWith(setTokenSpy, token);
    });

    test('logs out if token is empty', async () => {
      await service.updateToken('');

      sinon.assert.called(clearTokenSpy);
      sinon.assert.calledWith(setContextSpy, SNYK_CONTEXT.LOGGEDIN, false);
    });

    test('sets the proper contexts when setting new token', async () => {
      const token = 'be30e2dd-95ac-4450-ad90-5f7cc7429258';
      await service.updateToken(token);

      sinon.assert.calledWith(setContextSpy, SNYK_CONTEXT.LOGGEDIN, true);
      sinon.assert.calledWith(setContextSpy, SNYK_CONTEXT.AUTHENTICATING, false);
    });

    test('sets the loading badge status when setting new token', async () => {
      const token = 'be30e2dd-95ac-4450-ad90-5f7cc7429258';
      await service.updateToken(token);

      sinon.assert.calledWith(setLoadingBadgeFake, false);
    });

    test('errors when invalid token is provided', async () => {
      const invalidToken = 'thisTokenIsNotValid';

      await rejects(service.updateToken(invalidToken));
      sinon.assert.notCalled(setTokenSpy);
    });
  });
});
