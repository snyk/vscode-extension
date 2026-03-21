export const ERRORS = {
  DOWNLOAD_FAILED: `Unable to download the Snyk CLI. This could be caused by connectivity issues or the CLI not being available on the selected release channel.`,
};

export class TransientNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransientNetworkError';
  }
}

const TRANSIENT_NETWORK_ERROR_CODES = ['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'ENETDOWN', 'ENETUNREACH', 'ECONNRESET', 'EPROTO'];

export function isNetworkConnectivityError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  if (code && TRANSIENT_NETWORK_ERROR_CODES.includes(code)) return true;
  // request-light xhr errors use status 0 for network-level failures
  if ((error as { status?: number }).status === 0) return true;
  return false;
}
