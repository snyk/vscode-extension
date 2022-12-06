// Original file: src/api/proto/autofix.proto


export interface RuleReport {
  'ruleId'?: (string);
  'message'?: (string);
  'colBegin'?: (number);
  'colEnd'?: (number);
  'lineBegin'?: (number);
  'lineEnd'?: (number);
  'severity'?: (number);
  'eventId'?: (number);
}

export interface RuleReport__Output {
  'ruleId': (string);
  'message': (string);
  'colBegin': (number);
  'colEnd': (number);
  'lineBegin': (number);
  'lineEnd': (number);
  'severity': (number);
  'eventId': (number);
}
