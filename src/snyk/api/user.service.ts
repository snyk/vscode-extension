import { api } from './api.client';

export type User = {
  id: string;
  username: string;
};

export const userMe = async (): Promise<User> => {
  const { data } = await api.get<User>('/user/me');
  return data;
};
