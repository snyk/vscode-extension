export declare const MAX_PAYLOAD: number;
export declare const MAX_FILE_SIZE: number;
export declare const HASH_ALGORITHM = 'sha256';
export declare const ENCODE_TYPE = 'hex';
export declare const GIT_FILENAME = '.git';
export declare const GITIGNORE_FILENAME = '.gitignore';
export declare const DCIGNORE_FILENAME = '.dcignore';
export declare const DOTSNYK_FILENAME = '.snyk';
export declare const EXCLUDED_NAMES: string[];
export declare const CACHE_KEY = '.dccache';
export declare const MAX_UPLOAD_ATTEMPTS = 10;
export declare const UPLOAD_CONCURRENCY = 2;
export declare const POLLING_INTERVAL = 500;
export declare const MAX_RETRY_ATTEMPTS = 10;
export declare const REQUEST_RETRY_DELAY: number;
export declare const ORG_ID_REGEXP: RegExp;
export declare const IGNORES_DEFAULT: string[];
export declare const IGNORE_FILES_NAMES: string[];
export declare const DCIGNORE_DRAFTS: {
  custom: string;
  default: string;
};
export declare enum ErrorCodes {
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
export declare const NETWORK_ERRORS: {
  ETIMEDOUT: ErrorCodes;
  ECONNREFUSED: ErrorCodes;
  ECONNRESET: ErrorCodes;
  ENETUNREACH: ErrorCodes;
  ENOTFOUND: ErrorCodes;
};
export declare const DEFAULT_ERROR_MESSAGES: {
  [P in ErrorCodes]: string;
};
export declare type GenericErrorTypes =
  | ErrorCodes.serverError
  | ErrorCodes.badGateway
  | ErrorCodes.serviceUnavailable
  | ErrorCodes.timeout
  | ErrorCodes.connectionRefused
  | ErrorCodes.dnsNotFound;
