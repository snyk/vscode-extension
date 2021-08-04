import { api } from '../api/apiСlient';

export type User = {
  id: string;
  username: string;
};

export async function userMe(): Promise<User> {
  const { data } = await api.get<User>('/user/me');
  return data;
}
