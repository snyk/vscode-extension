/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

(function () {
  const vsCodeApi = acquireVsCodeApi();
  const pendingCallbacks: Record<string, (result: unknown) => void> = {};
  let nextRequestId = 0;

  // 'messageResult' is the generic async-reply envelope name. This tree-view channel is
  // INDEPENDENT from the workspace-config channel that shares the name: it keys on requestId
  // with its own pendingCallbacks registry, not callbackId / __ideCallbacks__. The shared name
  // is a naming convention, not a shared resolver — the two do not interoperate.
  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message.type === 'messageResult' && message.requestId) {
      const callback = pendingCallbacks[message.requestId as string] as ((result: unknown) => void) | undefined;
      if (callback) {
        delete pendingCallbacks[message.requestId as string];
        callback(message.result);
      }
    }
  });

  (window as unknown as Record<string, unknown>).__ideExecuteCommand__ = (
    command: string,
    args: unknown[],
    callback?: (result: unknown) => void,
  ) => {
    const requestId = `req_${nextRequestId++}`;
    if (callback) {
      pendingCallbacks[requestId] = callback;
    }
    vsCodeApi.postMessage({
      type: 'executeCommand',
      requestId,
      command,
      args,
    });
  };
})();
