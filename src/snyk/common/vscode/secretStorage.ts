import { ExtensionContext, SecretStorage } from './types';

export interface ISecretStorageAdapter {
  get(key: string): Thenable<string | undefined>;
  store(key: string, value: string): Thenable<void>;
}

export default class SecretStorageAdapter implements ISecretStorageAdapter {
  private static _instance: SecretStorageAdapter;
  constructor(private secretStorage: SecretStorage) {}

  static init(context: ExtensionContext): void {
    SecretStorageAdapter._instance = new SecretStorageAdapter(context.secrets);
  }

  static get instance(): SecretStorageAdapter {
    return SecretStorageAdapter._instance;
  }

  get(key: string): Thenable<string | undefined> {
    return this.secretStorage.get(key);
  }

  store(key: string, value: string): Promise<void> {
    return this.secretStorage.store(key, value) as Promise<void>;
  }

  delete(key: string): Promise<void> {
    return this.secretStorage.delete(key) as Promise<void>;
  }
}
