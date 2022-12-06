import type * as grpc from '@grpc/grpc-js';
import type { MessageTypeDefinition } from '@grpc/proto-loader';

import type { AutofixServiceClient as _autofix_AutofixServiceClient, AutofixServiceDefinition as _autofix_AutofixServiceDefinition } from './autofix/AutofixService';

type SubtypeConstructor<Constructor extends new (...args: any) => any, Subtype> = {
  new(...args: ConstructorParameters<Constructor>): Subtype;
};

export interface ProtoGrpcType {
  autofix: {
    AutofixApiStatus: MessageTypeDefinition
    /**
     * The service which is called as an entry point to the end-to-end pipeline.
     */
    AutofixService: SubtypeConstructor<typeof grpc.Client, _autofix_AutofixServiceClient> & { service: _autofix_AutofixServiceDefinition }
    CommitRuleReport: MessageTypeDefinition
    GetFixSuggestionsRequest: MessageTypeDefinition
    GetFixSuggestionsResponse: MessageTypeDefinition
    GetRuleMatchesRequest: MessageTypeDefinition
    GetRuleMatchesResponse: MessageTypeDefinition
    ModelID: MessageTypeDefinition
    RuleReport: MessageTypeDefinition
    RuleReports: MessageTypeDefinition
  }
}

