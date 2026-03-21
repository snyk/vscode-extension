export const ERRORS = {
  DOWNLOAD_FAILED: `Unable to download the Snyk CLI. This could be caused by connectivity issues or the CLI not being available on the selected release channel.`,
};

export class TransientNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientNetworkError';
  }
}

const TRANSIENT_NETWORK_ERROR_CODES = [
  'ENOTFOUND',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'ENETDOWN',
  'ENETUNREACH',
  'ECONNRESET',
  'EPROTO',
  'EHOSTUNREACH',
];

export function isNetworkConnectivityError(error: unknown): boolean {
  if (error instanceof Error) {
    // Node.js system errors from https.request (e.g. in Downloader.performDownload)
    const code = (error as NodeJS.ErrnoException).code;
    if (code && TRANSIENT_NETWORK_ERROR_CODES.includes(code)) return true;
  }

  // request-light xhr() rejects with plain objects (not Error instances) on network failure:
  //   { status: 500, headers: {}, responseText: "Unable to access <url>. Error: <node-message>", body: Buffer }
  // The node error message embedded in responseText contains the error code (e.g. "ENOTFOUND").
  if (typeof error === 'object' && error !== null) {
    const xhrLike = error as { status?: number; responseText?: string };
    if (xhrLike.status === 500 && typeof xhrLike.responseText === 'string') {
      if (TRANSIENT_NETWORK_ERROR_CODES.some(code => xhrLike.responseText!.includes(code))) {
        return true;
      }
    }
  }

  return false;
}
