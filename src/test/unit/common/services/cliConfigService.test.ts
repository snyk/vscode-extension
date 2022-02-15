import { strictEqual } from 'assert';
import sinon from 'sinon';
import { ISnykApiClient } from '../../../../snyk/common/api/apiСlient';
import { Configuration } from '../../../../snyk/common/configuration/configuration';
import { getSastSettings } from '../../../../snyk/common/services/cliConfigService';

suite('CLI Config Service', () => {
  teardown(() => {
    sinon.restore();
  });

  test('IDE header is passed to settings endpoint', async () => {
    // arrange
    const getFake = sinon.stub().returns({
      data: {},
    });
    const apiClient: ISnykApiClient = {
      get: getFake,
    };

    // act
    await getSastSettings(apiClient);

    // assert
    strictEqual(
      getFake.calledWith(sinon.match.any, {
        headers: {
          'x-snyk-ide': `vsc-${await Configuration.getVersion()}`,
        },
      }),
      true,
    );
  });
});
