import { IExplicitLspConfigurationChangeTracker } from '../../../snyk/common/languageServer/explicitLspConfigurationChangeTracker';

export class FakeExplicitLspConfigurationChangeTracker implements IExplicitLspConfigurationChangeTracker {
  private readonly keys = new Set<string>();

  markExplicitlyChanged(lsKey: string): void {
    this.keys.add(lsKey);
  }

  unmarkExplicitlyChanged(lsKey: string): void {
    this.keys.delete(lsKey);
  }

  isExplicitlyChanged(lsKey: string): boolean {
    return this.keys.has(lsKey);
  }
}
