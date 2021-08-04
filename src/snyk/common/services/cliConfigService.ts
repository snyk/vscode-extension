import { api } from '../api/apiСlient';

export type SastSettings = {
  sastEnabled: boolean;
};

export async function getSastSettings(): Promise<SastSettings> {
  const { data } = await api.get<SastSettings>('cli-config/settings/sast');
  return data;
}
