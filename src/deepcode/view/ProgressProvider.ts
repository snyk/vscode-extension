import { NodeProvider } from './NodeProvider';
import { Node } from './Node';

export class ProgressProvider extends NodeProvider {

  getRootChildren(): Node[] {
    return [
      new Node({
        text: this.extension.analysisStatus,
        description: this.processProgress(this.extension.analysisProgress),
      })
    ];
  }

  processProgress(progress: number) {
    return `${Math.round(100*progress)}%`;
  }
}