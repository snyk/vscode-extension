// Original file: src/api/proto/autofix_main_api.proto

import type * as grpc from '@grpc/grpc-js'
import type { MethodDefinition } from '@grpc/proto-loader'
import type { GetFixSuggestionsRequest as _autofix_GetFixSuggestionsRequest, GetFixSuggestionsRequest__Output as _autofix_GetFixSuggestionsRequest__Output } from '../autofix/GetFixSuggestionsRequest';
import type { GetFixSuggestionsResponse as _autofix_GetFixSuggestionsResponse, GetFixSuggestionsResponse__Output as _autofix_GetFixSuggestionsResponse__Output } from '../autofix/GetFixSuggestionsResponse';
import type { GetRuleMatchesRequest as _autofix_GetRuleMatchesRequest, GetRuleMatchesRequest__Output as _autofix_GetRuleMatchesRequest__Output } from '../autofix/GetRuleMatchesRequest';
import type { GetRuleMatchesResponse as _autofix_GetRuleMatchesResponse, GetRuleMatchesResponse__Output as _autofix_GetRuleMatchesResponse__Output } from '../autofix/GetRuleMatchesResponse';

/**
 * The service which is called as an entry point to the end-to-end pipeline.
 */
export interface AutofixServiceClient extends grpc.Client {
  GetFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  GetFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  GetFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  GetFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  getFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  getFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  getFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  getFixSuggestions(argument: _autofix_GetFixSuggestionsRequest, callback: grpc.requestCallback<_autofix_GetFixSuggestionsResponse__Output>): grpc.ClientUnaryCall;
  
  GetRuleMatches(argument: _autofix_GetRuleMatchesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  GetRuleMatches(argument: _autofix_GetRuleMatchesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  GetRuleMatches(argument: _autofix_GetRuleMatchesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  GetRuleMatches(argument: _autofix_GetRuleMatchesRequest, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  getRuleMatches(argument: _autofix_GetRuleMatchesRequest, metadata: grpc.Metadata, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  getRuleMatches(argument: _autofix_GetRuleMatchesRequest, metadata: grpc.Metadata, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  getRuleMatches(argument: _autofix_GetRuleMatchesRequest, options: grpc.CallOptions, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  getRuleMatches(argument: _autofix_GetRuleMatchesRequest, callback: grpc.requestCallback<_autofix_GetRuleMatchesResponse__Output>): grpc.ClientUnaryCall;
  
}

/**
 * The service which is called as an entry point to the end-to-end pipeline.
 */
export interface AutofixServiceHandlers extends grpc.UntypedServiceImplementation {
  GetFixSuggestions: grpc.handleUnaryCall<_autofix_GetFixSuggestionsRequest__Output, _autofix_GetFixSuggestionsResponse>;
  
  GetRuleMatches: grpc.handleUnaryCall<_autofix_GetRuleMatchesRequest__Output, _autofix_GetRuleMatchesResponse>;
  
}

export interface AutofixServiceDefinition extends grpc.ServiceDefinition {
  GetFixSuggestions: MethodDefinition<_autofix_GetFixSuggestionsRequest, _autofix_GetFixSuggestionsResponse, _autofix_GetFixSuggestionsRequest__Output, _autofix_GetFixSuggestionsResponse__Output>
  GetRuleMatches: MethodDefinition<_autofix_GetRuleMatchesRequest, _autofix_GetRuleMatchesResponse, _autofix_GetRuleMatchesRequest__Output, _autofix_GetRuleMatchesResponse__Output>
}
