export const statusCodes: { [key: string]: number } = {
  success: 200,
  loginInProgress: 304,
  unauthorizedContent: 400,
  unauthorizedUser: 401,
  unauthorizedBundleAccess: 403,
  notFound: 404,
  analysisTimeout: 408,
  bigPayload: 413,
  serverError: 500,
  badGateway: 502,
  serviceUnavailable: 503,
  timeout: 504,
};

