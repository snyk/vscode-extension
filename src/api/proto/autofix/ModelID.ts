// Original file: src/api/proto/autofix.proto


/**
 * Describes the identifier of the model artifact. See `pantscode.ml_infra.storage.artifacts`
 * for the description of an atrifact.
 */
export interface ModelID {
  /**
   * id is always required
   */
  'id'?: (string);
  /**
   * tag is optional, if not set the last version of artifact is used
   */
  'tag'?: (string);
}

/**
 * Describes the identifier of the model artifact. See `pantscode.ml_infra.storage.artifacts`
 * for the description of an atrifact.
 */
export interface ModelID__Output {
  /**
   * id is always required
   */
  'id': (string);
  /**
   * tag is optional, if not set the last version of artifact is used
   */
  'tag': (string);
}
