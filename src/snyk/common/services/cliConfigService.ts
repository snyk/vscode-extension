import { ISnykApiClient } from '../api/apiСlient';

export type SastSettings = {
  sastEnabled: boolean;
};

export async function getSastSettings(api: ISnykApiClient): Promise<SastSettings> {
  const { data } = await api.get<SastSettings>('cli-config/settings/sast');
  return data;
}
