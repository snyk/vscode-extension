import { rejects } from 'assert';
import sinon from 'sinon';
import { IBaseSnykModule } from '../../../../snyk/base/modules/interfaces';
import { AuthenticationService, OAuthToken } from '../../../../snyk/base/services/authenticationService';
import { ILoadingBadge } from '../../../../snyk/base/views/loadingBadge';
import { IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { DID_CHANGE_CONFIGURATION_METHOD } from '../../../../snyk/common/constants/languageServer';
import { SNYK_CONTEXT } from '../../../../snyk/common/constants/views';
import { IContextService } from '../../../../snyk/common/services/contextService';
import { IVSCodeCommands } from '../../../../snyk/common/vscode/commands';
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
  let setEndpointSpy: sinon.SinonSpy;
  let setTokenSpy: sinon.SinonSpy;
  let clearTokenSpy: sinon.SinonSpy;
  let previewFeaturesSpy: sinon.SinonSpy;

  setup(() => {
    baseModule = {} as IBaseSnykModule;
    setContextSpy = sinon.fake();
    setEndpointSpy = sinon.fake();
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
      setEndpoint: setEndpointSpy,
      setToken: setTokenSpy,
      clearToken: clearTokenSpy,
      getPreviewFeatures: previewFeaturesSpy,
    } as unknown as IConfiguration;
  });

  teardown(() => sinon.restore());

  test("Doesn't call setToken when token is empty", async () => {
    const service = new AuthenticationService(
      contextService,
      baseModule,
      config,
      windowMock,
      new LoggerMock(),
      languageClientAdapter,
      {} as IVSCodeCommands,
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
      new LoggerMock(),
      languageClientAdapter,
      {} as IVSCodeCommands,
    );
    const tokenValue = 'token-value';
    sinon.replace(windowMock, 'showInputBox', sinon.fake.returns(tokenValue));

    await service.setToken();

    sinon.assert.calledOnce(setTokenSpy);
    sinon.assert.calledOnceWithExactly(languageClientSendNotification, DID_CHANGE_CONFIGURATION_METHOD, {});
  });

  suite('.updateTokenAndEndpoint()', () => {
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
        new LoggerMock(),
        languageClientAdapter,
        {
          executeCommand: sinon.fake(),
        } as IVSCodeCommands,
      );
    });

    test('sets the token and endpoint when a valid token is provided', async () => {
      const token = 'be30e2dd-95ac-4450-ad90-5f7cc7429258';
      const apiUrl = 'https://api.snyk.io';
      await service.updateTokenAndEndpoint(token, apiUrl);

      sinon.assert.calledWith(setEndpointSpy, apiUrl);
      sinon.assert.calledWith(setTokenSpy, token);
    });

    test('logs out if token is empty', async () => {
      await service.updateTokenAndEndpoint('', '');

      sinon.assert.called(clearTokenSpy);
      sinon.assert.calledWith(setContextSpy, SNYK_CONTEXT.LOGGEDIN, false);
    });

    test('sets the proper contexts when setting new token', async () => {
      const token = 'be30e2dd-95ac-4450-ad90-5f7cc7429258';
      const apiUrl = 'https://api.snyk.io';
      await service.updateTokenAndEndpoint(token, apiUrl);

      sinon.assert.calledWith(setContextSpy, SNYK_CONTEXT.LOGGEDIN, true);
      sinon.assert.calledWith(setContextSpy, SNYK_CONTEXT.AUTHENTICATING, false);
    });

    test('sets the loading badge status when setting new token', async () => {
      const token = 'be30e2dd-95ac-4450-ad90-5f7cc7429258';
      const apiUrl = 'https://api.snyk.io';
      await service.updateTokenAndEndpoint(token, apiUrl);

      sinon.assert.calledWith(setLoadingBadgeFake, false);
    });

    test('errors when invalid token is provided', async () => {
      const invalidToken = 'thisTokenIsNotValid';
      const apiUrl = 'https://api.snyk.io';

      await rejects(service.updateTokenAndEndpoint(invalidToken, apiUrl));
      sinon.assert.notCalled(setTokenSpy);
    });

    test('accepts oauth token', async () => {
      const oauthToken: OAuthToken = {
        // eslint-disable-next-line camelcase
        access_token: 'access_token',
        expiry: new Date(Date.now() + 10000).toISOString(),
        // eslint-disable-next-line camelcase
        refresh_token: 'refresh_token',
      };
      const oauthTokenString = JSON.stringify(oauthToken);
      const apiUrl = 'https://api.snyk.io';

      await service.updateTokenAndEndpoint(oauthTokenString, apiUrl);
      sinon.assert.calledWith(setEndpointSpy, apiUrl);
      sinon.assert.calledWith(setTokenSpy, oauthTokenString);
    });

    test('fails with error on non oauth token json string', async () => {
      const oauthTokenString = '{}';
      const apiUrl = 'https://api.snyk.io';

      await rejects(service.updateTokenAndEndpoint(oauthTokenString, apiUrl));

      sinon.assert.notCalled(setTokenSpy);
    });

    test('fails with error on setting expired token', async () => {
      const oauthToken: OAuthToken = {
        // eslint-disable-next-line camelcase
        access_token: 'access_token',
        expiry: new Date(Date.now() - 10000).toISOString(),
        // eslint-disable-next-line camelcase
        refresh_token: 'refresh_token',
      };
      const oauthTokenString = JSON.stringify(oauthToken);
      const apiUrl = 'https://api.snyk.io';

      await rejects(service.updateTokenAndEndpoint(oauthTokenString, apiUrl));
      sinon.assert.notCalled(setTokenSpy);
    });
  });
});
