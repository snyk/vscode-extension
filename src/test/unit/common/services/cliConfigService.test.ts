import { strictEqual } from 'assert';
import sinon from 'sinon';
import { ISnykApiClient } from '../../../../snyk/common/api/apiСlient';
import { Configuration, IConfiguration } from '../../../../snyk/common/configuration/configuration';
import { getSastSettings } from '../../../../snyk/common/services/cliConfigService';

suite('CLI Config Service', () => {
  let config: IConfiguration;

  setup(() => {
    config = {
      organization: 'my-super-org',
    } as IConfiguration;
  });

  teardown(() => {
    sinon.restore();
  });

  test('IDE header and URL query param are passed to settings endpoint', async () => {
    // arrange
    const getFake = sinon.stub().returns({
      data: {},
    });
    const apiClient: ISnykApiClient = {
      get: getFake,
    };

    // act
    await getSastSettings(apiClient, config);

    // assert
    strictEqual(
      getFake.calledWith(sinon.match.any, {
        headers: {
          'x-snyk-ide': `${Configuration.source}-${await Configuration.getVersion()}`,
        },
        params: {
          org: config.organization,
        },
      }),
      true,
    );
  });
});
