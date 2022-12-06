// Original file: src/api/proto/autofix_main_api.proto


// Original file: src/api/proto/autofix_main_api.proto

export enum _autofix_AutofixApiStatus_Code {
  OK = 0,
  FAILED_ANALYSIS = 1,
  INFERENCE_FAILURE = 2,
}

/**
 * General message type which includes all error codes used accross the autofix API.
 */
export interface AutofixApiStatus {
  'code'?: (_autofix_AutofixApiStatus_Code | keyof typeof _autofix_AutofixApiStatus_Code);
  'errorMessage'?: (string);
}

/**
 * General message type which includes all error codes used accross the autofix API.
 */
export interface AutofixApiStatus__Output {
  'code': (keyof typeof _autofix_AutofixApiStatus_Code);
  'errorMessage': (string);
}
