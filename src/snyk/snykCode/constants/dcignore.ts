import { CustomDCIgnore, DefaultDCIgnore } from '@deepcode/dcignore';

export const MAX_PAYLOAD = 4 * 1024 * 1024;
export const MAX_FILE_SIZE = 1024 * 1024;
export const HASH_ALGORITHM = 'sha256';
export const ENCODE_TYPE = 'hex';
export const GIT_FILENAME = '.git';
export const GITIGNORE_FILENAME = '.gitignore';
export const DCIGNORE_FILENAME = '.dcignore';
export const DOTSNYK_FILENAME = '.snyk';
export const EXCLUDED_NAMES = [GITIGNORE_FILENAME, DCIGNORE_FILENAME];
export const CACHE_KEY = '.dccache';
export const MAX_UPLOAD_ATTEMPTS = 10;
export const UPLOAD_CONCURRENCY = 2;
export const POLLING_INTERVAL = 500;
export const MAX_RETRY_ATTEMPTS = 10; // Request retries on network errors
export const REQUEST_RETRY_DELAY = 5 * 1000; // delay between retries in milliseconds
export const ORG_ID_REGEXP = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const IGNORES_DEFAULT = [`**/${GIT_FILENAME}/**`];

export const IGNORE_FILES_NAMES = [GITIGNORE_FILENAME, DCIGNORE_FILENAME, DOTSNYK_FILENAME];

export const DCIGNORE_DRAFTS = {
  custom: CustomDCIgnore,
  default: DefaultDCIgnore,
};

// eslint-disable-next-line no-shadow
export enum ErrorCodes {
  loginInProgress = 304,
  badRequest = 400,
  unauthorizedUser = 401,
  unauthorizedBundleAccess = 403,
  notFound = 404,
  bigPayload = 413,
  connectionRefused = 421,
  dnsNotFound = 452,
  serverError = 500,
  badGateway = 502,
  serviceUnavailable = 503,
  timeout = 504,
}

export const NETWORK_ERRORS = {
  ETIMEDOUT: ErrorCodes.timeout,
  ECONNREFUSED: ErrorCodes.connectionRefused,
  ECONNRESET: ErrorCodes.connectionRefused,
  ENETUNREACH: ErrorCodes.connectionRefused,
  ENOTFOUND: ErrorCodes.dnsNotFound,
};

export const DEFAULT_ERROR_MESSAGES: { [P in ErrorCodes]: string } = {
  [ErrorCodes.serverError]: 'Unexpected server error', // 500
  [ErrorCodes.badGateway]: 'Bad gateway', // 502
  [ErrorCodes.serviceUnavailable]: 'Service unavailable', // 503
  [ErrorCodes.timeout]: 'Timeout occured. Try again later.', // 504
  [ErrorCodes.dnsNotFound]: '[Connection issue] Could not resolve domain', // 452
  [ErrorCodes.connectionRefused]: '[Connection issue] Connection refused', // 421
  [ErrorCodes.loginInProgress]: 'Login has not been confirmed yet',
  [ErrorCodes.badRequest]: 'Bad request',
  [ErrorCodes.unauthorizedUser]: 'Missing, revoked or inactive token',
  [ErrorCodes.unauthorizedBundleAccess]: 'Unauthorized access to requested bundle analysis',
  [ErrorCodes.notFound]: 'Not found',
  [ErrorCodes.bigPayload]: `Payload too large (max is ${MAX_PAYLOAD}b)`,
};

export type GenericErrorTypes =
  | ErrorCodes.serverError
  | ErrorCodes.badGateway
  | ErrorCodes.serviceUnavailable
  | ErrorCodes.timeout
  | ErrorCodes.connectionRefused
  | ErrorCodes.dnsNotFound;
