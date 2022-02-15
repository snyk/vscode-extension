import { ISnykApiClient } from '../api/apiСlient';
import { Configuration } from '../configuration/configuration';

export type SastSettings = {
  sastEnabled: boolean;
  localCodeEngine: {
    enabled: boolean;
  };
};

export async function getSastSettings(api: ISnykApiClient): Promise<SastSettings> {
  const { data } = await api.get<SastSettings>('cli-config/settings/sast', {
    headers: {
      'x-snyk-ide': `vsc-${await Configuration.getVersion()}`,
    },
  });
  return data;
}
