// Original file: src/api/proto/autofix_main_api.proto


export interface GetFixSuggestionsRequest {
  'inputCode'?: (string);
  'nnModel'?: (string);
  'ruleId'?: (string);
  'lineNum'?: (number);
}

export interface GetFixSuggestionsRequest__Output {
  'inputCode': (string);
  'nnModel': (string);
  'ruleId': (string);
  'lineNum': (number);
}
