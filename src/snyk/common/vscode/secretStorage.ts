import { ExtensionContext, Event, SecretStorage, SecretStorageChangeEvent } from './types';

export interface ISecretStorageAdapter {
  get(key: string): Promise<string | undefined>;
  store(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  onDidChange: Event<SecretStorageChangeEvent>;
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

  get(key: string): Promise<string | undefined> {
    return this.secretStorage.get(key) as Promise<string | undefined>;
  }

  store(key: string, value: string): Promise<void> {
    return this.secretStorage.store(key, value) as Promise<void>;
  }

  delete(key: string): Promise<void> {
    return this.secretStorage.delete(key) as Promise<void>;
  }

  get onDidChange(): Event<SecretStorageChangeEvent> {
    return this.secretStorage.onDidChange;
  }
}
