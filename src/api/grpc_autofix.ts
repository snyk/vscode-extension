import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import retry from 'async-retry';
import path from 'path';
import { promisify } from 'util';
import { configuration } from '../snyk/common/configuration/instance';

import type { GetFixSuggestionsRequest } from './proto/autofix/GetFixSuggestionsRequest';
import type { GetFixSuggestionsResponse__Output } from './proto/autofix/GetFixSuggestionsResponse';
import type { ProtoGrpcType } from './proto/autofix_main_api';

const packageDefinition = protoLoader.loadSync(path.join(__dirname, 'proto', 'autofix_main_api.proto'), {
  keepCase: false, // This will change names to camelCase
  longs: Number,
  enums: String,
  defaults: true,
  oneofs: true,
});
const grpcApi = grpc.loadPackageDefinition(packageDefinition) as unknown as ProtoGrpcType;
const grpcClient = new grpcApi.autofix.AutofixService(configuration.autofixBaseURL, grpc.credentials.createInsecure(), {
  // Reference: https://github.com/grpc/grpc/blob/master/include/grpc/impl/codegen/grpc_types.h#L236
  'grpc.max_receive_message_length': -1,
  'grpc.max_send_message_length': 64 * 1024 * 1024, // We can send more then allowed 64 thanks to compression
  'grpc.enable_deadline_checking': 1,
  'grpc.per_message_compression': 1,
  'grpc.default_compression_algorithm': 2,
  'grpc.default_compression_level': 2,
  'grpc.initial_reconnect_backoff_ms': 1000,
  'grpc.min_reconnect_backoff_ms': 5000,
  'grpc.max_reconnect_backoff_ms': 15000,
});

/* eslint-disable */
/**
 * Decorate gRPC method with retry mechanism.
 * "abortRetrying" is a callback that takes the error object and
 * if it resolves to false an undefined value will be returned early.
 */
function decorateMethod<INPUT_T, OUTPUT_T>(
  grpcCall: (
    argument: INPUT_T,
    metadata: grpc.Metadata,
    options: grpc.CallOptions,
    callback: (error: grpc.ServiceError | null, result?: OUTPUT_T) => void,
  ) => grpc.ClientUnaryCall,
  abortRetrying?: (error: grpc.ServiceError) => boolean,
) {
  const func = promisify(grpcCall.bind(grpcClient));
  return (argument: INPUT_T, shardingKey = ''): Promise<OUTPUT_T> => {
    const metadata = new grpc.Metadata();
    if (shardingKey) {
      const hexKey = Buffer.from(shardingKey).toString('hex');
      metadata.add('dc-sharding-key', hexKey);
    }

    const options = {
      deadline: new Date(Date.now() + 150000),
    };

    return retry(
      async (_bail: any) => {
        let res;

        try {
          res = await func(argument, metadata, options);
        } catch (error) {
          if (abortRetrying && abortRetrying(error as grpc.ServiceError)) {
            // Irrecoverable error, stop retrying and return early.
            console.debug({ error }, `Aborting gRPC retries due to error`);

            return undefined as any;
          }

          throw error;
        }

        if (!res) throw new Error('Empty response');
        return res;
      },
      {
        retries: 10,
        minTimeout: 1000,
        maxTimeout: 100000,
        onRetry: (error: any) => {
          console.warn({ error }, `Retrying failed gRPC call...`);
        },
      },
    );
  };
}
export const GetFixSuggestions = decorateMethod<GetFixSuggestionsRequest, GetFixSuggestionsResponse__Output>(
  grpcClient.getFixSuggestions,
);
/* eslint-enable */
