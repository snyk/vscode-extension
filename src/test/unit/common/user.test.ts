/* eslint-disable @typescript-eslint/no-unused-vars */
import { strictEqual } from 'assert';
import { AxiosRequestConfig, AxiosResponse } from 'axios';
import sinon from 'sinon';
import { IAnalytics } from '../../../snyk/common/analytics/itly';
import { ISnykApiClient } from '../../../snyk/common/api/apiСlient';
import { User } from '../../../snyk/common/user';

suite('User', () => {
  test('Identification calls analytics identify', async () => {
    const identifyFake = sinon.fake();
    const analytics = {
      identify: identifyFake,
    } as unknown as IAnalytics;
    const apiClient = {
      get<UserDto>(_url: string, _config?: AxiosRequestConfig): Promise<AxiosResponse<UserDto>> {
        return Promise.resolve({
          data: {
            id: 'test',
            username: 't',
          },
        } as unknown as AxiosResponse<UserDto>);
      },
    } as ISnykApiClient;

    const user = new User();
    await user.identify(apiClient, analytics);

    strictEqual(identifyFake.called, true);
  });
});
