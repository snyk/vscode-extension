import { rejects, strictEqual } from 'assert';
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
import { WindowMock } from '../../mocks/window.mock';

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
  let windowMock: WindowMock;

  setup(() => {
    baseModule = {} as IBaseSnykModule;
    setContextSpy = sinon.fake();
    setEndpointSpy = sinon.fake();
    setTokenSpy = sinon.fake();
    clearTokenSpy = sinon.fake();
    languageClientSendNotification = sinon.fake();
    windowMock = new WindowMock();

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
      getPreviewFeatures: sinon.fake(),
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
    windowMock.showInputBox.resolves('');

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
    windowMock.showInputBox.resolves(tokenValue);

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

  suite('AuthenticationService', () => {
    // Existing setup...

    suite('patValidate', () => {
      let service: AuthenticationService;

      setup(() => {
        service = new AuthenticationService(
          {} as IContextService,
          {} as IBaseSnykModule,
          {} as IConfiguration,
          windowMock,
          new LoggerMock(),
          {} as ILanguageClientAdapter,
          {} as IVSCodeCommands,
        );
      });

      test('should return true for valid PATs', () => {
        const validPat =
          'snyk_uat.1fcad39e.eyJlJjoxNzQ4NDMxNjJwLCJoJjoJc244ay4payJsJmsoJOJJaWmNXcFdkcjRGamhOYjYxUWdk' +
          'REJaJJwJcyJ6JnE2RGRfUzU2UUpXT0otWVRYVDAwcWcJfQ.-q0jjlMEo4oqT3oga7Y-4Eq0NHqDfEDnWQZSrkv_ea162aHvwHMe9Decpz3JY' +
          'O21r7DOTfne4FF0Y3C8cjJFCw';
        const result = service.patValidate(validPat);
        strictEqual(result, true, "Expected true for valid PAT '" + validPat + "'");
      });

      test('should return false for invalid PATs', () => {
        const invalidPats = [
          'snyk_invalid-pat', // Missing parts
          'snyk_.kid.payload.signature', // Empty type
          'snyk_type..payload.signature', // Empty kid
          'snyk_type.kid..signature', // Empty payload
          'snyk_type.kid.payload.', // Empty signature
          'snyk_type.kid.payload.signature.extra', // Too many parts
          'not-a-snyk-pat', // Wrong prefix
          'snyk_type/kid.payload.signature', // Invalid character (/) in type
          'snyk_type.k/id.payload.signature', // Invalid character (/) in kid
          'snyk_type.kid.p@ylo@d.sign@ture', // Invalid character (@) in payload
          'snyk_type.kid.payload.s!gnature', // Invalid character (!) in signature
          '', // Empty string
          '   ', // Whitespace only
        ];
        invalidPats.forEach(pat => {
          const result = service.patValidate(pat);
          strictEqual(result, false, "Expected false for invalid PAT '" + pat + "')");
        });
      });
    }); // End of patValidate suite
  });
});
