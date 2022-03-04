import { ISnykApiClient } from '../api/apiСlient';
import { Configuration } from '../configuration/configuration';

export type SastSettings = {
  sastEnabled: boolean;
  localCodeEngine: {
    enabled: boolean;
  };
};

export async function getSastSettings(api: ISnykApiClient): Promise<SastSettings | undefined> {
  const response = await api.get<SastSettings>('cli-config/settings/sast', {
    headers: {
      'x-snyk-ide': `${Configuration.source}-${await Configuration.getVersion()}`,
    },
  });

  if (!response) return;

  return response.data;
}
