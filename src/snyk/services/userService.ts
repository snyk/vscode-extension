import { api } from '../api/api.client';

export type User = {
  id: string;
  username: string;
};

export async function userMe(): Promise<User> {
  const { data } = await api.get<User>('/user/me');
  return data;
}
