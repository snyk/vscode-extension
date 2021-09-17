import { IExtension } from '../../base/modules/interfaces';

export interface IWatcher {
  activate(extension: IExtension): void;
}
