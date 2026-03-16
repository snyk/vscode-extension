/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

(function () {
  const vsCodeApi = acquireVsCodeApi();
  const pendingCallbacks: Record<string, (result: unknown) => void> = {};
  let nextRequestId = 0;

  window.addEventListener('message', (event: MessageEvent) => {
    const message = event.data;
    if (message.type === 'commandResult' && message.requestId) {
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
