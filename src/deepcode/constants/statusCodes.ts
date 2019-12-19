export const statusCodes: { [key: string]: number } = {
  success: 200,
  loginInProgress: 304,
  unauthorizedContent: 400,
  unauthorizedUser: 401,
  unauthorizedBundleAccess: 403,
  notFound: 404,
  bigPayload: 413
};

export const EXPIRED_REQUEST = "expiredRequest";
export const ATTEMPTS_AMMOUNT = 5;
