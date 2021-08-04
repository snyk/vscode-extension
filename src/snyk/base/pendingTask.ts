export interface IPendingTask {
  waiter: Promise<void>;
  isCompleted: boolean;
  complete(): void;
}

export class PendingTask implements IPendingTask {
  private _promise: Promise<void>;
  private _resolve: ((value?: unknown) => void) | undefined;
  private _resolved: boolean;

  constructor() {
    this._resolved = false;
    this._promise = new Promise(resolve => {
      this._resolve = resolve;
    }).then(() => {
      this._resolved = true;
    });
  }

  get waiter(): Promise<void> {
    return this._promise;
  }

  get isCompleted(): boolean {
    return this._resolved;
  }

  complete(): void {
    if (this._resolve !== undefined) this._resolve();
  }
}
