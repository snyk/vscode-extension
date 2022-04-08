import { ISnykApiClient } from '../api/apiСlient';
import { Configuration, IConfiguration } from '../configuration/configuration';

export type SastSettings = {
  sastEnabled: boolean;
  localCodeEngine: {
    enabled: boolean;
  };
  reportFalsePositivesEnabled: boolean;
};

export async function getSastSettings(api: ISnykApiClient, config: IConfiguration): Promise<SastSettings | undefined> {
  const response = await api.get<SastSettings>('cli-config/settings/sast', {
    headers: {
      'x-snyk-ide': `${Configuration.source}-${await Configuration.getVersion()}`,
    },
    params: {
      ...(config.organization ? { org: config.organization } : {}),
    },
  });

  if (!response) return;

  return response.data;
}
